import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdHowToReg, MdRefresh, MdPersonAdd } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import { useTranslation } from '../../i18n';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import { getBatches } from '../../services/academicService';
import {
  listApplications,
  updateApplicationStatus,
  acceptAndEnrollApplication,
  ADMISSION_STATUSES,
} from '../../services/admissionsService';

function statusClass(s) {
  const map = {
    submitted: 'badge-info',
    under_review: 'badge-warning',
    accepted: 'badge-success',
    rejected: 'badge-danger',
    waitlisted: 'badge-muted',
    withdrawn: 'badge-muted',
  };
  return map[s] || 'badge-muted';
}

export default function AdminAdmissionsPage() {
  const { translateText } = useTranslation();
  const { profile } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [enrolApp, setEnrolApp] = useState(null);
  const [batchId, setBatchId] = useState('');

  const { data: applications = [], isLoading } = useQuery({
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
          : `${translateText('Enrolled')} · ${res.student?.matricule || ''}`,
      );
      setEnrolApp(null);
      setBatchId('');
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AppLayout pageTitle="Admissions">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Admissions')}</h1>
          <p className="page-subtitle">
            {translateText('Review online applications and update their status')}
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 8 }}>
          <select
            className="form-control"
            style={{ width: 'auto', minWidth: 160 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{translateText('All statuses')}</option>
            {ADMISSION_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['admissions'] })}
          >
            <MdRefresh /> {translateText('Refresh')}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdHowToReg /> {translateText('Applications')}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {isLoading ? (
            <div className="empty-state">{translateText('Loading…')}</div>
          ) : applications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">{translateText('No applications')}</div>
              <p className="empty-state-text">
                {translateText('Public applications from /apply will appear here.')}
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{translateText('Number')}</th>
                  <th>{translateText('Applicant')}</th>
                  <th>{translateText('Programme')}</th>
                  <th>{translateText('Status')}</th>
                  <th>{translateText('Submitted')}</th>
                  <th>{translateText('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id}>
                    <td style={{ fontWeight: 600 }}>{app.application_number}</td>
                    <td>
                      {app.first_name} {app.last_name}
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {app.email}
                        {app.phone ? ` · ${app.phone}` : ''}
                      </div>
                    </td>
                    <td>
                      {app.departments?.name || '—'}
                      {app.preferred_level && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {app.preferred_level}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${statusClass(app.status)}`}>
                        {app.status.replace('_', ' ')}
                      </span>
                      {app.student_id && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                          {translateText('Student linked')}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {new Date(app.submitted_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <select
                          className="form-control"
                          style={{ minWidth: 120, fontSize: '0.8rem' }}
                          value={app.status}
                          disabled={statusMutation.isPending}
                          onChange={(e) =>
                            statusMutation.mutate({ id: app.id, status: e.target.value })
                          }
                        >
                          {ADMISSION_STATUSES.map((s) => (
                            <option key={s} value={s}>{s.replace('_', ' ')}</option>
                          ))}
                        </select>
                        {!app.student_id && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setEnrolApp(app);
                              setBatchId('');
                            }}
                          >
                            <MdPersonAdd size={14} /> {translateText('Enrol')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {enrolApp && (
        <Modal
          title={`${translateText('Accept & enrol')} — ${enrolApp.application_number}`}
          onClose={() => setEnrolApp(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!batchId) {
                toast.error(translateText('Select a batch'));
                return;
              }
              enrolMutation.mutate();
            }}
          >
            <p style={{ fontSize: '0.9rem' }}>
              {enrolApp.first_name} {enrolApp.last_name} · {enrolApp.email}
            </p>
            <div className="form-group">
              <label>{translateText('Assign to batch')} *</label>
              <select
                className="form-control"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                required
              >
                <option value="">{translateText('Select batch…')}</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.departments?.name ? ` — ${b.departments.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              {translateText('Creates a student record with a provisional matricule and marks the application accepted.')}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setEnrolApp(null)}>
                {translateText('Cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={enrolMutation.isPending}>
                {enrolMutation.isPending ? translateText('Enrolling…') : translateText('Accept & enrol')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
