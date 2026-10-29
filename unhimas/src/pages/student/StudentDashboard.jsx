import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  MdBook,
  MdHowToReg,
  MdAssignment,
  MdNotifications,
  MdWarning,
  MdRefresh,
  MdTrendingUp,
  MdSchedule,
  MdVideocam,
  MdDescription,
  MdEventNote,
  MdArrowForward,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import {
  getMyStudentProfile,
  getStudentDashboardStats,
  getStudentNotifications,
  getMyUpcomingSessions,
} from '../../services/studentService';

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
    ]);
  };

  if (stuLoading) {
    return (
      <AppLayout pageTitle="Student Dashboard">
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">{translateText('My Dashboard')}</h1>
            <p className="page-subtitle">{translateText('Loading your profile…')}</p>
          </div>
        </div>
        <div className="stats-grid animate-stagger">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <StatSkeleton key={i} />
          ))}
        </div>
      </AppLayout>
    );
  }

  if (stuError) {
    return (
      <AppLayout pageTitle="Student Dashboard">
        <div className="empty-state" role="alert">
          <div className="empty-state-icon">
            <MdWarning />
          </div>
          <div className="empty-state-title">
            {translateText(
              stuError.code === 'PGRST116' ? 'Profile Not Linked' : 'Profile Unavailable',
            )}
          </div>
          <p className="empty-state-text">
            {stuError.code === 'PGRST116'
              ? translateText(
                  'Your account is not yet linked to a student profile. Please contact the administrator.',
                )
              : translateText(
                  'Your student profile could not be loaded. Check your connection and try again.',
                )}
          </p>
          {stuError.code !== 'PGRST116' && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => refetchProfile()}>
              <MdRefresh /> {translateText('Try again')}
            </button>
          )}
        </div>
      </AppLayout>
    );
  }

  const firstName = studentProfile?.first_name || translateText('Student');
  const dept = studentProfile?.batches?.departments?.name || '';
  const batchName = studentProfile?.batches?.name || '';

  const attendanceThreshold = stats?.attendanceThreshold ?? 75;
  const lowAttendance =
    stats?.attendancePct != null && stats.attendancePct < attendanceThreshold;

  return (
    <AppLayout pageTitle="Student Dashboard">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            {translateText('Welcome')}, {firstName}
          </h1>
          <p className="page-subtitle">{formattedDate}</p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={refreshDashboard}
            aria-label={translateText('Refresh')}
          >
            <MdRefresh /> {translateText('Refresh')}
          </button>
        </div>
      </div>

      <div className="student-id-banner">
        <div>
          <div className="student-id-banner-label">{translateText('Student')}</div>
          <div className="student-id-banner-name">
            {studentProfile?.first_name}{' '}
            {studentProfile?.middle_name ? `${studentProfile.middle_name} ` : ''}
            {studentProfile?.last_name}
          </div>
          <div className="student-id-banner-meta">{studentProfile?.matricule}</div>
        </div>
        <div className="student-id-banner-right">
          <div className="student-id-banner-label">{dept || '—'}</div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem', marginTop: 4 }}>
            {batchName}
          </div>
          {studentProfile?.batches?.academic_years?.name && (
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginTop: 4 }}>
              {studentProfile.batches.academic_years.name}
            </div>
          )}
        </div>
      </div>

      <div className="quick-actions-bar animate-fade-up" style={{ marginBottom: '1.35rem' }}>
        <div className="quick-actions-label">{translateText('Quick links')}</div>
        <div className="quick-actions-row">
          <Link to="/student/courses" className="quick-action-chip">
            <MdBook /> {translateText('My Courses')}
          </Link>
          <Link to="/student/attendance" className="quick-action-chip">
            <MdHowToReg /> {translateText('Attendance')}
          </Link>
          <Link to="/student/results" className="quick-action-chip">
            <MdAssignment /> {translateText('Results')}
          </Link>
          <Link to="/student/timetable" className="quick-action-chip">
            <MdSchedule /> {translateText('Timetable')}
          </Link>
          <Link to="/student/resources" className="quick-action-chip">
            <MdDescription /> {translateText('Resources')}
          </Link>
          <Link to="/student/notifications" className="quick-action-chip accent">
            <MdNotifications /> {translateText('Notifications')}
          </Link>
        </div>
      </div>

      {lowAttendance && (
        <div className="alert-banner alert-banner-danger" role="status">
          <MdWarning size={20} style={{ flexShrink: 0 }} />
          <span>
            {translateText('Your overall attendance is below')} {attendanceThreshold}% (
            {stats.attendancePct}%). {translateText('Please attend more classes.')}
          </span>
          <Link to="/student/attendance" style={{ color: 'var(--color-secondary)' }}>
            {translateText('View')} →
          </Link>
        </div>
      )}

      <div className="stats-grid animate-stagger">
        {statsLoading ? (
          [1, 2, 3, 4, 5, 6].map((i) => <StatSkeleton key={i} />)
        ) : statsError ? (
          <div className="empty-state" role="alert" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-state-icon">
              <MdWarning />
            </div>
            <div className="empty-state-title">
              {translateText('Academic summary unavailable')}
            </div>
            <p className="empty-state-text">
              {translateText(
                'Your metrics could not be retrieved. No estimated results or GPA are shown.',
              )}
            </p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => refetchStats()}>
              <MdRefresh /> {translateText('Try again')}
            </button>
          </div>
        ) : (
          <>
            <StatCard
              icon={<MdBook />}
              value={stats.totalCourses}
              label="My Courses"
              color="blue"
              link="/student/courses"
            />
            <StatCard
              icon={<MdHowToReg />}
              value={stats.attendancePct !== null ? stats.attendancePct : '—'}
              label="Attendance Rate"
              color={lowAttendance ? 'red' : 'green'}
              link="/student/attendance"
              suffix="%"
            />
            <StatCard
              icon={<MdAssignment />}
              value={stats.publishedResults}
              label="Published Results"
              color="blue"
              link="/student/results"
            />
            <StatCard
              icon={<MdTrendingUp />}
              value={stats.gpa !== null ? stats.gpa : '—'}
              label={stats.gpaScope || 'GPA'}
              color="amber"
              link="/student/results"
            />
            <StatCard
              icon={<MdDescription />}
              value={stats.publishedResults > 0 ? translateText('Open') : '—'}
              label="Official Transcript"
              color="purple"
              link="/student/transcript"
            />
            <StatCard
              icon={<MdNotifications />}
              value={stats.unreadNotifications}
              label="Unread Notifications"
              color={stats.unreadNotifications > 0 ? 'red' : 'blue'}
              link="/student/notifications"
            />
          </>
        )}
      </div>

      {stats?.currentSemester && (
        <p className="page-subtitle" style={{ margin: '0 0 1.35rem' }}>
          {translateText('Current semester:')} {stats.currentSemester.name}
          {stats.currentSemester.academic_years?.name
            ? ` · ${stats.currentSemester.academic_years.name}`
            : ''}
        </p>
      )}

      <div className="student-dashboard-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdNotifications color="var(--color-primary)" /> {translateText('Notifications')}
            </span>
            <Link
              to="/student/notifications"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.8rem' }}
            >
              {translateText('View all')} <MdArrowForward size={14} />
            </Link>
          </div>
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {notifsLoading ? (
              <div style={{ padding: '1.15rem 1.25rem' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div className="skeleton skeleton-text" style={{ width: '75%', marginBottom: 6 }} />
                    <div className="skeleton skeleton-text" style={{ width: '50%' }} />
                  </div>
                ))}
              </div>
            ) : notificationsError ? (
              <div className="empty-state" role="alert">
                <div className="empty-state-title">{translateText('Notifications unavailable')}</div>
                <p className="empty-state-text">
                  {translateText('Your notifications could not be loaded.')}
                </p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <MdNotifications />
                </div>
                <div className="empty-state-title">{translateText('No notifications')}</div>
                <p className="empty-state-text">{translateText("You're all caught up!")}</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`list-row ${!n.is_read ? 'list-row-unread' : ''}`}
                >
                  {!n.is_read && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--color-secondary)',
                        flexShrink: 0,
                        marginTop: 6,
                      }}
                    />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontWeight: n.is_read ? 500 : 700,
                        fontSize: '0.875rem',
                        lineHeight: 1.35,
                      }}
                    >
                      {n.title}
                    </div>
                    {n.message && (
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--color-text-muted)',
                          marginTop: 4,
                          lineHeight: 1.4,
                        }}
                      >
                        {n.message}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--color-text-muted)',
                        marginTop: 6,
                      }}
                    >
                      {fmtDate(n.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdSchedule color="var(--color-primary)" /> {translateText('Upcoming Classes')}
            </span>
            <Link
              to="/student/timetable"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.8rem' }}
            >
              {translateText('Timetable')} <MdArrowForward size={14} />
            </Link>
          </div>
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {sessionsLoading ? (
              <div style={{ padding: '1.15rem 1.25rem' }}>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="skeleton skeleton-text"
                    style={{ height: 40, marginBottom: 12 }}
                  />
                ))}
              </div>
            ) : sessionsError ? (
              <div className="empty-state" role="alert">
                <div className="empty-state-title">{translateText('Timetable unavailable')}</div>
                <p className="empty-state-text">
                  {translateText('Upcoming classes could not be loaded.')}
                </p>
              </div>
            ) : upcomingSessions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <MdEventNote />
                </div>
                <div className="empty-state-title">{translateText('No upcoming classes')}</div>
                <p className="empty-state-text">
                  {translateText('Nothing scheduled for the next few days.')}
                </p>
              </div>
            ) : (
              upcomingSessions.map((classSession) => (
                <div key={classSession.id} className="list-row">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                        lineHeight: 1.35,
                      }}
                    >
                      <span>
                        {classSession.batch_courses?.courses?.code} —{' '}
                        {classSession.batch_courses?.courses?.name}
                      </span>
                      {classSession.zoom_join_url && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            background: '#2d8cff',
                            color: '#fff',
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontWeight: 700,
                          }}
                        >
                          ONLINE
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--color-text-muted)',
                        marginTop: 4,
                      }}
                    >
                      {new Date(classSession.scheduled_start).toLocaleString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {classSession.room ? ` · ${classSession.room}` : ''}
                    </div>
                    {classSession.batch_courses?.lecturers && (
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--color-text-muted)',
                          marginTop: 3,
                        }}
                      >
                        {classSession.batch_courses.lecturers.first_name}{' '}
                        {classSession.batch_courses.lecturers.last_name}
                      </div>
                    )}
                    {classSession.zoom_join_url && (
                      <div style={{ marginTop: 10 }}>
                        <a
                          href={classSession.zoom_join_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary btn-sm"
                          style={{
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <MdVideocam size={14} /> {translateText('Join Meeting')}
                          {classSession.zoom_password
                            ? ` · pass: ${classSession.zoom_password}`
                            : ''}
                        </a>
                      </div>
                    )}
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
