import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdHowToReg, MdRefresh, MdPersonAdd } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import { toast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { getBatches } from '../../services/academicService';
import {
  listApplications,
  updateApplicationStatus,
  acceptAndEnrollApplication,
  ADMISSION_STATUSES,
} from '../../services/admissionsService';

export default function AdminAdmissionsPage() {
  const { profile } = useAuth();
  const { translateText } = useTranslation();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [enrolApp, setEnrolApp] = useState(null);
  const [batchId, setBatchId] = useState('');

  const { data: applications = [], isLoading, refetch } = useQuery({
    queryKey: ['admissions', statusFilter],
    queryFn: () => listApplications(statusFilter || undefined),
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches'],
    queryFn: getBatches,
    enabled: Boolean(enrolApp),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateApplicationStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
      toast.success(translateText('Application updated'));
    },
    onError: (e) => toast.error(e.message),
  });

  const enrolMutation = useMutation({
    mutationFn: () =>
      acceptAndEnrollApplication({
        applicationId: enrolApp.id,
        batchId,
        createdBy: profile?.id,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(
        res?.already_enrolled
          ? translateText('Already enrolled')
          : translateText('Student enrolled successfully'),
      );
      setEnrolApp(null);
      setBatchId('');
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">{translateText('Admissions')}</h1>
          <p className="page-subtitle">{translateText('Review applications and enrol accepted candidates')}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => refetch()}>
          <MdRefresh /> {translateText('Refresh')}
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1rem', padding: '0.875rem 1.25rem' }}>
        <div style={{ maxWidth: 240 }}>
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={translateText('Filter by status')}
          >
            <option value="">{translateText('All statuses')}</option>
            {ADMISSION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{translateText('Application #')}</th>
                <th>{translateText('Name')}</th>
                <th>{translateText('Email')}</th>
                <th>{translateText('Department')}</th>
                <th>{translateText('Status')}</th>
                <th>{translateText('Submitted')}</th>
                <th>{translateText('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7}>{translateText('Loading…')}</td></tr>
              ) : applications.length === 0 ? (
                <tr><td colSpan={7}>{translateText('No applications')}</td></tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{app.application_number}</td>
                    <td>{[app.first_name, app.last_name].filter(Boolean).join(' ')}</td>
                    <td>{app.email}</td>
                    <td>{app.department_name || '—'}</td>
                    <td>
                      <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                        {String(app.status || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      {app.submitted_at ? new Date(app.submitted_at).toLocaleString() : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {app.status === 'submitted' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => statusMutation.mutate({ id: app.id, status: 'under_review' })}
                          >
                            {translateText('Review')}
                          </button>
                        )}
                        {(app.status === 'submitted' || app.status === 'under_review') && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => statusMutation.mutate({ id: app.id, status: 'accepted' })}
                          >
                            {translateText('Accept')}
                          </button>
                        )}
                        {(app.status === 'accepted' || app.status === 'under_review') && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              setEnrolApp(app);
                              setBatchId('');
                            }}
                          >
                            <MdPersonAdd /> {translateText('Enrol')}
                          </button>
                        )}
                        {app.status !== 'rejected' && app.status !== 'enrolled' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => statusMutation.mutate({ id: app.id, status: 'rejected' })}
                          >
                            {translateText('Reject')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {enrolApp && (
        <Modal
          title={translateText('Enrol student')}
          onClose={() => {
            setEnrolApp(null);
            setBatchId('');
          }}
        >
          <p style={{ marginBottom: 12, fontSize: '0.9rem' }}>
            {[enrolApp.first_name, enrolApp.last_name].filter(Boolean).join(' ')} · {enrolApp.application_number}
          </p>
          <p style={{ marginBottom: 12, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            {translateText('Programme comes from the batch. Set programme on the batch first.')}
          </p>
          <div className="form-group">
            <label className="form-label">{translateText('Batch / cohort')} *</label>
            <select className="form-input" value={batchId} onChange={(e) => setBatchId(e.target.value)} required>
              <option value="">{translateText('Select…')}</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.programmes?.name ? ` — ${b.programmes.name}` : ''}
                  {b.year_of_study != null ? ` · Y${b.year_of_study}` : ''}
                </option>
              ))}
            </select>
            {batchId && (() => {
              const b = batches.find((x) => x.id === batchId);
              if (!b) return null;
              return (
                <div
                  style={{
                    marginTop: 8,
                    padding: '0.65rem 0.75rem',
                    borderRadius: 8,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-muted, rgba(0,0,0,0.03))',
                    fontSize: '0.85rem',
                  }}
                >
                  {b.programmes ? (
                    <>
                      <div>
                        <strong>{translateText('Programme')}</strong>:{' '}
                        <code>{b.programmes.code}</code> — {b.programmes.name}
                      </div>
                      {b.year_of_study != null && (
                        <div style={{ marginTop: 4, color: 'var(--color-text-muted)' }}>
                          {translateText('Year of study')}: {b.year_of_study}
                          {b.programmes.duration_years != null ? ` of ${b.programmes.duration_years}` : ''}
                        </div>
                      )}
                    </>
                  ) : (
                    <span style={{ color: 'var(--color-danger)' }}>
                      {translateText('This batch has no programme. Edit the batch and set HND, B.Tech, or M.Tech first.')}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setEnrolApp(null)}>
              {translateText('Cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!batchId || enrolMutation.isPending}
              onClick={() => enrolMutation.mutate()}
            >
              <MdHowToReg /> {enrolMutation.isPending ? translateText('Enrolling…') : translateText('Confirm enrol')}
            </button>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
