import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  MdSchool,
  MdPersonPin,
  MdBook,
  MdAssignmentLate,
  MdAccessTime,
  MdArrowForward,
  MdAdd,
  MdRefresh,
  MdHistory,
  MdCheckCircle,
  MdGroups,
} from 'react-icons/md';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import AppLayout from '../../components/layout/AppLayout';
import { useTranslation } from '../../i18n';
import {
  getAdminOverviewStats,
  getDepartmentEnrollment,
  getLiveLecturerPresence,
  getPendingSubmissionsList,
  getRecentAuditLogs,
} from '../../services/adminService';

const CHART_COLORS = ['#112F42', '#B70032', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6'];

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

  const { data: deptEnrollment = [], isLoading: deptLoading } = useQuery({
    queryKey: ['admin-dept-enrollment'],
    queryFn: getDepartmentEnrollment,
  });

  const { data: liveShifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['admin-live-shifts'],
    queryFn: getLiveLecturerPresence,
  });

  const { data: pendingMarks = [], isLoading: marksLoading } = useQuery({
    queryKey: ['admin-pending-marks'],
    queryFn: getPendingSubmissionsList,
  });

  const { data: auditLogs = [], isLoading: auditLoading } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => getRecentAuditLogs(6),
  });

  const formattedDate = new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <AppLayout pageTitle="Admin Dashboard">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('University Administration')}</h1>
          <p className="page-subtitle">{formattedDate}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-outline" onClick={() => refetchStats()}>
            <MdRefresh /> {translateText('Refresh')}
          </button>
          <Link to="/admin/create-account" className="btn btn-primary">
            <MdAdd /> {translateText('Create Account')}
          </Link>
        </div>
      </div>

      {/* Compact stats — only high-signal metrics */}
      <div className="stats-grid animate-stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <Link to="/admin/students" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-card-icon blue"><MdSchool /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '…' : stats.totalStudents ?? 0}</div>
            <div className="stat-card-label">{translateText('Students')}</div>
          </div>
        </Link>
        <Link to="/admin/lecturers" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-card-icon purple"><MdPersonPin /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '…' : stats.totalLecturers ?? 0}</div>
            <div className="stat-card-label">{translateText('Lecturers')}</div>
          </div>
        </Link>
        <Link to="/admin/courses" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-card-icon indigo"><MdBook /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '…' : stats.totalCourses ?? 0}</div>
            <div className="stat-card-label">{translateText('Courses')}</div>
          </div>
        </Link>
        <Link to="/admin/batches" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-card-icon teal"><MdGroups /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '…' : stats.totalBatches ?? 0}</div>
            <div className="stat-card-label">{translateText('Batches')}</div>
          </div>
        </Link>
        <Link to="/admin/mark-approval" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-card-icon red"><MdAssignmentLate /></div>
          <div className="stat-card-body">
            <div
              className="stat-card-value"
              style={{ color: stats.pendingMarkSubmissions > 0 ? 'var(--color-secondary)' : 'inherit' }}
            >
              {statsLoading ? '…' : stats.pendingMarkSubmissions ?? 0}
            </div>
            <div className="stat-card-label">{translateText('Pending Marks')}</div>
          </div>
        </Link>
        <Link to="/admin/attendance" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-card-icon amber"><MdAccessTime /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '…' : stats.activeLecturerShifts ?? 0}</div>
            <div className="stat-card-label">{translateText('Clocked In')}</div>
          </div>
        </Link>
      </div>

      {/* Main content: chart + action queues */}
      <div
        className="animate-stagger"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)',
          gap: '1.25rem',
          marginTop: '1.25rem',
        }}
      >
        <div className="card">
          <div className="card-header">
            <div className="card-title">{translateText('Enrollment by Department')}</div>
            <Link to="/admin/departments" className="btn btn-ghost btn-sm">
              {translateText('Departments')} <MdArrowForward />
            </Link>
          </div>
          <div className="card-body" style={{ height: 260 }}>
            {deptLoading ? (
              <div className="empty-state">
                <div className="empty-state-text">{translateText('Loading…')}</div>
              </div>
            ) : deptEnrollment.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">{translateText('No data yet')}</div>
                <div className="empty-state-text">
                  {translateText('Add departments and enroll students to see charts.')}
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptEnrollment} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '0.8125rem',
                    }}
                    formatter={(value, _name, item) => [`${value} students`, item.payload.fullName]}
                  />
                  <Bar dataKey="students" radius={[4, 4, 0, 0]}>
                    {deptEnrollment.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <div className="card-title">{translateText('Mark approval queue')}</div>
              <Link to="/admin/mark-approval" className="btn btn-ghost btn-sm">
                {translateText('Open')} <MdArrowForward />
              </Link>
            </div>
            <div className="card-body" style={{ padding: '0.35rem 0' }}>
              {marksLoading ? (
                <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  {translateText('Loading…')}
                </div>
              ) : pendingMarks.length === 0 ? (
                <div className="empty-state" style={{ padding: '1.5rem 1rem' }}>
                  <div className="empty-state-title">{translateText('All caught up')}</div>
                  <div className="empty-state-text">{translateText('No pending mark submissions.')}</div>
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {pendingMarks.slice(0, 5).map((item) => (
                    <li
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        padding: '0.55rem 1rem',
                        borderBottom: '1px solid var(--color-border)',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <div>
                        <strong>{item.batch_courses?.courses?.code || '—'}</strong>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                          {item.batch_courses?.batches?.name || '—'}
                        </div>
                      </div>
                      <span className="badge badge-red">{translateText('Pending')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#10B981',
                    display: 'inline-block',
                  }}
                />
                {translateText('On campus')}
              </div>
              <Link to="/admin/attendance" className="btn btn-ghost btn-sm">
                {translateText('Attendance')} <MdArrowForward />
              </Link>
            </div>
            <div className="card-body" style={{ padding: '0.35rem 0' }}>
              {shiftsLoading ? (
                <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  {translateText('Loading…')}
                </div>
              ) : liveShifts.length === 0 ? (
                <div className="empty-state" style={{ padding: '1.5rem 1rem' }}>
                  <div className="empty-state-title">{translateText('No one clocked in')}</div>
                  <div className="empty-state-text">
                    {translateText('Faculty clock-ins appear here.')}
                  </div>
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {liveShifts.slice(0, 5).map((shift) => (
                    <li
                      key={shift.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.55rem 1rem',
                        borderBottom: '1px solid var(--color-border)',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <div>
                        <strong>
                          {shift.lecturers?.first_name} {shift.lecturers?.last_name}
                        </strong>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                          {shift.lecturers?.staff_id || '—'}
                        </div>
                      </div>
                      <span className="badge badge-green">
                        <MdCheckCircle style={{ verticalAlign: 'middle' }} /> {translateText('In')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity — single row */}
      <div className="card animate-stagger" style={{ marginTop: '1.25rem' }}>
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <MdHistory /> {translateText('Recent activity')}
          </div>
          <Link to="/admin/audit-log" className="btn btn-ghost btn-sm">
            {translateText('Audit log')} <MdArrowForward />
          </Link>
        </div>
        <div className="card-body" style={{ padding: '0.35rem 0' }}>
          {auditLoading ? (
            <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              {translateText('Loading…')}
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem 1rem' }}>
              <div className="empty-state-title">{translateText('No recent activity')}</div>
              <div className="empty-state-text">
                {translateText('Admin actions will appear here as they happen.')}
              </div>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {auditLogs.map((log) => (
                <li
                  key={log.id}
                  style={{
                    padding: '0.55rem 1rem',
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: '0.8125rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <strong>{log.action || log.event_type || '—'}</strong>
                    <span style={{ color: 'var(--color-text-muted)', marginLeft: 8 }}>
                      {log.table_name || log.entity || ''}
                    </span>
                  </div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                    {log.created_at
                      ? new Date(log.created_at).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB')
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
