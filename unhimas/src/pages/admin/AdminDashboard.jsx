import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  MdSchool,
  MdPersonPin,
  MdApartment,
  MdGroups,
  MdBook,
  MdAssignmentLate,
  MdAssignmentTurnedIn,
  MdAccessTime,
  MdArrowForward,
  MdAdd,
  MdRefresh,
  MdHistory,
  MdCheckCircle,
} from 'react-icons/md';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
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
    queryFn: () => getRecentAuditLogs(8),
  });

  const formattedDate = new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const markStatusData = [
    { name: translateText('Pending Review'), value: stats.pendingMarkSubmissions || 0, color: '#B70032' },
    { name: translateText('Published'), value: stats.publishedResults || 0, color: '#10B981' },
    { name: translateText('Batches'), value: stats.totalBatches || 0, color: '#112F42' },
  ].filter((item) => item.value > 0);

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

      <div className="quick-actions-bar animate-fade-up" style={{ marginBottom: '1.25rem' }}>
        <div className="quick-actions-label">{translateText('What do you need to do?')}</div>
        <div className="quick-actions-row">
          <Link to="/admin/students" className="quick-action-chip">
            <MdSchool /> {translateText('Register a student')}
          </Link>
          <Link to="/admin/batches" className="quick-action-chip">
            <MdGroups /> {translateText('Manage batches')}
          </Link>
          <Link to="/admin/mark-approval" className="quick-action-chip accent">
            <MdAssignmentLate /> {translateText('Approve marks')}
          </Link>
          <Link to="/admin/class-sessions" className="quick-action-chip">
            <MdAccessTime /> {translateText('Class sessions')}
          </Link>
          <Link to="/admin/announcements" className="quick-action-chip">
            <MdAdd /> {translateText('Post announcement')}
          </Link>
        </div>
      </div>

      <div className="stats-grid animate-stagger">
        <div className="stat-card">
          <div className="stat-card-icon blue"><MdSchool /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '…' : stats.totalStudents ?? 0}</div>
            <div className="stat-card-label">{translateText('Students')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/students" style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                {translateText('Student registry')} <MdArrowForward style={{ fontSize: '0.85rem' }} />
              </Link>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon purple"><MdPersonPin /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '…' : stats.totalLecturers ?? 0}</div>
            <div className="stat-card-label">{translateText('Lecturers')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/lecturers" style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                {translateText('Faculty list')} <MdArrowForward style={{ fontSize: '0.85rem' }} />
              </Link>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon teal"><MdApartment /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '…' : stats.totalDepartments ?? 0}</div>
            <div className="stat-card-label">{translateText('Departments')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/departments" style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                {translateText('Structure')} <MdArrowForward style={{ fontSize: '0.85rem' }} />
              </Link>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon indigo"><MdBook /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '…' : stats.totalCourses ?? 0}</div>
            <div className="stat-card-label">{translateText('Courses')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/courses" style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                {translateText('Course list')} <MdArrowForward style={{ fontSize: '0.85rem' }} />
              </Link>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon red"><MdAssignmentLate /></div>
          <div className="stat-card-body">
            <div className="stat-card-value" style={{ color: stats.pendingMarkSubmissions > 0 ? 'var(--color-secondary)' : 'inherit' }}>
              {statsLoading ? '…' : stats.pendingMarkSubmissions ?? 0}
            </div>
            <div className="stat-card-label">{translateText('Pending Mark Approvals')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/mark-approval" style={{ color: 'var(--color-secondary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                {translateText('Review now')} <MdArrowForward style={{ fontSize: '0.85rem' }} />
              </Link>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon green"><MdAssignmentTurnedIn /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '…' : stats.publishedResults ?? 0}</div>
            <div className="stat-card-label">{translateText('Published Marksheets')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/results" style={{ color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                {translateText('View results')} <MdArrowForward style={{ fontSize: '0.85rem' }} />
              </Link>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon amber"><MdAccessTime /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '…' : stats.activeLecturerShifts ?? 0}</div>
            <div className="stat-card-label">{translateText('Lecturers Clocked In')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/lecturer-attendance" style={{ color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                {translateText('Campus clock-in')} <MdArrowForward style={{ fontSize: '0.85rem' }} />
              </Link>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon blue"><MdGroups /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '…' : stats.totalBatches ?? 0}</div>
            <div className="stat-card-label">{translateText('Active Batches')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/batches" style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                {translateText('View batches')} <MdArrowForward style={{ fontSize: '0.85rem' }} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-dashboard-grid-2-1 animate-stagger" style={{ marginTop: '1.25rem' }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">{translateText('Student Enrollment by Department')}</div>
            <span className="badge badge-gray">{translateText('Academic Distribution')}</span>
          </div>
          <div className="card-body" style={{ height: 300 }}>
            {deptLoading ? (
              <div className="empty-state"><div className="empty-state-text">{translateText('Loading department metrics...')}</div></div>
            ) : deptEnrollment.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">{translateText('No Department Data')}</div>
                <div className="empty-state-text">{translateText('Add departments and enroll students to see enrollment charts.')}</div>
                <Link to="/admin/departments" className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }}>
                  {translateText('Go to Departments')}
                </Link>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptEnrollment} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '0.8125rem' }}
                    formatter={(value, _name, item) => [`${value} students`, item.payload.fullName]}
                  />
                  <Bar dataKey="students" radius={[4, 4, 0, 0]}>
                    {deptEnrollment.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">{translateText('Operations Ratio')}</div>
            <span className="badge badge-green">{translateText('Live Pipeline')}</span>
          </div>
          <div className="card-body" style={{ height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {markStatusData.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">{translateText('No Operations Pipeline Yet')}</div>
                <div className="empty-state-text">{translateText('Marks and batches will populate this ratio.')}</div>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="70%">
                  <PieChart>
                    <Pie data={markStatusData} innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                      {markStatusData.map((entry, index) => (
                        <Cell key={`slice-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '0.8125rem' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem', fontSize: '0.75rem' }}>
                  {markStatusData.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                      <span>{item.name}: <strong>{item.value}</strong></span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1.25rem', marginTop: '1.25rem' }} className="animate-stagger">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                {translateText('Current Lecturer Campus Presence')}
              </div>
              <Link to="/admin/lecturer-attendance" className="btn btn-ghost btn-sm">
                {translateText('View Register')} <MdArrowForward />
              </Link>
            </div>
            <div className="card-body" style={{ padding: '0.5rem 0' }}>
              {shiftsLoading ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  {translateText('Checking active shifts...')}
                </div>
              ) : liveShifts.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <div className="empty-state-title">{translateText('No Lecturers Currently Clocked In')}</div>
                  <div className="empty-state-text">
                    {translateText('Administrators register lecturer check-ins upon campus arrival.')}
                  </div>
                  <Link to="/admin/lecturer-attendance" className="btn btn-outline btn-sm" style={{ marginTop: '0.75rem' }}>
                    {translateText('Open clock-in terminal')}
                  </Link>
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
                        padding: '0.65rem 1rem',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <div>
                        <strong>
                          {shift.lecturers?.first_name} {shift.lecturers?.last_name}
                        </strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {shift.lecturers?.staff_id || '—'}
                        </div>
                      </div>
                      <span className="badge badge-green">
                        <MdCheckCircle style={{ verticalAlign: 'middle' }} /> {translateText('Clocked in')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">{translateText('Approval Queue')}</div>
              <Link to="/admin/mark-approval" className="btn btn-ghost btn-sm">
                {translateText('Open queue')} <MdArrowForward />
              </Link>
            </div>
            <div className="card-body" style={{ padding: '0.5rem 0' }}>
              {marksLoading ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  {translateText('Loading queue…')}
                </div>
              ) : pendingMarks.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <div className="empty-state-title">{translateText('All caught up')}</div>
                  <div className="empty-state-text">{translateText('No pending mark submissions awaiting review.')}</div>
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
                        padding: '0.65rem 1rem',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <div>
                        <strong>{item.batch_courses?.courses?.code || '—'}</strong>{' '}
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                          {item.batch_courses?.courses?.name}
                        </span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
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
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <MdHistory /> {translateText('Recent activity')}
            </div>
            <Link to="/admin/audit-log" className="btn btn-ghost btn-sm">
              {translateText('Audit log')} <MdArrowForward />
            </Link>
          </div>
          <div className="card-body" style={{ padding: '0.5rem 0' }}>
            {auditLoading ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                {translateText('Loading…')}
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                <div className="empty-state-title">{translateText('No recent activity')}</div>
                <div className="empty-state-text">{translateText('Admin actions will appear here as they happen.')}</div>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {auditLogs.map((log) => (
                  <li
                    key={log.id}
                    style={{
                      padding: '0.65rem 1rem',
                      borderBottom: '1px solid var(--color-border)',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{log.action || log.event_type || '—'}</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                      {log.table_name || log.entity || ''}{' '}
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB')
                        : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
