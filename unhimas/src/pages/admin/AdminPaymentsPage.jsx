import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdPayments,
  MdRefresh,
  MdCheckCircle,
  MdCancel,
  MdAdd,
  MdDownload,
  MdPrint,
  MdSearch,
  MdInfo,
  MdAccountBalanceWallet,
  MdPendingActions,
  MdBlock,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import { useTranslation } from '../../i18n';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import { getStudents } from '../../services/peopleService';
import {
  listPayments,
  listInvoices,
  markPaymentCompleted,
  markPaymentFailed,
  recordAdminPayment,
  formatXAF,
  PAYMENT_METHODS,
} from '../../services/feesService';
import { downloadPaymentReceipt, printPaymentQuitus } from '../../utils/studentDocuments';

function statusClass(status) {
  const map = {
    pending: 'badge-warning',
    completed: 'badge-success',
    failed: 'badge-danger',
    refunded: 'badge-muted',
  };
  return map[status] || 'badge-muted';
}

function studentLabel(p) {
  const s = p.students;
  if (!s) return '—';
  const name = `${s.first_name || ''} ${s.last_name || ''}`.trim();
  if (name && s.matricule) return `${name} (${s.matricule})`;
  return name || s.matricule || '—';
}

export default function AdminPaymentsPage() {
  const { translateText } = useTranslation();
  const { profile } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [inspectPayment, setInspectPayment] = useState(null);
  const [rejectPaymentTarget, setRejectPaymentTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Record payment form
  const [recordStudentId, setRecordStudentId] = useState('');
  const [recordInvoiceId, setRecordInvoiceId] = useState('');
  const [recordAmount, setRecordAmount] = useState('');
  const [recordMethod, setRecordMethod] = useState('cash');
  const [recordProviderRef, setRecordProviderRef] = useState('');
  const [recordPhone, setRecordPhone] = useState('');
  const [recordNotes, setRecordNotes] = useState('');
  const [recordCompleteImmediately, setRecordCompleteImmediately] = useState(true);

  // Fetch payments
  const { data: allPayments = [], isLoading } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: () => listPayments({ limit: 150 }),
  });

  // Students list for manual record
  const { data: students = [] } = useQuery({
    queryKey: ['students-for-payment'],
    queryFn: () => getStudents({}),
    enabled: showRecordModal,
  });

  // Unpaid invoices for selected student
  const { data: studentInvoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['student-invoices-for-record', recordStudentId],
    queryFn: () => listInvoices({ studentId: recordStudentId, limit: 30 }),
    enabled: !!recordStudentId && showRecordModal,
  });

  // Mutations
  const completeMutation = useMutation({
    mutationFn: (id) =>
      markPaymentCompleted(id, { recordedBy: profile?.id }),
    onSuccess: (updated) => {
      toast.success(
        `${translateText('Payment marked completed')} (${updated.payment_reference})`,
      );
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['student-fee-balance'] });
      if (inspectPayment?.id === updated.id) {
        setInspectPayment(updated);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) =>
      markPaymentFailed(id, { reason, recordedBy: profile?.id }),
    onSuccess: () => {
      toast.success(translateText('Payment marked as rejected / failed'));
      setRejectPaymentTarget(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['student-fee-balance'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const recordMutation = useMutation({
    mutationFn: recordAdminPayment,
    onSuccess: (payment) => {
      toast.success(
        `${translateText('Payment recorded successfully')} (${payment.payment_reference})`,
      );
      setShowRecordModal(false);
      setRecordStudentId('');
      setRecordInvoiceId('');
      setRecordAmount('');
      setRecordMethod('cash');
      setRecordProviderRef('');
      setRecordPhone('');
      setRecordNotes('');
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['student-fee-balance'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const handleStudentSelect = (sId) => {
    setRecordStudentId(sId);
    setRecordInvoiceId('');
    setRecordAmount('');
  };

  const handleInvoiceSelect = (invId) => {
    setRecordInvoiceId(invId);
    const selected = studentInvoices.find((i) => i.id === invId);
    if (selected) {
      const bal = Number(selected.balance ?? selected.total_amount - selected.amount_paid) || 0;
      setRecordAmount(bal > 0 ? String(bal) : String(selected.total_amount));
    }
  };

  const submitRecordPayment = (e) => {
    e.preventDefault();
    if (!recordStudentId) {
      toast.error(translateText('Select a student'));
      return;
    }
    if (!recordInvoiceId) {
      toast.error(translateText('Select an invoice'));
      return;
    }
    if (!recordAmount || Number(recordAmount) <= 0) {
      toast.error(translateText('Enter a valid payment amount'));
      return;
    }

    recordMutation.mutate({
      studentId: recordStudentId,
      invoiceId: recordInvoiceId,
      amount: Number(recordAmount),
      method: recordMethod,
      phoneNumber: recordPhone || null,
      providerReference: recordProviderRef || null,
      notes: recordNotes || null,
      completeImmediately: recordCompleteImmediately,
      recordedBy: profile?.id,
    });
  };

  // KPIs
  const totalCollected = allPayments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const pendingPayments = allPayments.filter((p) => p.status === 'pending');
  const pendingAmount = pendingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const failedCount = allPayments.filter((p) => p.status === 'failed').length;

  // Filtered payments
  const filteredPayments = allPayments.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (methodFilter && p.method !== methodFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const s = p.students;
      const sName = `${s?.first_name || ''} ${s?.last_name || ''}`.toLowerCase();
      const sMat = (s?.matricule || '').toLowerCase();
      const pRef = (p.payment_reference || '').toLowerCase();
      const rNum = (p.receipt_number || '').toLowerCase();
      const provRef = (p.provider_reference || '').toLowerCase();
      const invNum = (p.student_invoices?.invoice_number || '').toLowerCase();
      if (
        !sName.includes(q) &&
        !sMat.includes(q) &&
        !pRef.includes(q) &&
        !rNum.includes(q) &&
        !provRef.includes(q) &&
        !invNum.includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const methodLabel = (value) =>
    PAYMENT_METHODS.find((m) => m.value === value)?.label || value;

  return (
    <AppLayout pageTitle="Payments">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Payments & Transactions')}</h1>
          <p className="page-subtitle">
            {translateText('Verify student Mobile Money and bank transactions, record cash deposits, and issue receipts')}
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowRecordModal(true)}
          >
            <MdAdd /> {translateText('Record manual payment')}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-payments'] })}
          >
            <MdRefresh /> {translateText('Refresh')}
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-card-icon green">
            <MdCheckCircle />
          </div>
          <div className="stat-card-body">
            <div className="stat-card-value">{formatXAF(totalCollected)}</div>
            <div className="stat-card-label">{translateText('Total collections confirmed')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className={`stat-card-icon ${pendingPayments.length > 0 ? 'amber' : 'blue'}`}>
            <MdPendingActions />
          </div>
          <div className="stat-card-body">
            <div className="stat-card-value">
              {pendingPayments.length} ({formatXAF(pendingAmount)})
            </div>
            <div className="stat-card-label">{translateText('Pending verification')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon red">
            <MdBlock />
          </div>
          <div className="stat-card-body">
            <div className="stat-card-value">{failedCount}</div>
            <div className="stat-card-label">{translateText('Rejected / Failed')}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdPayments color="var(--color-primary)" /> {translateText('Payment ledger')} (
            {filteredPayments.length})
          </span>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <MdSearch
                size={18}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)',
                }}
              />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 32, width: 220, height: 36 }}
                placeholder={translateText('Search matricule, ref, student…')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="form-control"
              style={{ width: 'auto', minWidth: 140, height: 36 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">{translateText('All statuses')}</option>
              <option value="pending">{translateText('Pending verification')}</option>
              <option value="completed">{translateText('Completed')}</option>
              <option value="failed">{translateText('Failed / Rejected')}</option>
              <option value="refunded">{translateText('Refunded')}</option>
            </select>

            <select
              className="form-control"
              style={{ width: 'auto', minWidth: 140, height: 36 }}
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
            >
              <option value="">{translateText('All methods')}</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {isLoading ? (
            <div className="empty-state">{translateText('Loading payments…')}</div>
          ) : filteredPayments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><MdPayments /></div>
              <div className="empty-state-title">{translateText('No payments found')}</div>
              <p className="empty-state-text">
                {translateText('No payment records match the selected filters.')}
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{translateText('Reference')}</th>
                  <th>{translateText('Student')}</th>
                  <th>{translateText('Invoice')}</th>
                  <th>{translateText('Amount')}</th>
                  <th>{translateText('Method')}</th>
                  <th>{translateText('Status')}</th>
                  <th>{translateText('Date')}</th>
                  <th>{translateText('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 0,
                          padding: 0,
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontWeight: 650,
                          color: 'var(--color-primary)',
                        }}
                        onClick={() => setInspectPayment(p)}
                        title={translateText('Click to view details')}
                      >
                        {p.payment_reference}
                      </button>
                      {p.receipt_number && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {p.receipt_number}
                        </div>
                      )}
                      {p.provider_reference && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Trx: {p.provider_reference}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.875rem' }}>{studentLabel(p)}</td>
                    <td>{p.student_invoices?.invoice_number || '—'}</td>
                    <td style={{ fontWeight: 700 }}>{formatXAF(p.amount)}</td>
                    <td>{methodLabel(p.method)}</td>
                    <td>
                      <span className={`badge ${statusClass(p.status)}`}>
                        {p.status === 'pending' ? translateText('Pending') : p.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.825rem' }}>
                      {p.paid_at
                        ? new Date(p.paid_at).toLocaleDateString()
                        : new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {p.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={completeMutation.isPending}
                              onClick={() => completeMutation.mutate(p.id)}
                              title={translateText('Confirm payment and issue receipt')}
                            >
                              <MdCheckCircle size={14} /> {translateText('Approve')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              disabled={rejectMutation.isPending}
                              onClick={() => {
                                setRejectPaymentTarget(p);
                                setRejectReason('');
                              }}
                              title={translateText('Reject invalid or duplicate payment')}
                              style={{ color: 'var(--color-danger)' }}
                            >
                              <MdCancel size={14} /> {translateText('Reject')}
                            </button>
                          </>
                        )}
                        {p.status === 'completed' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() =>
                                downloadPaymentReceipt(
                                  { ...p, student_invoices: p.student_invoices },
                                  p.students,
                                ).catch((err) => toast.error(err.message))
                              }
                              title={translateText('Download PDF receipt')}
                            >
                              <MdDownload size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => printPaymentQuitus(p, p.students)}
                              title={translateText('Print quitus')}
                            >
                              <MdPrint size={14} />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setInspectPayment(p)}
                          title={translateText('View full details')}
                        >
                          <MdInfo size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Record Manual Payment Modal */}
      {showRecordModal && (
        <Modal
          title={translateText('Record manual / offline payment')}
          onClose={() => setShowRecordModal(false)}
        >
          <form className="form-stack" onSubmit={submitRecordPayment}>
            <div className="form-group">
              <label>{translateText('Student')}</label>
              <select
                className="form-control"
                value={recordStudentId}
                onChange={(e) => handleStudentSelect(e.target.value)}
                required
              >
                <option value="">{translateText('Select student…')}</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} ({s.matricule})
                  </option>
                ))}
              </select>
            </div>

            {recordStudentId && (
              <div className="form-group">
                <label>{translateText('Invoice to pay')}</label>
                {invoicesLoading ? (
                  <p className="entity-card-meta">{translateText('Loading invoices…')}</p>
                ) : studentInvoices.length === 0 ? (
                  <p className="entity-card-meta" style={{ color: 'var(--color-danger)' }}>
                    {translateText('No issued invoices found for this student. Issue an invoice first.')}
                  </p>
                ) : (
                  <select
                    className="form-control"
                    value={recordInvoiceId}
                    onChange={(e) => handleInvoiceSelect(e.target.value)}
                    required
                  >
                    <option value="">{translateText('Select invoice…')}</option>
                    {studentInvoices.map((inv) => {
                      const bal =
                        Number(inv.balance ?? inv.total_amount - inv.amount_paid) || 0;
                      return (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoice_number} — Total: {formatXAF(inv.total_amount)} (Balance:{' '}
                          {formatXAF(bal)}) [{inv.status}]
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            )}

            <div className="form-group">
              <label>{translateText('Amount paid (XAF)')}</label>
              <input
                type="number"
                min="1"
                step="1"
                className="form-control"
                value={recordAmount}
                onChange={(e) => setRecordAmount(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>{translateText('Payment method')}</label>
              <select
                className="form-control"
                value={recordMethod}
                onChange={(e) => setRecordMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>{translateText('Bank slip / Transaction reference')}</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. ECOBANK-99231 or Cashier Receipt #12"
                value={recordProviderRef}
                onChange={(e) => setRecordProviderRef(e.target.value)}
              />
            </div>

            {(recordMethod === 'mtn_momo' || recordMethod === 'orange_money') && (
              <div className="form-group">
                <label>{translateText('Sender Mobile Number')}</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="6XXXXXXXX"
                  value={recordPhone}
                  onChange={(e) => setRecordPhone(e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label>{translateText('Notes / Remarks')}</label>
              <textarea
                className="form-control"
                rows={2}
                value={recordNotes}
                onChange={(e) => setRecordNotes(e.target.value)}
                placeholder={translateText('e.g. Received at bursar front-desk')}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={recordCompleteImmediately}
                onChange={(e) => setRecordCompleteImmediately(e.target.checked)}
              />
              {translateText('Confirm and issue official receipt immediately')}
            </label>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowRecordModal(false)}
              >
                {translateText('Cancel')}
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={recordMutation.isPending || !recordInvoiceId}
              >
                {recordMutation.isPending
                  ? translateText('Recording…')
                  : translateText('Record payment')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Inspect Payment Details Modal */}
      {inspectPayment && (
        <Modal
          title={translateText('Payment details') + `: ${inspectPayment.payment_reference}`}
          onClose={() => setInspectPayment(null)}
        >
          <div className="form-stack">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <span className="entity-card-meta">{translateText('Student')}</span>
                <div style={{ fontWeight: 650 }}>{studentLabel(inspectPayment)}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {inspectPayment.students?.email || '—'}
                </div>
              </div>
              <div>
                <span className="entity-card-meta">{translateText('Amount')}</span>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-primary)' }}>
                  {formatXAF(inspectPayment.amount)}
                </div>
              </div>
              <div>
                <span className="entity-card-meta">{translateText('Method')}</span>
                <div>{methodLabel(inspectPayment.method)}</div>
              </div>
              <div>
                <span className="entity-card-meta">{translateText('Status')}</span>
                <div>
                  <span className={`badge ${statusClass(inspectPayment.status)}`}>
                    {inspectPayment.status}
                  </span>
                </div>
              </div>
              <div>
                <span className="entity-card-meta">{translateText('Invoice')}</span>
                <div style={{ fontWeight: 600 }}>
                  {inspectPayment.student_invoices?.invoice_number || '—'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  Total: {formatXAF(inspectPayment.student_invoices?.total_amount)}
                </div>
              </div>
              <div>
                <span className="entity-card-meta">{translateText('Receipt number')}</span>
                <div style={{ fontWeight: 600 }}>{inspectPayment.receipt_number || '—'}</div>
              </div>
              <div>
                <span className="entity-card-meta">{translateText('Transaction reference')}</span>
                <div>{inspectPayment.provider_reference || '—'}</div>
              </div>
              <div>
                <span className="entity-card-meta">{translateText('Phone number')}</span>
                <div>{inspectPayment.phone_number || '—'}</div>
              </div>
              <div>
                <span className="entity-card-meta">{translateText('Date initiated')}</span>
                <div style={{ fontSize: '0.85rem' }}>
                  {new Date(inspectPayment.created_at).toLocaleString()}
                </div>
              </div>
              <div>
                <span className="entity-card-meta">{translateText('Date confirmed')}</span>
                <div style={{ fontSize: '0.85rem' }}>
                  {inspectPayment.paid_at
                    ? new Date(inspectPayment.paid_at).toLocaleString()
                    : '—'}
                </div>
              </div>
            </div>

            {inspectPayment.notes && (
              <div>
                <span className="entity-card-meta">{translateText('Notes & Logs')}</span>
                <div
                  style={{
                    background: 'var(--color-bg)',
                    padding: 8,
                    borderRadius: 6,
                    fontSize: '0.85rem',
                    marginTop: 4,
                  }}
                >
                  {inspectPayment.notes}
                </div>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginTop: 16,
                borderTop: '1px solid var(--color-border)',
                paddingTop: 12,
              }}
            >
              {inspectPayment.status === 'completed' && (
                <>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() =>
                      downloadPaymentReceipt(
                        {
                          ...inspectPayment,
                          student_invoices: inspectPayment.student_invoices,
                        },
                        inspectPayment.students,
                      ).catch((err) => toast.error(err.message))
                    }
                  >
                    <MdDownload /> {translateText('Download receipt')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => printPaymentQuitus(inspectPayment, inspectPayment.students)}
                  >
                    <MdPrint /> {translateText('Print quitus')}
                  </button>
                </>
              )}
              {inspectPayment.status === 'pending' && (
                <>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ color: 'var(--color-danger)' }}
                    onClick={() => {
                      setRejectPaymentTarget(inspectPayment);
                      setRejectReason('');
                    }}
                  >
                    <MdCancel /> {translateText('Reject')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={completeMutation.isPending}
                    onClick={() => completeMutation.mutate(inspectPayment.id)}
                  >
                    <MdCheckCircle /> {translateText('Mark completed')}
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setInspectPayment(null)}
              >
                {translateText('Close')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Payment Confirmation Modal */}
      {rejectPaymentTarget && (
        <Modal
          title={translateText('Reject payment') + `: ${rejectPaymentTarget.payment_reference}`}
          onClose={() => setRejectPaymentTarget(null)}
        >
          <div className="form-stack">
            <p>
              {translateText(
                'Are you sure you want to reject this payment submission? It will be marked as failed and will not credit the student invoice.',
              )}
            </p>
            <div className="form-group">
              <label>{translateText('Rejection reason (shown in audit log)')}</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder={translateText('e.g. Transaction ID not found on MoMo portal / Incorrect deposit slip')}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setRejectPaymentTarget(null)}
              >
                {translateText('Cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                disabled={rejectMutation.isPending}
                onClick={() =>
                  rejectMutation.mutate({
                    id: rejectPaymentTarget.id,
                    reason: rejectReason,
                  })
                }
              >
                {rejectMutation.isPending
                  ? translateText('Rejecting…')
                  : translateText('Confirm rejection')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
