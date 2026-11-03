import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdHowToReg, MdRefresh, MdPersonAdd } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { translateText } from '../../i18n';
import { getBatches } from '../../services/academicService';
import {
  listApplications,
  updateApplicationStatus,
  acceptAndEnrollApplication,
  ADMISSION_STATUSES,
} from '../../services/admissionsService';

export default function AdminAdmissionsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [enrolApp, setEnrolApp] = useState(null);
  const [batchId, setBatchId] = useState('');

  const { data: applications = [], isLoading, refetch } = useQuery({
    queryKey: ['admissions', statusFilter],
    queryFn: () => listApplications({ status: statusFilter || undefined, limit: 150 }),
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches-for-enrol'],
    queryFn: () => getBatches(),
    enabled: !!enrolApp,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) =>
      updateApplicationStatus(id, { status, reviewedBy: profile?.id }),
    onSuccess: () => {
      toast.success(translateText('Application updated'));
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const enrolMutation = useMutation({
    mutationFn: () =>
      acceptAndEnrollApplication(enrolApp.id, {
        batchId,
        reviewedBy: profile?.id,
      }),
    onSuccess: (res) => {
      toast.success(
        res.alreadyEnrolled
          ? translateText('Already enrolled')
          : translateText('Student enrolled successfully')
      );
      setEnrolApp(null);
      setBatchId('');
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
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

      <div className="card" style={{ marginBottom: '1rem' }}>
        <select
          className="form-input"
          style={{ maxWidth: 240 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{translateText('All statuses')}</option>
          {ADMISSION_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{translateText('Application #')}</th>
                <th>{translateText('Name')}</th>
                <th>{translateText('Email')}</th>
                <th>{translateText('Department')}</th>
                <th>{translateText('Programme')}</th>
                <th>{translateText('Status')}</th>
                <th>{translateText('Submitted')}</th>
                <th>{translateText('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8}>{translateText('Loading…')}</td></tr>
              ) : applications.length === 0 ? (
                <tr><td colSpan={8}>{translateText('No applications')}</td></tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id}>
                    <td><code>{app.application_number}</code></td>
                    <td>{[app.first_name, app.middle_name, app.last_name].filter(Boolean).join(' ')}</td>
                    <td>{app.email}</td>
                    <td>{app.departments?.abbreviation || app.departments?.name || '—'}</td>
                    <td>—</td>
                    <td>
                      <span className="badge badge-info">{app.status?.replace(/_/g, ' ')}</span>
                    </td>
                    <td>{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '—'}</td>
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
                        {(app.status === 'submitted' || app.status === 'under_review' || app.status === 'waitlisted') && (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => statusMutation.mutate({ id: app.id, status: 'accepted' })}
                            >
                              {translateText('Accept')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              onClick={() => statusMutation.mutate({ id: app.id, status: 'rejected' })}
                            >
                              {translateText('Reject')}
                            </button>
                          </>
                        )}
                        {app.status === 'accepted' && !app.student_id && (
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
                        {app.student_id && (
                          <span className="badge badge-success">{translateText('Enrolled')}</span>
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
          <p style={{ marginBottom: '1rem' }}>
            {[enrolApp.first_name, enrolApp.last_name].filter(Boolean).join(' ')} — {enrolApp.application_number}
          </p>
          <div className="form-group">
            <label>{translateText('Batch / Cohort')} *</label>
            <select
              className="form-input"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              required
            >
              <option value="">{translateText('Select batch…')}</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                  {b.programmes?.code ? ` · ${b.programmes.code}` : ''}
                  {b.year_of_study != null ? ` · Y${b.year_of_study}` : ''}
                </option>
              ))}
            </select>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
              {translateText('Programme is taken from the selected batch')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!batchId || enrolMutation.isPending}
              onClick={() => {
                if (!batchId) {
                  toast.error(translateText('Select a batch'));
                  return;
                }
                enrolMutation.mutate();
              }}
            >
              <MdHowToReg /> {enrolMutation.isPending ? translateText('Enrolling…') : translateText('Confirm enrol')}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setEnrolApp(null);
                setBatchId('');
              }}
            >
              {translateText('Cancel')}
            </button>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
