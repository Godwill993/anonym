import { useQuery } from '@tanstack/react-query';
import { MdSchool, MdInfo } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { getProgrammes } from '../../services/academicService';

/**
 * Read-only list of system programmes (HND / B.Tech / M.Tech).
 * No free-form create/edit — defaults are seeded in the database.
 * Programme is chosen when creating a batch; students inherit it from the batch.
 */
export default function ProgrammesPage() {
  const { data: programmes = [], isLoading, error } = useQuery({
    queryKey: ['admin-programmes-all'],
    queryFn: () => getProgrammes({ activeOnly: false }),
  });

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Programmes</h1>
          <p className="page-subtitle">
            Cameroon higher-education awards used by batches (read-only system defaults)
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem', padding: '0.875rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <MdInfo style={{ color: 'var(--color-primary)', marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
            <strong style={{ color: 'var(--color-text)' }}>How programmes work</strong>
            <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
              <li>
                Typical durations: <strong>HND 2 years</strong> (3 for Biomedical where configured),{' '}
                <strong>B.Tech 1 year</strong>, <strong>M.Tech 2 years</strong>.
              </li>
              <li>
                Set the programme on the <strong>batch</strong>. Students inherit it when they join that batch.
              </li>
              <li>
                There is no free-form “create programme” workflow — these awards are system defaults.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Award</th>
                <th>Track</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6}>Loading…</td></tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--color-danger)' }}>
                    {error.message || 'Failed to load programmes'}
                  </td>
                </tr>
              ) : programmes.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state" style={{ padding: '1.5rem' }}>
                      <MdSchool className="empty-state-icon" />
                      <div className="empty-state-title">No programmes found</div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        Seed programmes in the database (HND, B.Tech, M.Tech) if this list is empty.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                programmes.map((p) => (
                  <tr key={p.id}>
                    <td><code>{p.code}</code></td>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.award || '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{p.track || '—'}</td>
                    <td>
                      {p.duration_years != null
                        ? `${p.duration_years} year${Number(p.duration_years) === 1 ? '' : 's'}`
                        : '—'}
                    </td>
                    <td>
                      <span className={`badge ${p.is_active !== false ? 'badge-success' : 'badge-danger'}`}>
                        {p.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
