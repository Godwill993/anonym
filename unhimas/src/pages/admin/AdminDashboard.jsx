import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  MdSchool,
  MdPersonPin,
  MdAssignmentLate,
  MdAccessTime,
  MdArrowForward,
  MdRefresh,
  MdCheckCircle,
  MdHowToReg,
  MdPayments,
  MdReceiptLong,
  MdGrade,
  MdBarChart,
  MdLogin,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useTranslation } from '../../i18n';
import {
  getAdminOverviewStats,
  getLiveLecturerPresence,
  getPendingSubmissionsList,
} from '../../services/adminService';
import {
  getDepartmentEnrollment,
  getMarkStatusBreakdown,
  getFeeCollectionSnapshot,
} from '../../services/dashboardAnalytics';
import {
  ChartCard,
  EnrollmentBarChart,
  StatusPieChart,
  FinanceBarChart,
} from '../../components/charts/DashboardCharts';

/** Highest-impact daily destinations (single row, max 8). */
const QUICK_ACTIONS = [
  { to: '/admin/mark-approval', label: 'Approve marks', icon: MdGrade, accent: true },
  { to: '/admin/admissions', label: 'Admissions', icon: MdHowToReg },
  { to: '/admin/fees', label: 'Fees', icon: MdPayments },
  { to: '/admin/payments', label: 'Payments', icon: MdReceiptLong },
  { to: '/admin/students', label: 'Students', icon: MdSchool },
  { to: '/admin/lecturers', label: 'Lecturers', icon: MdPersonPin },
  { to: '/admin/results', label: 'Results', icon: MdBarChart },
  { to: '/admin/lecturer-attendance', label: 'Clock-in', icon: MdLogin },
];

export default function AdminDashboard() {
  const { language, translateText } = useTranslation();
  const {
    data: stats = {},
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['admin-overview-stats'],
    queryFn: getAdminOverviewStats,
  });

  const { data: liveShifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['admin-live-shifts'],
    queryFn: getLiveLecturerPresence,
  });

  const { data: pendingMarks = [], isLoading: marksLoading } = useQuery({
    queryKey: ['admin-pending-marks'],
    queryFn: getPendingSubmissionsList,
  });

  const { data: enrollment = [], isLoading: enrollLoading } = useQuery({
    queryKey: ['admin-dept-enrollment'],
    queryFn: getDepartmentEnrollment,
  });

  const { data: markStatus = [], isLoading: markStatusLoading } = useQuery({
    queryKey: ['admin-mark-status'],
    queryFn: getMarkStatusBreakdown,
  });

  const { data: feeSnap, isLoading: feeLoading } = useQuery({
    queryKey: ['admin-fee-snapshot'],
    queryFn: getFeeCollectionSnapshot,
  });

  const formattedDate = new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const feeChartData = feeSnap
    ? [
        {
          name: translateText('Fees'),
          invoiced: feeSnap.invoiced,
          paid: feeSnap.paid,
          outstanding: feeSnap.outstanding,
        },
      ]
    : [];

  const refreshAll = () => {
    refetchStats();
  };

  return (
    <AppLayout pageTitle="Admin Dashboard">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Dashboard')}</h1>
          <p className="page-subtitle">{formattedDate}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={refreshAll}>
            <MdRefresh aria-hidden="true" />
          </button>
          <Link to="/admin/create-account" className="btn btn-primary btn-sm">
            {translateText('Create Account')}
          </Link>
        </div>
      </div>

      <section className="quick-actions-bar" aria-label={translateText('Quick access')}>
        <div className="quick-actions-row">
          {QUICK_ACTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`quick-action-chip${item.accent ? ' accent' : ''}`}
              >
                <Icon aria-hidden="true" />
                {translateText(item.label)}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="stats-grid animate-stagger" style={{ marginTop: '1.25rem' }}>
        <div className="stat-card">
          <div className="stat-card-icon blue">
            <MdSchool aria-hidden="true" />
          </div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '…' : stats.totalStudents ?? 0}</div>
            <div className="stat-card-label">{translateText('Students')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/students">
                {translateText('Open')} <MdArrowForward style={{ fontSize: '0.85rem' }} />
              </Link>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon purple">
            <MdPersonPin aria-hidden="true" />
          </div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '…' : stats.totalLecturers ?? 0}</div>
            <div className="stat-card-label">{translateText('Lecturers')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/lecturers">
                {translateText('Open')} <MdArrowForward style={{ fontSize: '0.85rem' }} />
              </Link>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon red">
            <MdAssignmentLate aria-hidden="true" />
          </div>
          <div className="stat-card-body">
            <div
              className="stat-card-value"
              style={{
                color: stats.pendingMarkSubmissions > 0 ? 'var(--color-secondary)' : 'inherit',
              }}
            >
              {statsLoading ? '…' : stats.pendingMarkSubmissions ?? 0}
            </div>
            <div className="stat-card-label">{translateText('Pending marks')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/mark-approval">
                {translateText('Review')} <MdArrowForward style={{ fontSize: '0.85rem' }} />
              </Link>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon amber">
            <MdAccessTime aria-hidden="true" />
          </div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '…' : stats.activeLecturerShifts ?? 0}</div>
            <div className="stat-card-label">{translateText('Clocked in')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/lecturer-attendance">
                {translateText('Clock-in')} <MdArrowForward style={{ fontSize: '0.85rem' }} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-charts-grid" style={{ marginTop: '1.25rem' }}>
        <ChartCard
          title={translateText('Students by department')}
          subtitle={translateText('Active enrollment mix')}
          height={240}
        >
          {enrollLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              {translateText('Loading…')}
            </div>
          ) : (
            <EnrollmentBarChart
              data={enrollment}
              emptyLabel={translateText('No enrollment data')}
            />
          )}
        </ChartCard>

        <ChartCard
          title={translateText('Marks pipeline')}
          subtitle={translateText('Submission workflow')}
          height={240}
        >
          {markStatusLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              {translateText('Loading…')}
            </div>
          ) : (
            <StatusPieChart
              data={markStatus.map((r) => ({
                ...r,
                label: translateText(r.label),
              }))}
              emptyLabel={translateText('No mark submissions yet')}
            />
          )}
        </ChartCard>

        <ChartCard
          title={translateText('Fee collection')}
          subtitle={translateText('Invoiced · paid · outstanding')}
          height={240}
        >
          {feeLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              {translateText('Loading…')}
            </div>
          ) : (
            <FinanceBarChart data={feeChartData} emptyLabel={translateText('No fee data yet')} />
          )}
        </ChartCard>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: '1rem',
          marginTop: '1.25rem',
        }}
        className="animate-stagger dashboard-queues"
      >
        <div className="card">
          <div className="card-header">
            <div className="card-title">{translateText('Approval queue')}</div>
            <Link to="/admin/mark-approval" className="btn btn-ghost btn-sm">
              {translateText('Open')} <MdArrowForward aria-hidden="true" />
            </Link>
          </div>
          <div className="card-body" style={{ padding: '0.25rem 0' }}>
            {marksLoading ? (
              <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>
                {translateText('Loading…')}
              </div>
            ) : pendingMarks.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.5rem 1rem' }}>
                <div className="empty-state-title">{translateText('All caught up')}</div>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {pendingMarks.slice(0, 6).map((item) => (
                  <li
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      padding: '0.55rem 1rem',
                      borderBottom: '1px solid var(--color-border)',
                      fontSize: '0.875rem',
                    }}
                  >
                    <span>
                      <strong>{item.batch_courses?.courses?.code || '—'}</strong>{' '}
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        {item.batch_courses?.courses?.name}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">{translateText('On campus')}</div>
            <Link to="/admin/lecturer-attendance" className="btn btn-ghost btn-sm">
              {translateText('Open')} <MdArrowForward aria-hidden="true" />
            </Link>
          </div>
          <div className="card-body" style={{ padding: '0.25rem 0' }}>
            {shiftsLoading ? (
              <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>
                {translateText('Loading…')}
              </div>
            ) : liveShifts.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.5rem 1rem' }}>
                <div className="empty-state-title">{translateText('No one clocked in')}</div>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {liveShifts.slice(0, 8).map((shift) => (
                  <li
                    key={shift.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.55rem 1rem',
                      borderBottom: '1px solid var(--color-border)',
                      fontSize: '0.875rem',
                    }}
                  >
                    <span>
                      {shift.lecturers?.first_name} {shift.lecturers?.last_name}
                    </span>
                    <span className="badge badge-green">
                      <MdCheckCircle style={{ verticalAlign: 'middle' }} aria-hidden="true" />{' '}
                      {translateText('In')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .dashboard-charts-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }
        @media (max-width: 1100px) {
          .dashboard-charts-grid {
            grid-template-columns: minmax(0, 1fr);
          }
          .dashboard-queues {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </AppLayout>
  );
}
