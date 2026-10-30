import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdPayments,
  MdReceiptLong,
  MdAccountBalanceWallet,
  MdPhoneAndroid,
  MdCheckCircle,
  MdRefresh,
  MdInfo,
  MdPrint,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { useToast } from '../../hooks/useToast';
import ProfileUnlinkedState from '../../components/common/ProfileUnlinkedState';
import { getMyStudentProfile } from '../../services/studentService';
import {
  listInvoices,
  listPayments,
  getStudentFeeBalance,
  initiatePayment,
  formatXAF,
  PAYMENT_METHODS,
} from '../../services/feesService';

function statusBadge(status) {
  const map = {
    draft: 'badge-muted',
    issued: 'badge-info',
    partially_paid: 'badge-warning',
    paid: 'badge-success',
    cancelled: 'badge-danger',
    waived: 'badge-muted',
    pending: 'badge-warning',
    completed: 'badge-success',
    failed: 'badge-danger',
    refunded: 'badge-muted',
  };
  return map[status] || 'badge-muted';
}

function printQuitus(payment, student) {
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return;
  const name = student
    ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
    : '';
  w.document.write(`<!DOCTYPE html><html><head><title>Quitus ${payment.receipt_number || payment.payment_reference}</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 480px; margin: 0 auto; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      .muted { color: #666; font-size: 0.85rem; }
      table { width: 100%; margin-top: 1.5rem; border-collapse: collapse; }
      td { padding: 0.4rem 0; border-bottom: 1px solid #eee; }
      td:last-child { text-align: right; font-weight: 600; }
      .stamp { margin-top: 2rem; font-size: 0.8rem; color: #333; }
    </style></head><body>
    <h1>UNHIMAS — Payment receipt (Quitus)</h1>
    <p class="muted">Official fee payment acknowledgement</p>
    <table>
      <tr><td>Student</td><td>${name || '—'} ${student?.matricule ? '(' + student.matricule + ')' : ''}</td></tr>
      <tr><td>Reference</td><td>${payment.payment_reference || '—'}</td></tr>
      <tr><td>Receipt</td><td>${payment.receipt_number || '—'}</td></tr>
      <tr><td>Amount</td><td>${formatXAF(payment.amount)}</td></tr>
      <tr><td>Method</td><td>${(payment.method || '').replace('_', ' ')}</td></tr>
      <tr><td>Status</td><td>${payment.status}</td></tr>
      <tr><td>Date</td><td>${payment.paid_at ? new Date(payment.paid_at).toLocaleString() : new Date(payment.created_at).toLocaleString()}</td></tr>
    </table>
    <p class="stamp">Generated from the student portal. Present this with your matricule when required.</p>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`);
  w.document.close();
}

export default function StudentFeesPage() {
  const { translateText } = useTranslation();
  const { session } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [payInvoice, setPayInvoice] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('mtn_momo');
  const [phone, setPhone] = useState('');

  const {
    data: studentProfile,
    isLoading: stuLoading,
    error: stuError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['my-student-profile'],
    queryFn: getMyStudentProfile,
    enabled: !!session,
  });

  const studentId = studentProfile?.id;

  const { data: balance, isLoading: balLoading } = useQuery({
    queryKey: ['student-fee-balance', studentId],
    queryFn: () => getStudentFeeBalance(studentId),
    enabled: !!studentId,
  });

  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ['student-invoices', studentId],
    queryFn: () => listInvoices({ studentId, limit: 30 }),
    enabled: !!studentId,
  });

  const { data: payments = [], isLoading: payLoading } = useQuery({
    queryKey: ['student-payments', studentId],
    queryFn: () => listPayments({ studentId, limit: 30 }),
    enabled: !!studentId,
  });

  const payMutation = useMutation({
    mutationFn: (payload) => initiatePayment(payload),
    onSuccess: (data) => {
      if (data.status === 'completed') {
        toast.success(
          translateText('Payment recorded') +
            (data.receipt_number ? ` · ${data.receipt_number}` : ''),
        );
      } else {
        toast.success(
          translateText('Payment submitted — pending confirmation by the finance office'),
        );
      }
      setPayInvoice(null);
      setPayAmount('');
      setPhone('');
      queryClient.invalidateQueries({ queryKey: ['student-fee-balance', studentId] });
      queryClient.invalidateQueries({ queryKey: ['student-invoices', studentId] });
      queryClient.invalidateQueries({ queryKey: ['student-payments', studentId] });
    },
    onError: (err) => {
      toast.error(err?.message || translateText('Payment failed'));
    },
  });

  const openPay = (inv) => {
    setPayInvoice(inv);
    const remaining = Number(inv.balance ?? inv.total_amount - inv.amount_paid) || 0;
    setPayAmount(remaining > 0 ? String(remaining) : '');
    setPayMethod('mtn_momo');
    setPhone('');
  };

  const submitPayment = (e) => {
    e.preventDefault();
    if (!payInvoice || !studentId) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      toast.error(translateText('Enter a valid amount'));
      return;
    }
    if ((payMethod === 'mtn_momo' || payMethod === 'orange_money') && !phone.trim()) {
      toast.error(translateText('Phone number is required for Mobile Money'));
      return;
    }
    // Production default: pending until admin (or MoMo webhook) confirms.
    // Set VITE_PAYMENTS_AUTO_COMPLETE=true only for local demos.
    const autoComplete = import.meta.env.VITE_PAYMENTS_AUTO_COMPLETE === 'true';
    payMutation.mutate({
      invoiceId: payInvoice.id,
      studentId,
      amount,
      method: payMethod,
      phoneNumber: phone.trim() || null,
      completeImmediately: autoComplete,
    });
  };

  if (stuLoading) {
    return (
      <AppLayout pageTitle="Fees">
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">{translateText('Fees & Payments')}</h1>
            <p className="page-subtitle">{translateText('Loading…')}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (stuError || !studentProfile) {
    return (
      <AppLayout pageTitle="Fees">
        <ProfileUnlinkedState role="student" errorCode={stuError?.code} onRetry={() => refetchProfile()} />
      </AppLayout>
    );
  }

  const outstanding = Number(balance?.outstanding_balance ?? 0);

  return (
    <AppLayout pageTitle="Fees & Payments">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Fees & Payments')}</h1>
          <p className="page-subtitle">
            {translateText('View your balance, invoices, and pay securely via Mobile Money')}
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['student-fee-balance', studentId] });
              queryClient.invalidateQueries({ queryKey: ['student-invoices', studentId] });
              queryClient.invalidateQueries({ queryKey: ['student-payments', studentId] });
            }}
          >
            <MdRefresh /> {translateText('Refresh')}
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className={`stat-card-icon ${outstanding > 0 ? 'red' : 'green'}`}>
            <MdAccountBalanceWallet />
          </div>
          <div className="stat-card-body">
            <div className="stat-card-value">
              {balLoading ? '…' : formatXAF(outstanding)}
            </div>
            <div className="stat-card-label">{translateText('Outstanding balance')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon blue">
            <MdReceiptLong />
          </div>
          <div className="stat-card-body">
            <div className="stat-card-value">
              {balLoading ? '…' : formatXAF(balance?.total_invoiced)}
            </div>
            <div className="stat-card-label">{translateText('Total invoiced')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon green">
            <MdCheckCircle />
          </div>
          <div className="stat-card-body">
            <div className="stat-card-value">
              {balLoading ? '…' : formatXAF(balance?.total_paid)}
            </div>
            <div className="stat-card-label">{translateText('Total paid')}</div>
          </div>
        </div>
      </div>

      <div className="alert-banner" style={{ marginBottom: '1.35rem' }} role="note">
        <MdInfo size={18} style={{ flexShrink: 0 }} />
        <span>
          {translateText(
            'Pay with MTN MoMo or Orange Money. Payments stay pending until the finance office confirms. Then print your quitus.',
          )}
        </span>
      </div>

      <div className="student-dashboard-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdReceiptLong color="var(--color-primary)" /> {translateText('My invoices')}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {invLoading ? (
              <div className="empty-state">{translateText('Loading invoices…')}</div>
            ) : invoices.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><MdReceiptLong /></div>
                <div className="empty-state-title">{translateText('No invoices yet')}</div>
                <p className="empty-state-text">
                  {translateText('When the administration issues fees, they will appear here.')}
                </p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{translateText('Invoice')}</th>
                    <th>{translateText('Status')}</th>
                    <th>{translateText('Total')}</th>
                    <th>{translateText('Balance')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const bal = Number(inv.balance ?? inv.total_amount - inv.amount_paid) || 0;
                    const canPay =
                      ['issued', 'partially_paid'].includes(inv.status) && bal > 0;
                    return (
                      <tr key={inv.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{inv.invoice_number}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {inv.issue_date}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${statusBadge(inv.status)}`}>
                            {inv.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td>{formatXAF(inv.total_amount)}</td>
                        <td style={{ fontWeight: bal > 0 ? 700 : 500 }}>
                          {formatXAF(bal)}
                        </td>
                        <td>
                          {canPay && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => openPay(inv)}
                            >
                              <MdPayments size={14} /> {translateText('Pay')}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdPayments color="var(--color-primary)" /> {translateText('Payment history')}
            </span>
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {payLoading ? (
              <div className="empty-state">{translateText('Loading payments…')}</div>
            ) : payments.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><MdPayments /></div>
                <div className="empty-state-title">{translateText('No payments yet')}</div>
              </div>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="list-row">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      {formatXAF(p.amount)}
                      <span className={`badge ${statusBadge(p.status)}`} style={{ marginLeft: 8 }}>
                        {p.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                      {p.payment_reference}
                      {p.receipt_number ? ` · ${p.receipt_number}` : ''}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {p.method?.replace('_', ' ')} ·{' '}
                      {p.paid_at
                        ? new Date(p.paid_at).toLocaleString()
                        : new Date(p.created_at).toLocaleString()}
                    </div>
                  </div>
                  {p.status === 'completed' && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => printQuitus(p, studentProfile)}
                      title={translateText('Print quitus')}
                    >
                      <MdPrint size={14} /> {translateText('Quitus')}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {payInvoice && (
        <Modal
          title={translateText('Pay invoice') + ` ${payInvoice.invoice_number}`}
          onClose={() => setPayInvoice(null)}
        >
          <form onSubmit={submitPayment} className="form-stack">
            <div className="form-group">
              <label>{translateText('Amount (XAF)')}</label>
              <input
                type="number"
                min="1"
                step="1"
                className="form-control"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>{translateText('Payment method')}</label>
              <select
                className="form-control"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            {(payMethod === 'mtn_momo' || payMethod === 'orange_money') && (
              <div className="form-group">
                <label>
                  <MdPhoneAndroid style={{ verticalAlign: 'middle' }} />{' '}
                  {translateText('Mobile Money phone number')}
                </label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="6XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            )}
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              {translateText(
                'After you confirm, complete the MoMo prompt on your phone. Finance will mark the payment completed, then you can print your quitus.',
              )}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setPayInvoice(null)}>
                {translateText('Cancel')}
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={payMutation.isPending}
              >
                <MdPayments />{' '}
                {payMutation.isPending
                  ? translateText('Processing…')
                  : translateText('Confirm payment')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
