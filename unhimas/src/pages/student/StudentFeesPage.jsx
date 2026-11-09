import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import {
  MdPayments,
  MdReceiptLong,
  MdAccountBalanceWallet,
  MdPhoneAndroid,
  MdCheckCircle,
  MdRefresh,
  MdInfo,
  MdDownload,
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
  formatXAF,
  PAYMENT_METHODS,
  createStudentResitInvoice,
} from '../../services/feesService';
import {
  getCurrentSemesterForStudent,
  listBatchCoursesForSemester,
} from '../../services/courseRegistrationService';
import { downloadPaymentReceipt } from '../../utils/studentDocuments';
import mtnMomoLogo from '../../assets/mtnMomo.png';
import orangeOmLogo from '../../assets/orangeOm.png';

const PAYMENT_METHOD_LOGOS = {
  mtn_momo: mtnMomoLogo,
  orange_money: orangeOmLogo,
};

const PAYMENT_TYPES = [
  { value: 'all', label: 'All invoices' },
  { value: 'school_fees', label: 'School fees' },
  { value: 'registration', label: 'Registration fee' },
  { value: 'resit', label: 'Resit fees' },
  { value: 'other', label: 'Other payments' },
];

function getInvoicePaymentType(invoice) {
  const codes = (invoice.invoice_items || [])
    .map((item) => item.fee_categories?.code?.toUpperCase())
    .filter(Boolean);
  if (codes.includes('RESIT')) return 'resit';
  if (codes.includes('REGISTRATION')) return 'registration';
  if (codes.some((code) => ['TUITION', 'SCHOOL_FEE', 'SCHOOL_FEES'].includes(code))) {
    return 'school_fees';
  }
  return 'other';
}

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

export default function StudentFeesPage() {
  const location = useLocation();
  const { translateText } = useTranslation();
  const { session } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [payInvoice, setPayInvoice] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [paymentType, setPaymentType] = useState(() =>
    PAYMENT_TYPES.some((type) => type.value === location.state?.paymentType)
      ? location.state.paymentType
      : 'all',
  );
  const [selectedResitCourseIds, setSelectedResitCourseIds] = useState([]);
  const [payMethod, setPayMethod] = useState(
    location.state?.paymentMethod === 'orange_money' ? 'orange_money' : 'mtn_momo',
  );
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

  const {
    data: eligibleResitCourses = [],
    isLoading: resitCoursesLoading,
  } = useQuery({
    queryKey: ['student-resit-fee-courses', studentId, studentProfile?.batch_id],
    enabled: !!studentId && !!studentProfile?.batch_id,
    queryFn: async () => {
      const semester = await getCurrentSemesterForStudent(studentProfile);
      if (semester?.semester_type !== 'resit') return [];
      return listBatchCoursesForSemester(
        studentProfile.batch_id,
        semester.id,
        studentId,
      );
    },
  });

  const { data: payments = [], isLoading: payLoading } = useQuery({
    queryKey: ['student-payments', studentId],
    queryFn: () => listPayments({ studentId, limit: 30 }),
    enabled: !!studentId,
  });

  const resitInvoiceMutation = useMutation({
    mutationFn: createStudentResitInvoice,
    onSuccess: (invoice) => {
      toast.success(translateText('Resit invoice created'));
      setSelectedResitCourseIds([]);
      setPaymentType('resit');
      queryClient.invalidateQueries({ queryKey: ['student-invoices', studentId] });
      openPay(invoice);
    },
    onError: (err) => {
      toast.error(err?.message || translateText('Could not create resit invoice'));
    },
  });

  function openPay(inv) {
    setPayInvoice(inv);
    const remaining = Number(inv.balance ?? inv.total_amount - inv.amount_paid) || 0;
    setPayAmount(remaining > 0 ? String(remaining) : '');
    setPayMethod(
      location.state?.paymentMethod === 'orange_money' ? 'orange_money' : 'mtn_momo',
    );
    setPhone('');
  }

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
  const needsMoMoPhone = payMethod === 'mtn_momo' || payMethod === 'orange_money';
  const visibleInvoices =
    paymentType === 'all'
      ? invoices
      : invoices.filter((invoice) => getInvoicePaymentType(invoice) === paymentType);
  const invoicedResitCourseIds = new Set(
    invoices.flatMap((invoice) =>
      (invoice.invoice_items || [])
        .map((item) => item.batch_course_id)
        .filter(Boolean),
    ),
  );
  const billableResitCourses = eligibleResitCourses.filter(
    (course) => !invoicedResitCourseIds.has(course.id),
  );

  return (
    <AppLayout pageTitle="Fees & Payments">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Fees & Payments')}</h1>
          <p className="page-subtitle">
            {translateText('View your fee balance and invoices.')}
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
            'MTN MoMo and Orange Money checkout is not configured yet. You can prepare invoices, but online payment is unavailable until gateway setup is complete.',
          )}
        </span>
      </div>

      <div
        role="group"
        aria-label={translateText('Payment type')}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '1.25rem' }}
      >
        {PAYMENT_TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            className={`btn ${paymentType === type.value ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setPaymentType(type.value)}
          >
            {translateText(type.label)}
          </button>
        ))}
      </div>

      {paymentType === 'resit' && (
        <section className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header">
            <div>
              <div className="card-title">{translateText('Eligible resit courses')}</div>
              <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                {translateText('Each eligible resit course costs')} {formatXAF(2500)}.
              </p>
            </div>
          </div>
          {resitCoursesLoading ? (
            <div className="empty-state">{translateText('Loading eligible courses…')}</div>
          ) : billableResitCourses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">
                {eligibleResitCourses.length > 0
                  ? translateText('Invoices already exist for your eligible resit courses')
                  : translateText('No courses are currently eligible for resit')}
              </div>
            </div>
          ) : (
            <div style={{ padding: '0 1rem 1rem' }}>
              <div style={{ display: 'grid', gap: 8 }}>
                {billableResitCourses.map((course) => (
                  <label
                    key={course.id}
                    className="list-row"
                    style={{ cursor: 'pointer', gap: 12 }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedResitCourseIds.includes(course.id)}
                      onChange={(event) => {
                        setSelectedResitCourseIds((current) =>
                          event.target.checked
                            ? [...current, course.id]
                            : current.filter((id) => id !== course.id),
                        );
                      }}
                    />
                    <span style={{ flex: 1 }}>
                      <strong>{course.courses?.code}</strong> — {course.courses?.name}
                    </span>
                    <strong>{formatXAF(2500)}</strong>
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 12 }}
                disabled={
                  selectedResitCourseIds.length === 0 ||
                  resitInvoiceMutation.isPending
                }
                onClick={() => resitInvoiceMutation.mutate(selectedResitCourseIds)}
              >
                {resitInvoiceMutation.isPending
                  ? translateText('Creating invoice…')
                  : `${translateText('Create resit invoice')} · ${formatXAF(selectedResitCourseIds.length * 2500)}`}
              </button>
            </div>
          )}
        </section>
      )}

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
            ) : visibleInvoices.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><MdReceiptLong /></div>
                <div className="empty-state-title">
                  {translateText(paymentType === 'all' ? 'No invoices yet' : 'No invoices for this payment type')}
                </div>
                <p className="empty-state-text">
                  {translateText(
                    paymentType === 'resit'
                      ? 'Select eligible courses above to create a resit invoice.'
                      : 'School, registration, and other fee invoices must be issued by the administration.',
                  )}
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
                  {visibleInvoices.map((inv) => {
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
                      onClick={() =>
                        downloadPaymentReceipt(
                          { ...p, student_invoices: p.student_invoices },
                          studentProfile,
                        ).catch((err) => {
                          toast.error(
                            err?.message || translateText('Could not download receipt'),
                          );
                        })
                      }
                      title={translateText('Download receipt')}
                    >
                      <MdDownload size={14} /> {translateText('Download receipt')}
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
          <form onSubmit={(event) => event.preventDefault()} className="form-stack" noValidate>
            <div className="form-group">
              <label>{translateText('Amount (XAF)')}</label>
              <input
                type="number"
                min="1"
                max={Number(payInvoice.balance ?? payInvoice.total_amount - payInvoice.amount_paid)}
                step="1"
                className="form-control"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />
              <p className="form-hint">
                {translateText('Enter any amount up to the outstanding invoice balance.')}
              </p>
            </div>
            <fieldset
              className="form-group"
              style={{ border: 0, padding: 0, marginInline: 0 }}
            >
              <legend className="form-label">{translateText('Payment method')}</legend>
              <div
                role="radiogroup"
                aria-label={translateText('Payment method')}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 8,
                }}
              >
                {PAYMENT_METHODS.filter((method) => PAYMENT_METHOD_LOGOS[method.value]).map((m) => (
                  <label
                    key={m.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      minHeight: 52,
                      padding: '8px 10px',
                      border: `1px solid ${
                        payMethod === m.value
                          ? 'var(--color-primary)'
                          : 'var(--color-border)'
                      }`,
                      borderRadius: 'var(--radius-sm)',
                      background:
                        payMethod === m.value
                          ? 'var(--color-bg)'
                          : 'var(--color-surface)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value={m.value}
                      checked={payMethod === m.value}
                      onChange={(e) => setPayMethod(e.target.value)}
                    />
                    {PAYMENT_METHOD_LOGOS[m.value] && (
                      <img
                        src={PAYMENT_METHOD_LOGOS[m.value]}
                        alt=""
                        aria-hidden="true"
                        style={{
                          width: 36,
                          height: 36,
                          objectFit: 'contain',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {needsMoMoPhone && (
              <div className="form-group">
                <label>
                  <MdPhoneAndroid style={{ verticalAlign: 'middle' }} />{' '}
                  {translateText('Mobile Money phone number')}
                </label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="6XXXXXXXX or +237 6XX XXX XXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  inputMode="tel"
                  autoComplete="tel"
                />
                <p className="form-hint" style={{ marginTop: 6, fontSize: '0.75rem' }}>
                  {translateText(
                    'Enter a Cameroon mobile number starting with 6 (nine digits).',
                  )}
                </p>
              </div>
            )}
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              {translateText(
                'Online checkout is unavailable until MTN and Orange sandbox credentials are configured. No payment will be submitted from this screen.',
              )}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setPayInvoice(null)}>
                {translateText('Cancel')}
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled
              >
                <MdPayments /> {translateText('Checkout unavailable')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
