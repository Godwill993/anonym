import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  MdBook,
  MdHowToReg,
  MdGrade,
  MdAccessTime,
  MdNotifications,
  MdWarning,
  MdCheckCircle,
  MdSchedule,
  MdArrowForward,
  MdRefresh,
  MdClass,
  MdVideocam,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { useToast } from '../../hooks/useToast';
import ProfileUnlinkedState from '../../components/common/ProfileUnlinkedState';
import {
  getMyLecturerProfile,
  getLecturerDashboardStats,
  getTodaySessions,
  getUpcomingSessions,
  getMyMarkSubmissions,
  getMyNotifications,
} from '../../services/lecturerService';
import { createZoomMeeting } from '../../services/zoomService';

function fmtTime(iso) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' });
}

function statusBadge(status) {
  const map = {
    draft: { cls: 'badge-gray', label: 'Draft' },
    submitted: { cls: 'badge-blue', label: 'Submitted' },
    returned: { cls: 'badge-red', label: 'Returned' },
    approved: { cls: 'badge-green', label: 'Approved' },
    published: { cls: 'badge-purple', label: 'Published' },
  };
  const s = map[status] || { cls: 'badge-gray', label: status };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

function StatCard({ icon, value, label, color = 'blue', link, alert }) {
  const { translateText } = useTranslation();
  const inner = (
    <div className="stat-card" style={alert ? { borderLeft: '3px solid var(--color-secondary)' } : {}}>
      <div className={`stat-card-icon ${color}`}>{icon}</div>
      <div className="stat-card-body">
        <div className="stat-card-value">{value ?? '—'}</div>
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

export default function LecturerDashboard() {
  const { language, translateText } = useTranslation();
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [zoomLoading, setZoomLoading] = useState(null);

  const {
    data: lecturerProfile,
    isLoading: lecLoading,
    error: lecError,
    refetch: refetchLecturerProfile,
  } = useQuery({
    queryKey: ['my-lecturer-profile'],
    queryFn: getMyLecturerProfile,
    enabled: !!session,
  });

  const lecturerId = lecturerProfile?.id;
  const profileId = profile?.id;

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['lecturer-dashboard-stats', lecturerId, profileId],
    queryFn: () => getLecturerDashboardStats(lecturerId, profileId),
    enabled: !!lecturerId && !!profileId,
    retry: 1,
  });

  const { data: todaySessions = [], isLoading: sessionsLoading, error: sessionsError, refetch: refetchToday } = useQuery({
    queryKey: ['lecturer-today-sessions', lecturerId],
    queryFn: () => getTodaySessions(lecturerId),
    enabled: !!lecturerId,
    retry: 1,
  });

  const { data: upcomingSessions = [], isLoading: upcomingLoading } = useQuery({
    queryKey: ['lecturer-upcoming-sessions', lecturerId],
    queryFn: () => getUpcomingSessions(lecturerId),
    enabled: !!lecturerId,
    retry: 1,
  });

  const { data: markSubmissions = [], isLoading: marksLoading, error: marksError } = useQuery({
    queryKey: ['my-mark-submissions', lecturerId],
    queryFn: () => getMyMarkSubmissions(lecturerId),
    enabled: !!lecturerId,
    retry: 1,
  });

  const { data: notifications = [], isLoading: notifsLoading } = useQuery({
    queryKey: ['my-notifications', profileId],
    queryFn: () => getMyNotifications(profileId, { limit: 5 }),
    enabled: !!profileId,
    retry: 1,
  });

  const formattedDate = new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const refreshDashboard = async () => {
    await Promise.all([
      refetchLecturerProfile(),
      refetchStats(),
      queryClient.invalidateQueries({ queryKey: ['lecturer-today-sessions', lecturerId] }),
      queryClient.invalidateQueries({ queryKey: ['lecturer-upcoming-sessions', lecturerId] }),
      queryClient.invalidateQueries({ queryKey: ['my-mark-submissions', lecturerId] }),
      queryClient.invalidateQueries({ queryKey: ['my-notifications', profileId] }),
    ]);
  };

  const handleAddZoom = async (s) => {
    if (!s?.id) return;
    setZoomLoading(s.id);
    try {
      const start = new Date(s.scheduled_start);
      const end = new Date(s.scheduled_end);
      const durationMinutes = Math.max(1, Math.round((end - start) / 60000));
      await createZoomMeeting({
        sessionId: s.id,
        topic: s.topic || s.batch_courses?.courses?.name || 'Online Class',
        scheduledStart: s.scheduled_start,
        durationMinutes,
      });
      showToast('Zoom meeting created!', 'success');
      refetchToday();
    } catch (err) {
      showToast(
        err.message || 'Could not create Zoom meeting. Set ZOOM_* secrets and deploy the zoom-meeting function.',
        'error',
      );
    } finally {
      setZoomLoading(null);
    }
  };

  if (lecLoading) {
    return (
      <AppLayout pageTitle="Lecturer Dashboard">
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">{translateText('My Dashboard')}</h1>
            <p className="page-subtitle">{translateText('Loading your workspace…')}</p>
          </div>
        </div>
        <div className="stats-grid">
          {[1, 2, 3, 4].map((i) => <StatSkeleton key={i} />)}
        </div>
      </AppLayout>
    );
  }

  if (lecError) {
    return (
      <AppLayout pageTitle="Lecturer Dashboard">
        <ProfileUnlinkedState
          role="lecturer"
          errorCode={lecError.code}
          onRetry={() => refetchLecturerProfile()}
        />
      </AppLayout>
    );
  }

  const firstName = lecturerProfile?.first_name || translateText('Lecturer');
  const dept = lecturerProfile?.departments?.name || '';
  const returnedSubmissions = markSubmissions.filter((m) => m.status === 'returned');

  return (
    <AppLayout pageTitle="Lecturer Dashboard">
      <a href="#main-content" className="skip-link">{translateText('Skip to main content')}</a>

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Welcome back,')} {firstName}</h1>
          <p className="page-subtitle">{formattedDate} · {dept}</p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-outline btn-sm"
            onClick={refreshDashboard}
            aria-label={translateText('Refresh dashboard')}
          >
            <MdRefresh /> {translateText('Refresh')}
          </button>
        </div>
      </div>

      {stats?.currentShift && (
        <div
          style={{
            background: 'rgba(16,185,129,0.07)',
            border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1.25rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: '#059669',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          <MdCheckCircle size={20} />
          {translateText('You are currently clocked in (since')} {fmtTime(stats.currentShift.clock_in)}
        </div>
      )}

      {returnedSubmissions.length > 0 && (
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
          {returnedSubmissions.length} {translateText('mark submission(s) returned for correction — please review')}
          <Link to="/lecturer/marks" style={{ marginLeft: 'auto', color: 'var(--color-secondary)', fontWeight: 700, fontSize: '0.8125rem' }}>
            {translateText('View Marks')} <MdArrowForward />
          </Link>
        </div>
      )}

      <div className="stats-grid">
        {statsLoading ? (
          [1, 2, 3, 4, 5, 6].map((i) => <StatSkeleton key={i} />)
        ) : statsError ? (
          <div className="empty-state" role="status" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-state-icon"><MdWarning /></div>
            <div className="empty-state-title">{translateText('Dashboard metrics unavailable')}</div>
            <p className="empty-state-text">{translateText('The metrics could not be retrieved. No placeholder totals are shown.')}</p>
            <button className="btn btn-outline btn-sm" onClick={() => refetchStats()}>
              <MdRefresh /> {translateText('Try again')}
            </button>
          </div>
        ) : (
          <>
            <StatCard icon={<MdBook />} value={stats.totalCourses} label="Assigned Courses" color="blue" link="/lecturer/courses" />
            <StatCard icon={<MdSchedule />} value={stats.todaySessions} label="Sessions Today" color="amber" />
            <StatCard icon={<MdGrade />} value={stats.pendingMarksDraft} label="Draft Mark Entries" color="blue" link="/lecturer/marks" />
            <StatCard icon={<MdWarning />} value={stats.returnedMarks} label="Returned Marks" color="red" link="/lecturer/marks" alert={stats.returnedMarks > 0} />
            <StatCard icon={<MdAccessTime />} value={`${stats.monthlyHours}h`} label="Hours This Month" color="green" link="/lecturer/hours" />
            <StatCard icon={<MdNotifications />} value={stats.unreadNotifications} label="Unread Notifications" color={stats.unreadNotifications > 0 ? 'red' : 'blue'} link="/lecturer/notifications" />
          </>
        )}
      </div>

      <div className="lecturer-dashboard-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdSchedule color="var(--color-primary)" /> {translateText("Today's Sessions")}
            </span>
            <Link to="/lecturer/sessions" className="btn btn-ghost btn-sm">{translateText('View All')}</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {sessionsLoading ? (
              <div style={{ padding: '1rem' }}>
                {[1, 2].map((i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div className="skeleton skeleton-text" style={{ width: '70%', marginBottom: 6 }} />
                    <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                  </div>
                ))}
              </div>
            ) : sessionsError ? (
              <div className="empty-state" role="alert" style={{ padding: '2rem' }}>
                <div className="empty-state-icon"><MdWarning /></div>
                <div className="empty-state-title">{translateText('Sessions unavailable')}</div>
                <p className="empty-state-text">{translateText("Today's sessions could not be loaded.")}</p>
                <button className="btn btn-outline btn-sm" onClick={() => refetchToday()}>
                  <MdRefresh /> {translateText('Retry')}
                </button>
              </div>
            ) : todaySessions.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-icon"><MdSchedule /></div>
                <div className="empty-state-title">{translateText('No sessions today')}</div>
                <p className="empty-state-text">{translateText('You have no scheduled classes today.')}</p>
                <Link to="/lecturer/sessions" className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }}>
                  {translateText('Create a session')}
                </Link>
              </div>
            ) : (
              <div>
                {todaySessions.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      padding: '0.875rem 1.25rem',
                      borderBottom: '1px solid var(--color-border)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.875rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: 'rgba(17,47,66,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <MdClass color="var(--color-primary)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {s.batch_courses?.courses?.code} — {s.batch_courses?.courses?.name}
                        {s.zoom_join_url && (
                          <span style={{ fontSize: '0.65rem', background: '#2d8cff', color: '#fff', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                            ONLINE
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {s.batch_courses?.batches?.name} · {fmtTime(s.scheduled_start)} – {fmtTime(s.scheduled_end)}
                      </div>
                      {s.room && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Room: {s.room}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {s.zoom_join_url || s.zoom_start_url ? (
                        <a
                          href={s.zoom_start_url || s.zoom_join_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <MdVideocam size={14} /> {translateText('Start Meeting')}
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          disabled={zoomLoading === s.id}
                          onClick={() => handleAddZoom(s)}
                        >
                          <MdVideocam size={14} />
                          {zoomLoading === s.id ? translateText('Creating…') : translateText('Add Zoom')}
                        </button>
                      )}
                      <Link
                        to={`/lecturer/sessions?bc=${s.batch_courses?.id}`}
                        className="btn btn-ghost btn-sm"
                      >
                        <MdHowToReg /> {translateText('Attend')}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdGrade color="var(--color-secondary)" /> {translateText('My Marks')}
            </span>
            <Link to="/lecturer/marks" className="btn btn-ghost btn-sm">{translateText('Manage Marks')}</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {marksLoading ? (
              <div style={{ padding: '1rem' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div className="skeleton skeleton-text" style={{ width: '80%', marginBottom: 4 }} />
                    <div className="skeleton skeleton-text" style={{ width: '50%' }} />
                  </div>
                ))}
              </div>
            ) : marksError ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-title">{translateText('Marks unavailable')}</div>
                <p className="empty-state-text">{translateText('Mark submissions could not be loaded.')}</p>
              </div>
            ) : markSubmissions.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-icon"><MdGrade /></div>
                <div className="empty-state-title">{translateText('No mark entries yet')}</div>
                <p className="empty-state-text">{translateText('Start entering marks for an assigned course.')}</p>
                <Link to="/lecturer/marks" className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }}>
                  {translateText('Open Marks')}
                </Link>
              </div>
            ) : (
              markSubmissions.slice(0, 6).map((m) => (
                <div
                  key={m.id}
                  style={{
                    padding: '0.75rem 1.25rem',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      {m.batch_courses?.courses?.code} — {m.batch_courses?.courses?.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {m.batch_courses?.batches?.name}
                    </div>
                  </div>
                  {statusBadge(m.status)}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdSchedule color="var(--color-primary)" /> {translateText('Upcoming')}
            </span>
            <Link to="/lecturer/sessions" className="btn btn-ghost btn-sm">{translateText('View All')}</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {upcomingLoading ? (
              <div style={{ padding: '1rem' }}>
                {[1, 2].map((i) => (
                  <div key={i} className="skeleton skeleton-text" style={{ height: 36, marginBottom: 10 }} />
                ))}
              </div>
            ) : upcomingSessions.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-title">{translateText('No upcoming sessions')}</div>
                <p className="empty-state-text">{translateText('Nothing scheduled for the next few days.')}</p>
              </div>
            ) : (
              upcomingSessions.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: '0.75rem 1.25rem',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    {s.batch_courses?.courses?.code} — {s.batch_courses?.courses?.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {fmtDate(s.scheduled_start)} · {fmtTime(s.scheduled_start)} – {fmtTime(s.scheduled_end)}
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
            <Link to="/lecturer/notifications" className="btn btn-ghost btn-sm">{translateText('View all')}</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {notifsLoading ? (
              <div style={{ padding: '1rem' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton skeleton-text" style={{ height: 32, marginBottom: 10 }} />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-title">{translateText('No notifications')}</div>
                <p className="empty-state-text">{translateText("You're all caught up!")}</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '0.75rem 1.25rem',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ fontWeight: n.is_read ? 500 : 700, fontSize: '0.875rem' }}>{n.title}</div>
                  {n.message && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{n.message}</div>
                  )}
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {fmtDate(n.created_at)}
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
