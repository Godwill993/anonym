import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  MdBook,
  MdHowToReg,
  MdGrade,
  MdAccessTime,
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

function statusBadge(status, tx) {
  const map = {
    draft: { cls: 'badge-gray', label: 'Draft' },
    submitted: { cls: 'badge-blue', label: 'Submitted' },
    returned: { cls: 'badge-red', label: 'Returned' },
    approved: { cls: 'badge-green', label: 'Approved' },
    published: { cls: 'badge-purple', label: 'Published' },
  };
  const s = map[status] || { cls: 'badge-gray', label: status };
  return <span className={`badge ${s.cls}`}>{tx(s.label)}</span>;
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

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['lecturer-dashboard-stats', lecturerId, profileId],
    queryFn: () => getLecturerDashboardStats(lecturerId, profileId),
    enabled: !!lecturerId && !!profileId,
    retry: 1,
  });

  const {
    data: todaySessions = [],
    isLoading: sessionsLoading,
    error: sessionsError,
    refetch: refetchToday,
  } = useQuery({
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

  const formattedDate = new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const refreshDashboard = async () => {
    await Promise.all([
      refetchLecturerProfile(),
      refetchStats(),
      queryClient.invalidateQueries({ queryKey: ['lecturer-today-sessions', lecturerId] }),
      queryClient.invalidateQueries({ queryKey: ['lecturer-upcoming-sessions', lecturerId] }),
      queryClient.invalidateQueries({ queryKey: ['my-mark-submissions', lecturerId] }),
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
        err.message ||
          'Could not create Zoom meeting. Set ZOOM_* secrets and deploy the zoom-meeting function.',
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
          {[1, 2, 3, 4].map((i) => (
            <StatSkeleton key={i} />
          ))}
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
  const marksNeedingAction = (stats?.pendingMarksDraft || 0) + (stats?.returnedMarks || 0);

  const todayKey = new Date().toDateString();
  const upcomingOnly = (upcomingSessions || []).filter(
    (s) => s.scheduled_start && new Date(s.scheduled_start).toDateString() !== todayKey,
  );

  return (
    <AppLayout pageTitle="Lecturer Dashboard">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            {translateText('Welcome back,')} {firstName}
          </h1>
          <p className="page-subtitle">
            {formattedDate}
            {dept ? ` · ${dept}` : ''}
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
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
            padding: '0.65rem 1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            color: '#059669',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          <MdCheckCircle size={18} />
          {translateText('You are currently clocked in (since')} {fmtTime(stats.currentShift.clock_in)}
        </div>
      )}

      {returnedSubmissions.length > 0 && (
        <div
          style={{
            background: 'rgba(183,0,50,0.06)',
            border: '1px solid rgba(183,0,50,0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '0.65rem 1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            color: 'var(--color-secondary)',
            fontSize: '0.875rem',
            fontWeight: 600,
            flexWrap: 'wrap',
          }}
        >
          <MdWarning size={18} />
          {returnedSubmissions.length}{' '}
          {translateText('mark submission(s) returned for correction — please review')}
          <Link
            to="/lecturer/marks"
            style={{
              marginLeft: 'auto',
              color: 'var(--color-secondary)',
              fontWeight: 700,
              fontSize: '0.8125rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {translateText('View Marks')} <MdArrowForward />
          </Link>
        </div>
      )}

      <div
        className="stats-grid animate-stagger"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
      >
        {statsLoading ? (
          [1, 2, 3, 4].map((i) => <StatSkeleton key={i} />)
        ) : statsError ? (
          <div className="empty-state" role="status" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-state-title">{translateText('Dashboard metrics unavailable')}</div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => refetchStats()}>
              <MdRefresh /> {translateText('Try again')}
            </button>
          </div>
        ) : (
          <>
            <StatCard
              icon={<MdBook />}
              value={stats.totalCourses}
              label="Assigned Courses"
              color="blue"
              link="/lecturer/courses"
            />
            <StatCard
              icon={<MdSchedule />}
              value={stats.todaySessions}
              label="Sessions Today"
              color="amber"
              link="/lecturer/sessions"
            />
            <StatCard
              icon={<MdGrade />}
              value={marksNeedingAction}
              label="Marks to action"
              color={marksNeedingAction > 0 ? 'red' : 'blue'}
              link="/lecturer/marks"
              alert={marksNeedingAction > 0}
            />
            <StatCard
              icon={<MdAccessTime />}
              value={`${stats.monthlyHours ?? 0}h`}
              label="Hours This Month"
              color="green"
              link="/lecturer/hours"
            />
          </>
        )}
      </div>

      <div
        className="animate-stagger"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: '1.25rem',
          marginTop: '1.25rem',
        }}
      >
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdSchedule color="var(--color-primary)" /> {translateText("Today's Sessions")}
            </span>
            <Link to="/lecturer/sessions" className="btn btn-ghost btn-sm">
              {translateText('View All')}
            </Link>
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
              <div className="empty-state" role="alert" style={{ padding: '1.5rem' }}>
                <div className="empty-state-title">{translateText('Sessions unavailable')}</div>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => refetchToday()}>
                  <MdRefresh /> {translateText('Retry')}
                </button>
              </div>
            ) : todaySessions.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.5rem' }}>
                <div className="empty-state-title">{translateText('No sessions today')}</div>
                <p className="empty-state-text">{translateText('You have no scheduled classes today.')}</p>
                <Link to="/lecturer/sessions" className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }}>
                  {translateText('Open sessions')}
                </Link>
              </div>
            ) : (
              todaySessions.map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: 'rgba(17,47,66,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <MdClass color="var(--color-primary)" size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexWrap: 'wrap',
                      }}
                    >
                      {s.batch_courses?.courses?.code} — {s.batch_courses?.courses?.name}
                      {s.zoom_join_url && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            background: '#2d8cff',
                            color: '#fff',
                            borderRadius: 4,
                            padding: '1px 6px',
                            fontWeight: 700,
                          }}
                        >
                          ONLINE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {s.batch_courses?.batches?.name} · {fmtTime(s.scheduled_start)} –{' '}
                      {fmtTime(s.scheduled_end)}
                      {s.room ? ` · ${s.room}` : ''}
                    </div>
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
                      to={`/lecturer/sessions?bc=${s.batch_courses?.id || ''}`}
                      className="btn btn-ghost btn-sm"
                    >
                      <MdHowToReg /> {translateText('Attend')}
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdGrade color="var(--color-secondary)" /> {translateText('Marks')}
            </span>
            <Link to="/lecturer/marks" className="btn btn-ghost btn-sm">
              {translateText('Open')}
            </Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {marksLoading ? (
              <div style={{ padding: '1rem' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton skeleton-text" style={{ height: 28, marginBottom: 8 }} />
                ))}
              </div>
            ) : marksError ? (
              <div className="empty-state" style={{ padding: '1.5rem' }}>
                <div className="empty-state-title">{translateText('Marks unavailable')}</div>
              </div>
            ) : markSubmissions.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.5rem' }}>
                <div className="empty-state-title">{translateText('No mark entries yet')}</div>
                <Link to="/lecturer/marks" className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }}>
                  {translateText('Open Marks')}
                </Link>
              </div>
            ) : (
              markSubmissions.slice(0, 6).map((m) => (
                <div
                  key={m.id}
                  style={{
                    padding: '0.6rem 1rem',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    alignItems: 'center',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong>{m.batch_courses?.courses?.code || '—'}</strong>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      {m.batch_courses?.batches?.name || '—'}
                    </div>
                  </div>
                  {statusBadge(m.status, translateText)}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {!upcomingLoading && upcomingOnly.length > 0 && (
        <div className="card animate-stagger" style={{ marginTop: '1.25rem' }}>
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdSchedule color="var(--color-primary)" /> {translateText('Upcoming')}
            </span>
            <Link to="/lecturer/sessions" className="btn btn-ghost btn-sm">
              {translateText('View All')}
            </Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {upcomingOnly.slice(0, 5).map((s) => (
              <div
                key={s.id}
                style={{
                  padding: '0.6rem 1rem',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: '0.8125rem',
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {s.batch_courses?.courses?.code} — {s.batch_courses?.courses?.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {fmtDate(s.scheduled_start)} · {fmtTime(s.scheduled_start)} – {fmtTime(s.scheduled_end)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
