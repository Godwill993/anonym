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
  MdRefresh,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import ProfileUnlinkedState from '../../components/common/ProfileUnlinkedState';
import {
  getMyLecturerProfile,
  getLecturerDashboardStats,
  getTodaySessions,
  getMyMarkSubmissions,
} from '../../services/lecturerService';
import {
  getLecturerMarkStatusBreakdown,
  getLecturerHoursTrend,
} from '../../services/dashboardAnalytics';
import {
  ChartCard,
  StatusPieChart,
  HoursAreaChart,
} from '../../components/charts/DashboardCharts';

function fmtTime(iso) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
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
        <div className="skeleton skeleton-text" style={{ width: 100 }} />
      </div>
    </div>
  );
}

export default function LecturerDashboard() {
  const { language, translateText } = useTranslation();
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();

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

  const { data: markSubmissions = [], isLoading: marksLoading } = useQuery({
    queryKey: ['my-mark-submissions', lecturerId],
    queryFn: () => getMyMarkSubmissions(lecturerId),
    enabled: !!lecturerId,
    retry: 1,
  });

  const { data: markMix = [], isLoading: mixLoading } = useQuery({
    queryKey: ['lecturer-mark-status', lecturerId],
    queryFn: () => getLecturerMarkStatusBreakdown(lecturerId),
    enabled: !!lecturerId,
  });

  const { data: hoursTrend = [], isLoading: hoursLoading } = useQuery({
    queryKey: ['lecturer-hours-trend', lecturerId],
    queryFn: () => getLecturerHoursTrend(lecturerId, 6),
    enabled: !!lecturerId,
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
      queryClient.invalidateQueries({ queryKey: ['my-mark-submissions', lecturerId] }),
      queryClient.invalidateQueries({ queryKey: ['lecturer-mark-status', lecturerId] }),
      queryClient.invalidateQueries({ queryKey: ['lecturer-hours-trend', lecturerId] }),
    ]);
  };

  if (lecLoading) {
    return (
      <AppLayout pageTitle="Lecturer Dashboard">
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">{translateText('Dashboard')}</h1>
          </div>
        </div>
        <div className="stats-grid">{[1, 2, 3, 4].map((i) => <StatSkeleton key={i} />)}</div>
      </AppLayout>
    );
  }

  if (lecError) {
    return (
      <AppLayout pageTitle="Lecturer Dashboard">
        <ProfileUnlinkedState role="lecturer" errorCode={lecError.code} onRetry={() => refetchLecturerProfile()} />
      </AppLayout>
    );
  }

  const firstName = lecturerProfile?.first_name || translateText('Lecturer');
  const dept = lecturerProfile?.departments?.name || '';
  const returnedSubmissions = markSubmissions.filter((m) => m.status === 'returned');
  const marksNeedingAction = (stats?.pendingMarksDraft || 0) + (stats?.returnedMarks || 0);

  return (
    <AppLayout pageTitle="Lecturer Dashboard">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{firstName}</h1>
          <p className="page-subtitle">
            {formattedDate}
            {dept ? ` · ${dept}` : ''}
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={refreshDashboard}>
            <MdRefresh aria-hidden="true" />
          </button>
        </div>
      </div>

      {stats?.currentShift && (
        <div className="alert-banner" style={{ marginBottom: '1rem', color: '#059669' }} role="status">
          <MdCheckCircle size={18} aria-hidden="true" />
          {translateText('Clocked in since')} {fmtTime(stats.currentShift.clock_in)}
        </div>
      )}

      {returnedSubmissions.length > 0 && (
        <div className="alert-banner alert-banner-danger" role="status" style={{ marginBottom: '1rem' }}>
          <MdWarning size={18} aria-hidden="true" />
          {returnedSubmissions.length} {translateText('mark submission(s) returned')}
          <Link to="/lecturer/marks">{translateText('Review')} →</Link>
        </div>
      )}

      <div className="stats-grid animate-stagger">
        {statsLoading ? (
          [1, 2, 3, 4].map((i) => <StatSkeleton key={i} />)
        ) : statsError ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => refetchStats()}>
              <MdRefresh aria-hidden="true" /> {translateText('Try again')}
            </button>
          </div>
        ) : (
          <>
            <StatCard icon={<MdBook aria-hidden="true" />} value={stats.totalCourses} label="Courses" color="blue" link="/lecturer/courses" />
            <StatCard icon={<MdSchedule aria-hidden="true" />} value={stats.todaySessions} label="Today" color="amber" link="/lecturer/sessions" />
            <StatCard
              icon={<MdGrade aria-hidden="true" />}
              value={marksNeedingAction}
              label="Marks"
              color={marksNeedingAction > 0 ? 'red' : 'blue'}
              link="/lecturer/marks"
              alert={marksNeedingAction > 0}
            />
            <StatCard icon={<MdAccessTime aria-hidden="true" />} value={`${stats.monthlyHours ?? 0}h`} label="Hours" color="green" link="/lecturer/hours" />
          </>
        )}
      </div>

      <div className="lecturer-charts-grid" style={{ marginTop: '1.25rem' }}>
        <ChartCard
          title={translateText('Marks workflow')}
          subtitle={translateText('Your submissions by status')}
          height={230}
        >
          {mixLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              {translateText('Loading…')}
            </div>
          ) : (
            <StatusPieChart
              data={markMix.map((r) => ({ ...r, label: translateText(r.label) }))}
              emptyLabel={translateText('No mark entries yet')}
            />
          )}
        </ChartCard>
        <ChartCard
          title={translateText('Teaching hours')}
          subtitle={translateText('Last 6 months')}
          height={230}
        >
          {hoursLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              {translateText('Loading…')}
            </div>
          ) : (
            <HoursAreaChart data={hoursTrend} emptyLabel={translateText('No hours recorded')} />
          )}
        </ChartCard>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)',
          gap: '1rem',
          marginTop: '1.25rem',
        }}
        className="lecturer-lists-grid"
      >
        <div className="card">
          <div className="card-header">
            <span className="card-title">{translateText("Today's Sessions")}</span>
            <Link to="/lecturer/sessions" className="btn btn-ghost btn-sm">
              {translateText('All')}
            </Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {sessionsLoading ? (
              <div style={{ padding: '1rem' }}>{translateText('Loading…')}</div>
            ) : sessionsError ? (
              <div className="empty-state" style={{ padding: '1.25rem' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => refetchToday()}>
                  <MdRefresh aria-hidden="true" /> {translateText('Retry')}
                </button>
              </div>
            ) : todaySessions.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.25rem' }}>
                <div className="empty-state-title">{translateText('No sessions today')}</div>
              </div>
            ) : (
              todaySessions.map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: '0.65rem 1rem',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                      {s.batch_courses?.courses?.code} — {s.batch_courses?.courses?.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {fmtTime(s.scheduled_start)} – {fmtTime(s.scheduled_end)}
                      {s.room ? ` · ${s.room}` : ''}
                    </div>
                  </div>
                  <Link
                    to={`/lecturer/sessions?bc=${s.batch_courses?.id || ''}`}
                    className="btn btn-ghost btn-sm"
                    aria-label={translateText('Attendance')}
                  >
                    <MdHowToReg aria-hidden="true" />
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">{translateText('Marks')}</span>
            <Link to="/lecturer/marks" className="btn btn-ghost btn-sm">
              {translateText('Open')}
            </Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {marksLoading ? (
              <div style={{ padding: '1rem' }}>{translateText('Loading…')}</div>
            ) : markSubmissions.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.25rem' }}>
                <div className="empty-state-title">{translateText('No mark entries yet')}</div>
              </div>
            ) : (
              markSubmissions.slice(0, 5).map((m) => (
                <div
                  key={m.id}
                  style={{
                    padding: '0.55rem 1rem',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: '0.85rem',
                  }}
                >
                  <span>{m.batch_courses?.courses?.code || '—'}</span>
                  {statusBadge(m.status, translateText)}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
        .lecturer-charts-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
          gap: 1rem;
        }
        @media (max-width: 900px) {
          .lecturer-charts-grid,
          .lecturer-lists-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </AppLayout>
  );
}
