import { useQuery } from '@tanstack/react-query';
import { MdAccessTime } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { getMyLecturerProfile, getMyShifts } from '../../services/lecturerService';

function calcDuration(clockIn, clockOut) {
  if (!clockIn || !clockOut) return '—';
  const diff = new Date(clockOut) - new Date(clockIn);
  if (isNaN(diff) || diff < 0) return '—';
  const hrs = diff / 3600000;
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return `${h}h ${m}m`;
}

export default function LecturerHoursPage() {
  const { session } = useAuth();
  const { language, translateText } = useTranslation();

  const { data: lecturerProfile } = useQuery({
    queryKey: ['my-lecturer-profile'],
    queryFn: getMyLecturerProfile,
    enabled: !!session,
  });
  const lecturerId = lecturerProfile?.id;

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['my-shifts', lecturerId],
    queryFn: () => getMyShifts(lecturerId, { limit: 100 }),
    enabled: !!lecturerId,
  });

  // Monthly summary
  const monthlySummary = {};
  shifts.forEach((s) => {
    if (s.status !== 'closed' || !s.clock_out || !s.clock_in) return;
    const diff = new Date(s.clock_out) - new Date(s.clock_in);
    if (isNaN(diff) || diff <= 0) return;
    const month = new Date(s.clock_in).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', {
      month: 'long',
      year: 'numeric',
    });
    const hrs = diff / 3600000;
    if (!monthlySummary[month]) monthlySummary[month] = 0;
    monthlySummary[month] += hrs;
  });

  const totalHours = Object.values(monthlySummary).reduce((a, b) => a + b, 0);

  return (
    <AppLayout pageTitle={translateText('My Hours')}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('My Teaching Hours')}</h1>
          <p className="page-subtitle">{translateText('Your recorded campus hours')}</p>
        </div>
        <div className="page-header-actions">
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--color-primary)',
            }}
          >
            {translateText('Total')}: {totalHours.toFixed(1)}h
          </div>
        </div>
      </div>

      {/* Monthly summary cards */}
      {Object.keys(monthlySummary).length > 0 && (
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          {Object.entries(monthlySummary).map(([month, hrs]) => (
            <div key={month} className="stat-card">
              <div className="stat-card-icon blue"><MdAccessTime /></div>
              <div className="stat-card-body">
                <div className="stat-card-value">{hrs.toFixed(1)}h</div>
                <div className="stat-card-label">{month}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full shift history */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{translateText('Shift History')}</span>
        </div>
        {isLoading ? (
          <div style={{ padding: '1.5rem' }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div className="skeleton skeleton-text" style={{ width: '60%', marginBottom: 4 }} />
                <div className="skeleton skeleton-text" style={{ width: '40%' }} />
              </div>
            ))}
          </div>
        ) : shifts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><MdAccessTime /></div>
            <div className="empty-state-title">{translateText('No shifts recorded')}</div>
            <p className="empty-state-text">{translateText('Your campus clock-in history will appear here.')}</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{translateText('Date')}</th>
                  <th>{translateText('Clock In')}</th>
                  <th>{translateText('Clock Out')}</th>
                  <th>{translateText('Duration')}</th>
                  <th>{translateText('Status')}</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {new Date(s.clock_in).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td>
                      {new Date(s.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      {s.clock_out ? (
                        new Date(s.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      ) : (
                        <span className="badge badge-green">{translateText('Active')}</span>
                      )}
                    </td>
                    <td>{calcDuration(s.clock_in, s.clock_out)}</td>
                    <td>
                      {s.status === 'open' && <span className="badge badge-green">{translateText('Clocked In')}</span>}
                      {s.status === 'closed' && <span className="badge badge-gray">{translateText('Completed')}</span>}
                      {s.status === 'corrected' && <span className="badge badge-amber">{translateText('Corrected')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
