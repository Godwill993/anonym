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

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color = 'blue', link, suffix = '' }) {
  const { translateText } = useTranslation();
  const inner = (
    <div className="stat-card">
      <div className={`stat-card-icon ${color}`}>{icon}</div>
      <div className="stat-card-body">
        <div className="stat-card-value">{value !== null && value !== undefined ? `${value}${suffix}` : '—'}</div>
        <div className="stat-card-label">{translateText(label)}</div>
      </div>
    </div>
  );
  if (link) return <Link to={link} style={{ textDecoration: 'none' }}>{inner}</Link>;
  return inner;
}

function StatSkeleton() {
  return (
    <div className="stat-card">
      <div className="skeleton skeleton-box" style={{ width: 44, height: 44, borderRadius: 8 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton skeleton-title" style={{ width: 60, marginBottom: 6 }} />
        <div className="skeleton skeleton-text" style={{ width: 120 }} />
      </div>
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Main Component ───────────────────────────────────────────────────────────

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

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['student-dashboard-stats', studentId, batchId, profileId],
    queryFn: () => getStudentDashboardStats(studentId, batchId, profileId),
    enabled: !!studentId && !!batchId && !!profileId,
  });

  const { data: notifications = [], isLoading: notifsLoading, error: notificationsError } = useQuery({
    queryKey: ['student-notifications', profileId],
    queryFn: () => getStudentNotifications(profileId, { limit: 5 }),
    enabled: !!profileId,
  });

  const { data: upcomingSessions = [], isLoading: sessionsLoading, error: sessionsError } = useQuery({
    queryKey: ['student-upcoming-sessions', batchId],
    queryFn: () => getMyUpcomingSessions(batchId),
    enabled: !!batchId,
  });

  const formattedDate = new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

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
        <div className="stats-grid">{[1, 2, 3, 4].map((i) => <StatSkeleton key={i} />)}</div>
      </AppLayout>
    );
  }

  if (stuError) {
    return (
      <AppLayout pageTitle="Student Dashboard">
        <div className="empty-state">
          <div className="empty-state-icon"><MdWarning /></div>
          <div className="empty-state-title">{translateText(stuError.code === 'PGRST116' ? 'Profile Not Linked' : 'Profile Unavailable')}</div>
          <p className="empty-state-text">
            {stuError.code === 'PGRST116'
              ? translateText('Your account is not yet linked to a student profile. Please contact the Front Desk or administrator.')
              : translateText('Your student profile could not be loaded. Check your connection and try again.')}
          </p>
          {stuError.code !== 'PGRST116' && (
            <button className="btn btn-outline btn-sm" onClick={() => refetchProfile()}>
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
  const lowAttendance = stats?.attendancePct != null && stats.attendancePct < attendanceThreshold;

  return (
    <AppLayout pageTitle="Student Dashboard">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Welcome')}, {firstName}</h1>
          <p className="page-subtitle">{formattedDate}</p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-outline btn-sm"
            onClick={refreshDashboard}
            aria-label={translateText('Refresh')}
          >
            <MdRefresh /> {translateText('Refresh')}
          </button>
        </div>
      </div>

      {/* Student ID Card */}
      <div
        style={{
          background: 'var(--color-primary)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{translateText('Student')}</div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.125rem', marginTop: 2 }}>
            {studentProfile?.first_name} {studentProfile?.middle_name ? `${studentProfile.middle_name} ` : ''}{studentProfile?.last_name}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.875rem', marginTop: 4 }}>
            {studentProfile?.matricule}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.75rem' }}>{dept}</div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem', marginTop: 2 }}>{batchName}</div>
          {studentProfile?.batches?.academic_years?.name && (
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.75rem', marginTop: 2 }}>
              {studentProfile.batches.academic_years.name}
            </div>
          )}
        </div>
      </div>

      {/* Low attendance warning */}
      {lowAttendance && (
        <div
          style={{
            background: 'rgba(183,0,50,0.06)',
            border: '1px solid rgba(183,0,50,0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1.25rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: 'var(--color-secondary)',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          <MdWarning size={20} />
          {translateText('Your overall attendance is below')} {attendanceThreshold}% ({stats.attendancePct}%). {translateText('Please attend more classes.')}
          <Link to="/student/attendance" style={{ marginLeft: 'auto', color: 'var(--color-secondary)', fontWeight: 700, fontSize: '0.8125rem' }}>
            {translateText('View')} →
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        {statsLoading ? (
          [1, 2, 3, 4, 5].map((i) => <StatSkeleton key={i} />)
        ) : statsError ? (
          <div className="empty-state" role="alert" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-state-icon"><MdWarning /></div>
            <div className="empty-state-title">{translateText('Academic summary unavailable')}</div>
            <p className="empty-state-text">{translateText('Your metrics could not be retrieved. No estimated results or GPA are shown.')}</p>
            <button className="btn btn-outline btn-sm" onClick={() => refetchStats()}>
              <MdRefresh /> {translateText('Try again')}
            </button>
          </div>
        ) : (
          <>
            <StatCard icon={<MdBook />} value={stats.totalCourses} label="My Courses" color="blue" link="/student/courses" />
            <StatCard icon={<MdHowToReg />} value={stats.attendancePct !== null ? stats.attendancePct : '—'} label="Attendance Rate" color={lowAttendance ? 'red' : 'green'} link="/student/attendance" suffix="%" />
            <StatCard icon={<MdAssignment />} value={stats.publishedResults} label="Published Results" color="blue" link="/student/results" />
            <StatCard icon={<MdTrendingUp />} value={stats.gpa !== null ? stats.gpa : '—'} label={stats.gpaScope || 'GPA'} color="amber" link="/student/results" />
            <StatCard icon={<MdAssignment />} value={stats.publishedResults > 0 ? translateText('View') : '—'} label="Official Transcript" color="blue" link="/student/transcript" />
            <StatCard icon={<MdNotifications />} value={stats.unreadNotifications} label="Unread Notifications" color={stats.unreadNotifications > 0 ? 'red' : 'blue'} />
          </>
        )}
      </div>

      {stats?.currentSemester && (
        <p className="page-subtitle" style={{ margin: '-0.5rem 0 1.25rem' }}>
          {translateText('Current semester:')} {stats.currentSemester.name} · {stats.currentSemester.academic_years?.name}
        </p>
      )}

      {/* Notifications & upcoming classes */}
      <div className="student-dashboard-grid">
        {/* Notifications */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdNotifications color="var(--color-primary)" /> Notifications
            </span>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {notifsLoading ? (
              <div style={{ padding: '1rem' }}>
                {[1, 2].map((i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div className="skeleton skeleton-text" style={{ width: '75%', marginBottom: 4 }} />
                    <div className="skeleton skeleton-text" style={{ width: '50%' }} />
                  </div>
                ))}
              </div>
            ) : notificationsError ? (
              <div className="empty-state" role="alert" style={{ padding: '2rem' }}>
                <div className="empty-state-title">Notifications unavailable</div>
                <p className="empty-state-text">Your notifications could not be loaded.</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-icon"><MdNotifications /></div>
                <div className="empty-state-title">No notifications</div>
                <p className="empty-state-text">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '0.875rem 1.25rem',
                    borderBottom: '1px solid var(--color-border)',
                    background: n.is_read ? 'transparent' : 'rgba(17,47,66,0.03)',
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                  }}
                >
                  {!n.is_read && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-secondary)', flexShrink: 0, marginTop: 5 }} />
                  )}
                  <div>
                    <div style={{ fontWeight: n.is_read ? 500 : 700, fontSize: '0.875rem' }}>{n.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{n.message}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                      {fmtDate(n.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Classes */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdSchedule color="var(--color-primary)" /> Upcoming Classes
            </span>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {sessionsLoading ? (
              <div style={{ padding: '1rem' }}>
                {[1, 2].map((i) => <div key={i} className="skeleton skeleton-text" style={{ height: 32, marginBottom: 12 }} />)}
              </div>
            ) : sessionsError ? (
              <div className="empty-state" role="alert" style={{ padding: '2rem' }}>
                <div className="empty-state-title">Timetable unavailable</div>
                <p className="empty-state-text">Upcoming classes could not be loaded.</p>
              </div>
            ) : upcomingSessions.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-icon"><MdSchedule /></div>
                <div className="empty-state-title">No upcoming classes</div>
              </div>
            ) : upcomingSessions.map((classSession) => (
              <div key={classSession.id} style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {classSession.batch_courses?.courses?.code} — {classSession.batch_courses?.courses?.name}
                  {classSession.zoom_join_url && (
                    <span style={{ fontSize: '0.65rem', background: '#2d8cff', color: '#fff', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                      ONLINE
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                  {new Date(classSession.scheduled_start).toLocaleString('en-GB', {
                    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                  {classSession.room ? ` · ${classSession.room}` : ''}
                </div>
                {classSession.batch_courses?.lecturers && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {classSession.batch_courses.lecturers.first_name} {classSession.batch_courses.lecturers.last_name}
                  </div>
                )}
                {classSession.zoom_join_url && (
                  <div style={{ marginTop: 8 }}>
                    <a
                      href={classSession.zoom_join_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <MdVideocam size={14} /> Join Meeting
                      {classSession.zoom_password ? ` · pass: ${classSession.zoom_password}` : ''}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
