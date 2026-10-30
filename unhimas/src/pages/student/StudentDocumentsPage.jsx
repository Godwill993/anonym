import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  MdDescription,
  MdPrint,
  MdSchool,
  MdPayments,
  MdReceiptLong,
  MdArticle,
  MdAccountBalanceWallet,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import ProfileUnlinkedState from '../../components/common/ProfileUnlinkedState';
import { getMyStudentProfile } from '../../services/studentService';
import {
  listInvoices,
  listPayments,
  getStudentFeeBalance,
  formatXAF,
} from '../../services/feesService';
import { checkFeeClearance } from '../../services/feeClearance';
import {
  printEnrollmentAttestation,
  printFeeStatement,
  printPaymentQuitus,
} from '../../utils/studentDocuments';

export default function StudentDocumentsPage() {
  const { translateText } = useTranslation();
  const { session } = useAuth();

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

  const { data: balance } = useQuery({
    queryKey: ['student-fee-balance', studentId],
    queryFn: () => getStudentFeeBalance(studentId),
    enabled: !!studentId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['student-invoices', studentId],
    queryFn: () => listInvoices({ studentId, limit: 40 }),
    enabled: !!studentId,
  });

  const { data: payments = [], isLoading: payLoading } = useQuery({
    queryKey: ['student-payments', studentId],
    queryFn: () => listPayments({ studentId, limit: 40 }),
    enabled: !!studentId,
  });

  const { data: clearance } = useQuery({
    queryKey: ['fee-clearance', studentId],
    queryFn: () => checkFeeClearance(studentId),
    enabled: !!studentId,
  });

  if (stuLoading) {
    return (
      <AppLayout pageTitle="Documents">
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">{translateText('My documents')}</h1>
            <p className="page-subtitle">{translateText('Loading…')}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (stuError || !studentProfile) {
    return (
      <AppLayout pageTitle="Documents">
        <ProfileUnlinkedState
          role="student"
          errorCode={stuError?.code}
          onRetry={() => refetchProfile()}
        />
      </AppLayout>
    );
  }

  const completedPayments = payments.filter((p) => p.status === 'completed');
  const outstanding = Number(balance?.outstanding_balance ?? 0);

  return (
    <AppLayout pageTitle="My documents">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('My documents')}</h1>
          <p className="page-subtitle">
            {translateText('Download enrollment proof, fee statements, and payment receipts (quitus)')}
          </p>
        </div>
      </div>

      {clearance?.required && !clearance.cleared && (
        <div className="alert-banner alert-banner-danger" style={{ marginBottom: '1rem' }} role="status">
          <MdAccountBalanceWallet size={18} aria-hidden="true" />
          <span>
            {translateText('Outstanding fees')}: <strong>{formatXAF(clearance.outstanding)}</strong>.{' '}
            {translateText('Results and transcript stay locked until clearance.')}{' '}
            <Link to="/student/fees">{translateText('Pay now')}</Link>
          </span>
        </div>
      )}

      <div className="stats-grid animate-stagger" style={{ marginBottom: '1.35rem' }}>
        <button
          type="button"
          className="stat-card"
          onClick={() => printEnrollmentAttestation(studentProfile)}
        >
          <div className="stat-card-icon blue">
            <MdSchool aria-hidden="true" />
          </div>
          <div className="stat-card-body">
            <div className="stat-card-label">{translateText('Enrollment attestation')}</div>
            <div className="entity-card-meta" style={{ marginTop: 4 }}>
              {translateText('Print certificat de scolarité')}
            </div>
          </div>
        </button>

        <button
          type="button"
          className="stat-card"
          onClick={() =>
            printFeeStatement({
              student: studentProfile,
              balance,
              invoices,
              payments,
            })
          }
        >
          <div className="stat-card-icon amber">
            <MdArticle aria-hidden="true" />
          </div>
          <div className="stat-card-body">
            <div className="stat-card-label">{translateText('Fee statement')}</div>
            <div className="entity-card-meta" style={{ marginTop: 4 }}>
              {outstanding > 0
                ? `${translateText('Balance')}: ${formatXAF(outstanding)}`
                : translateText('Account summary')}
            </div>
          </div>
        </button>

        <Link to="/student/transcript" className="stat-card">
          <div className="stat-card-icon purple">
            <MdDescription aria-hidden="true" />
          </div>
          <div className="stat-card-body">
            <div className="stat-card-label">{translateText('Official transcript')}</div>
            <div className="entity-card-meta" style={{ marginTop: 4 }}>
              {clearance?.cleared === false
                ? translateText('Requires fee clearance')
                : translateText('Published results only')}
            </div>
          </div>
        </Link>

        <Link to="/student/fees" className="stat-card">
          <div className="stat-card-icon green">
            <MdPayments aria-hidden="true" />
          </div>
          <div className="stat-card-body">
            <div className="stat-card-label">{translateText('Fees & payments')}</div>
            <div className="entity-card-meta" style={{ marginTop: 4 }}>
              {translateText('Pay and manage invoices')}
            </div>
          </div>
        </Link>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdReceiptLong color="var(--color-primary)" aria-hidden="true" />{' '}
            {translateText('Payment receipts (Quitus)')}
          </span>
        </div>
        <div className="card-body">
          {payLoading ? (
            <div className="empty-state">{translateText('Loading…')}</div>
          ) : completedPayments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">{translateText('No confirmed payments yet')}</div>
              <p className="empty-state-text">
                {translateText('After finance confirms a payment, your quitus appears here.')}
              </p>
            </div>
          ) : (
            completedPayments.map((p) => (
              <div key={p.id} className="list-row">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 650, fontSize: '0.875rem' }}>
                    {formatXAF(p.amount)}
                    {p.receipt_number ? (
                      <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
                        {' · '}{p.receipt_number}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: 2 }}>
                    {p.payment_reference} · {(p.method || '').replace(/_/g, ' ')}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => printPaymentQuitus(p, studentProfile)}
                >
                  <MdPrint aria-hidden="true" /> {translateText('Quitus')}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
