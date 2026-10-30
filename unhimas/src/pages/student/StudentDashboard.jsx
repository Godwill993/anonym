import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  MdBook,
  MdHowToReg,
  MdAssignment,
  MdNotifications,
  MdWarning,
  MdRefresh,
  MdSchedule,
  MdVideocam,
  MdEventNote,
  MdArrowForward,
  MdAccountBalanceWallet,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import ProfileUnlinkedState from '../../components/common/ProfileUnlinkedState';
import {
  getMyStudentProfile,
  getStudentDashboardStats,
  getStudentNotifications,
  getMyUpcomingSessions,
} from '../../services/studentService';
import { getStudentFeeBalance, formatXAF } from '../../services/feesService';

function StatCard({ icon, value, label, color = 'blue', link, suffix = '' }) {
  const { translateText } = useTranslation();
  const inner = (
    <div className="stat-card">
      <div className={`stat-card-icon ${color}`}>{icon}</div>
      <div className="stat-card-body">
        <div className="stat-card-value">
          {value !== null && value !== undefined ? `${value}${suffix}` : '—'}
        </div>
        <div className="stat-card-label">{translateText(label)}</div>
      </div>
    </div>
  );
  if (link) {
    return (
      <Link to={link} style={{ textDecoration: 'none', color: 'inherit' }}>
        {inner}
      </Link>
    );
  }
  return inner;
}

function StatSkeleton() {
  return (
    <div className="stat-card">
      <div className="skeleton skeleton-box" style={{ width: 44, height: 44, borderRadius: 10 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton skeleton-title" style={{ width: 56, marginBottom: 8 }} />
        <div className="skeleton skeleton-text" style={{ width: 100 }} />
      </div>
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function StudentDashboard() {
  const { language, translateText } = useTranslation();
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();
  const profileId = profile?.id;

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

  const batchId = studentProfile?.batch_id;
  const studentId = studentProfile?.id;

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['student-dashboard-stats', studentId, batchId, profileId],
    queryFn: () => getStudentDashboardStats(studentId, batchId, profileId),
    enabled: !!studentId && !!batchId && !!profileId,
  });

  const { data: feeBalance } = useQuery({
    queryKey: ['student-fee-balance', studentId],
    queryFn: () => getStudentFeeBalance(studentId),
    enabled: !!studentId,
  });

  const {
    data: notifications = [],
    isLoading: notifsLoading,
    error: notificationsError,
  } = useQuery({
    queryKey: ['student-notifications', profileId],
    queryFn: () => getStudentNotifications(profileId, { limit: 5 }),
    enabled: !!profileId,
  });

  const {
    data: upcomingSessions = [],
    isLoading: sessionsLoading,
    error: sessionsError,
  } = useQuery({
    queryKey: ['student-upcoming-sessions', batchId],
    queryFn: () => getMyUpcomingSessions(batchId),
    enabled: !!batchId,
  });

  const formattedDate = new Date().toLocaleDateString(
    language === 'fr' ? 'fr-FR' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  );

  const refreshDashboard = async () => {
    await Promise.all([
      refetchProfile(),
      refetchStats(),
      queryClient.invalidateQueries({ queryKey: ['student-notifications', profileId] }),
      queryClient.invalidateQueries({ queryKey: ['student-upcoming-sessions', batchId] }),
      queryClient.invalidateQueries({ queryKey: ['student-fee-balance', studentId] }),
    ]);
  };

  if (stuLoading) {
    return (
      <AppLayout pageTitle="Student Dashboard">
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">{translateText('My Dashboard')}</h1>
            <p className="page-subtitle">{translateText('Loading…')}</p>
          </div>
        </div>
        <div className="stats-grid animate-stagger">
          {[1, 2, 3, 4].map((i) => (
            <StatSkeleton key={i} />
          ))}
        </div>
      </AppLayout>
    );
  }

  if (stuError) {
    return (
      <AppLayout pageTitle="Student Dashboard">
        <ProfileUnlinkedState
          role="student"
          errorCode={stuError.code}
          onRetry={() => refetchProfile()}
        />
      </AppLayout>
    );
  }

  const firstName = studentProfile?.first_name || translateText('Student');
  const dept = studentProfile?.batches?.departments?.name || '';
  const batchName = studentProfile?.batches?.name || '';

  const attendanceThreshold = stats?.attendanceThreshold ?? 75;
  const lowAttendance =
    stats?.attendancePct != null && stats.attendancePct < attendanceThreshold;
  const outstanding = Number(feeBalance?.outstanding_balance ?? 0);

  return (
    <AppLayout pageTitle="Student Dashboard">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            {translateText('Welcome')}, {firstName}
          </h1>
          <p className="page-subtitle">
            {formattedDate}
            {studentProfile?.matricule ? ` · ${studentProfile.matricule}` : ''}
            {batchName ? ` · ${batchName}` : ''}
            {dept ? ` · ${dept}` : ''}
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={refreshDashboard}
            aria-label={translateText('Refresh')}
          >
            <MdRefresh />
          </button>
        </div>
      </div>

      {lowAttendance && (
        <div className="alert-banner alert-banner-danger" role="status">
          <MdWarning size={20} style={{ flexShrink: 0 }} />
          <span>
            {translateText('Your overall attendance is below')} {attendanceThreshold}% (
            {stats.attendancePct}%).
          </span>
          <Link to="/student/attendance">{translateText('View')} →</Link>
        </div>
      )}

      {outstanding > 0 && (
        <div className="alert-banner" role="status" style={{ marginBottom: '1rem' }}>
          <MdAccountBalanceWallet size={20} style={{ flexShrink: 0 }} />
          <span>
            {translateText('Outstanding fees')}: <strong>{formatXAF(outstanding)}</strong>
          </span>
          <Link to="/student/fees">{translateText('Pay now')} →</Link>
        </div>
      )}

      <div className="stats-grid animate-stagger">
        {statsLoading ? (
          [1, 2, 3, 4].map((i) => <StatSkeleton key={i} />)
        ) : statsError ? (
          <div className="empty-state" role="alert" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-state-title">{translateText('Academic summary unavailable')}</div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => refetchStats()}>
              <MdRefresh /> {translateText('Try again')}
            </button>
          </div>
        ) : (
          <>
            <StatCard icon={<MdBook />} value={stats.totalCourses} label="Courses" color="blue" link="/student/courses" />
            <StatCard
              icon={<MdHowToReg />}
              value={stats.attendancePct !== null ? stats.attendancePct : '—'}
              label="Attendance"
              color={lowAttendance ? 'red' : 'green'}
              link="/student/attendance"
              suffix="%"
            />
            <StatCard icon={<MdAssignment />} value={stats.publishedResults} label="Results" color="blue" link="/student/results" />
            <StatCard
              icon={<MdAccountBalanceWallet />}
              value={formatXAF(outstanding)}
              label="Fees due"
              color={outstanding > 0 ? 'red' : 'green'}
              link="/student/fees"
            />
          </>
        )}
      </div>

      <div className="student-dashboard-grid" style={{ marginTop: '1.25rem' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdSchedule color="var(--color-primary)" /> {translateText('Upcoming Classes')}
            </span>
            <Link to="/student/timetable" className="btn btn-ghost btn-sm" style={{ fontSize: '0.8rem' }}>
              {translateText('Timetable')} <MdArrowForward size={14} />
            </Link>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {sessionsLoading ? (
              <div style={{ padding: '1rem' }}>
                {[1, 2].map((i) => (
                  <div key={i} className="skeleton skeleton-text" style={{ height: 36, marginBottom: 10 }} />
                ))}
              </div>
            ) : sessionsError ? (
              <div className="empty-state" role="alert">
                <div className="empty-state-title">{translateText('Timetable unavailable')}</div>
              </div>
            ) : upcomingSessions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><MdEventNote /></div>
                <div className="empty-state-title">{translateText('No upcoming classes')}</div>
              </div>
            ) : (
              upcomingSessions.map((classSession) => (
                <div key={classSession.id} className="list-row">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                      {classSession.batch_courses?.courses?.code} — {classSession.batch_courses?.courses?.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                      {new Date(classSession.scheduled_start).toLocaleString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                      {classSession.room ? ` · ${classSession.room}` : ''}
                    </div>
                    {classSession.zoom_join_url && (
                      <a
                        href={classSession.zoom_join_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: 8, fontSize: '0.75rem' }}
                      >
                        <MdVideocam size={14} /> {translateText('Join Meeting')}
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdNotifications color="var(--color-primary)" /> {translateText('Notifications')}
            </span>
            <Link to="/student/notifications" className="btn btn-ghost btn-sm" style={{ fontSize: '0.8rem' }}>
              {translateText('View all')} <MdArrowForward size={14} />
            </Link>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {notifsLoading ? (
              <div style={{ padding: '1rem' }}>
                {[1, 2].map((i) => (
                  <div key={i} className="skeleton skeleton-text" style={{ width: '70%', marginBottom: 12 }} />
                ))}
              </div>
            ) : notificationsError ? (
              <div className="empty-state" role="alert">
                <div className="empty-state-title">{translateText('Notifications unavailable')}</div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">{translateText('No notifications')}</div>
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`list-row ${!n.is_read ? 'list-row-unread' : ''}`}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: n.is_read ? 500 : 700, fontSize: '0.875rem' }}>{n.title}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{fmtDate(n.created_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
