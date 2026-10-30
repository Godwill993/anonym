import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdHowToReg, MdRefresh } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useTranslation } from '../../i18n';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import {
  listApplications,
  updateApplicationStatus,
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

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['admissions', statusFilter],
    queryFn: () => listApplications({ status: statusFilter || undefined, limit: 150 }),
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
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {new Date(app.submitted_at).toLocaleDateString()}
                    </td>
                    <td>
                      <select
                        className="form-control"
                        style={{ minWidth: 140, fontSize: '0.8rem' }}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
