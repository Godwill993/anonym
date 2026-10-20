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
          <p className="page-subtitle">{formattedDate} • {translateText('Bilingual Cameroonian Academic System')}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={() => refetchStats()} title={translateText('Refresh metrics')}>
            <MdRefresh /> {translateText('Refresh')}
          </button>
          <Link to="/admin/students" className="btn btn-primary btn-sm">
            <MdAdd /> {translateText('New Student')}
          </Link>
          <Link to="/admin/mark-approval" className="btn btn-secondary btn-sm">
            {translateText('Mark Approval')} {stats.pendingMarkSubmissions > 0 && `(${stats.pendingMarkSubmissions})`}
          </Link>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon blue"><MdSchool /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '...' : stats.totalStudents}</div>
            <div className="stat-card-label">{translateText('Total Students')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/students" style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                {translateText('View all')} <MdArrowForward style={{ fontSize: '0.85rem' }} />
              </Link>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon red"><MdPersonPin /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '...' : stats.totalLecturers}</div>
            <div className="stat-card-label">{translateText('Faculty Lecturers')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/lecturers" style={{ color: 'var(--color-secondary)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                {translateText('View staff')} <MdArrowForward style={{ fontSize: '0.85rem' }} />
              </Link>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon green"><MdApartment /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '...' : stats.totalDepartments}</div>
            <div className="stat-card-label">{translateText('Active Departments')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/departments" style={{ color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                {translateText('Manage')} <MdArrowForward style={{ fontSize: '0.85rem' }} />
              </Link>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon amber"><MdGroups /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '...' : stats.totalBatches}</div>
            <div className="stat-card-label">{translateText('Academic Batches')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/batches" style={{ color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                {translateText('Cohorts')} <MdArrowForward style={{ fontSize: '0.85rem' }} />
              </Link>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon blue"><MdBook /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '...' : stats.totalCourses}</div>
            <div className="stat-card-label">{translateText('Curriculum Courses')}</div>
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
              {statsLoading ? '...' : stats.pendingMarkSubmissions}
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
            <div className="stat-card-value">{statsLoading ? '...' : stats.publishedResults}</div>
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
            <div className="stat-card-value">{statsLoading ? '...' : stats.activeLecturerShifts}</div>
            <div className="stat-card-label">{translateText('Lecturers Clocked In')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/attendance" style={{ color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                {translateText('Front desk shift')} <MdArrowForward style={{ fontSize: '0.85rem' }} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">{translateText('Student Enrollment by Department')}</div>
            <span className="badge badge-blue">{translateText('Academic Distribution')}</span>
          </div>
          <div className="card-body" style={{ height: '300px' }}>
            {deptLoading ? (
              <div className="empty-state"><div className="empty-state-text">{translateText('Loading department metrics...')}</div></div>
            ) : deptEnrollment.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">{translateText('No Department Data')}</div>
                <div className="empty-state-text">{translateText('Add departments and enroll students to see enrollment charts.')}</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptEnrollment} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '0.8125rem' }}
                    formatter={(value, name, item) => [`${value} students`, item.payload.fullName]} />
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
          <div className="card-body" style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {markStatusData.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">{translateText('No Operations Pipeline Yet')}</div>
                <div className="empty-state-text">{translateText('Marks and batches will populate this ratio.')}</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={markStatusData} innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                    {markStatusData.map((entry, index) => (
                      <Cell key={`slice-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '0.8125rem' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem', fontSize: '0.75rem' }}>
              {markStatusData.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color }} />
                  <span>{item.name}: <strong>{item.value}</strong></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1.25rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                {translateText('Current Lecturer Campus Presence')}
              </div>
              <Link to="/admin/attendance" className="btn btn-ghost btn-sm">
                {translateText('View Register')} <MdArrowForward />
              </Link>
            </div>
            <div className="card-body" style={{ padding: '0.5rem 0' }}>
              {shiftsLoading ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>{translateText('Checking active shifts...')}</div>
              ) : liveShifts.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <div className="empty-state-title">{translateText('No Lecturers Currently Clocked In')}</div>
                  <div className="empty-state-text">{translateText('Front Desk registers lecturer check-ins upon campus arrival.')}</div>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{translateText('Lecturer')}</th>
                        <th>{translateText('Department')}</th>
                        <th>{translateText('Clock In Time')}</th>
                        <th>{translateText('Status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveShifts.map((shift) => (
                        <tr key={shift.id}>
                          <td>
                            <strong>{shift.lecturers?.first_name} {shift.lecturers?.last_name}</strong>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>ID: {shift.lecturers?.staff_id}</div>
                          </td>
                          <td>{shift.lecturers?.departments?.abbreviation || shift.lecturers?.departments?.name || '—'}</td>
                          <td>{new Date(shift.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td><span className="badge badge-green">{translateText('Clocked In')}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">{translateText('Pending Mark Approvals')}</div>
              <Link to="/admin/mark-approval" className="btn btn-ghost btn-sm">
                {translateText('Approval Queue')} <MdArrowForward />
              </Link>
            </div>
            <div className="card-body" style={{ padding: '0.5rem 0' }}>
              {marksLoading ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>{translateText('Loading submission queue...')}</div>
              ) : pendingMarks.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <MdCheckCircle style={{ fontSize: '2.5rem', color: '#10B981', marginBottom: '0.5rem' }} />
                  <div className="empty-state-title">{translateText('All Caught Up')}</div>
                  <div className="empty-state-text">{translateText('No pending mark submissions waiting for review.')}</div>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{translateText('Course')}</th>
                        <th>{translateText('Batch')}</th>
                        <th>{translateText('Lecturer')}</th>
                        <th>{translateText('Action')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingMarks.map((sub) => (
                        <tr key={sub.id}>
                          <td>
                            <strong>{sub.batch_courses?.courses?.code}</strong>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{sub.batch_courses?.courses?.name}</div>
                          </td>
                          <td>{sub.batch_courses?.batches?.name || '—'}</td>
                          <td>{sub.lecturers?.first_name} {sub.lecturers?.last_name}</td>
                          <td>
                            <Link to="/admin/mark-approval" className="btn btn-outline btn-sm">{translateText('Review now')}</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdHistory /> {translateText('Audit Log')}
            </div>
            <Link to="/admin/audit-log" className="btn btn-ghost btn-sm">
              {translateText('View all')} <MdArrowForward />
            </Link>
          </div>
          <div className="card-body" style={{ padding: '0.5rem 0' }}>
            {auditLoading ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>{translateText('Loading...')}</div>
            ) : auditLogs.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                <div className="empty-state-title">{translateText('No records found')}</div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{translateText('Action')}</th>
                      <th>{translateText('Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <strong>{log.action}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                            {log.table_name} · {log.profiles?.full_name || '—'}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {new Date(log.created_at).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
