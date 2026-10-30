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
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useTranslation } from '../../i18n';
import {
  getAdminOverviewStats,
  getLiveLecturerPresence,
  getPendingSubmissionsList,
} from '../../services/adminService';

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
          <h1 className="page-title">{translateText('Dashboard')}</h1>
          <p className="page-subtitle">{formattedDate}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => refetchStats()}>
            <MdRefresh />
          </button>
          <Link to="/admin/create-account" className="btn btn-primary btn-sm">
            {translateText('Create Account')}
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
              <Link to="/admin/students">{translateText('Open')} <MdArrowForward style={{ fontSize: '0.85rem' }} /></Link>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon purple"><MdPersonPin /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '…' : stats.totalLecturers ?? 0}</div>
            <div className="stat-card-label">{translateText('Lecturers')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/lecturers">{translateText('Open')} <MdArrowForward style={{ fontSize: '0.85rem' }} /></Link>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon red"><MdAssignmentLate /></div>
          <div className="stat-card-body">
            <div className="stat-card-value" style={{ color: stats.pendingMarkSubmissions > 0 ? 'var(--color-secondary)' : 'inherit' }}>
              {statsLoading ? '…' : stats.pendingMarkSubmissions ?? 0}
            </div>
            <div className="stat-card-label">{translateText('Pending marks')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/mark-approval">{translateText('Review')} <MdArrowForward style={{ fontSize: '0.85rem' }} /></Link>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon amber"><MdAccessTime /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '…' : stats.activeLecturerShifts ?? 0}</div>
            <div className="stat-card-label">{translateText('Clocked in')}</div>
            <div className="stat-card-trend">
              <Link to="/admin/lecturer-attendance">{translateText('Clock-in')} <MdArrowForward style={{ fontSize: '0.85rem' }} /></Link>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: '1rem',
          marginTop: '1.25rem',
        }}
        className="animate-stagger"
      >
        <div className="card">
          <div className="card-header">
            <div className="card-title">{translateText('Approval queue')}</div>
            <Link to="/admin/mark-approval" className="btn btn-ghost btn-sm">
              {translateText('Open')} <MdArrowForward />
            </Link>
          </div>
          <div className="card-body" style={{ padding: '0.25rem 0' }}>
            {marksLoading ? (
              <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>{translateText('Loading…')}</div>
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
              {translateText('Open')} <MdArrowForward />
            </Link>
          </div>
          <div className="card-body" style={{ padding: '0.25rem 0' }}>
            {shiftsLoading ? (
              <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>{translateText('Loading…')}</div>
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
                      <MdCheckCircle style={{ verticalAlign: 'middle' }} /> {translateText('In')}
                    </span>
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
