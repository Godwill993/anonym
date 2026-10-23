import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdminPanelSettings, MdSearch, MdToggleOff, MdToggleOn } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { toast } from '../../components/common/Toast';
import { getStaffProfiles, toggleProfileStatus } from '../../services/peopleService';
import { useTranslation } from '../../i18n';
import { MAX_ADMINS } from '../../lib/permissions';

export default function StaffPage() {
  const { translateText: tx } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['admin-staff-profiles'],
    queryFn: () => getStaffProfiles({}),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => toggleProfileStatus(id, is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff-profiles'] });
      toast.success(tx('Account status updated'));
    },
    onError: (err) => toast.error(err.message || tx('Could not update account')),
  });

  const adminCount = useMemo(
    () => staff.filter((p) => p.role === 'admin' && p.is_active).length,
    [staff],
  );

  const filteredStaff = useMemo(() => {
    const term = search.toLowerCase().trim();
    return staff.filter((profile) => {
      if (profile.role === 'frontdesk') return false;
      if (roleFilter !== 'all' && profile.role !== roleFilter) return false;
      if (!term) return true;
      const hay = `${profile.full_name || ''} ${profile.login_id || ''} ${profile.phone || ''} ${profile.role || ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [staff, search, roleFilter]);

  const roleLabel = (role) => {
    if (role === 'admin') return tx('Administrator');
    if (role === 'lecturer') return tx('Lecturer');
    if (role === 'student') return tx('Student');
    return role || '—';
  };

  return (
    <AppLayout pageTitle={tx('Administrators')}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{tx('Administrators & Accounts')}</h1>
          <p className="page-subtitle">
            {tx('Manage system accounts. Up to')} {MAX_ADMINS}{' '}
            {tx('active administrators are allowed. Front desk role has been removed — campus operations are handled by administrators.')}
          </p>
        </div>
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            fontSize: '0.875rem',
          }}
        >
          <strong>{tx('Active admins')}:</strong>{' '}
          <span style={{ color: adminCount >= MAX_ADMINS ? 'var(--color-secondary)' : 'inherit' }}>
            {adminCount} / {MAX_ADMINS}
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 200px' }}>
            <MdSearch
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
              }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.25rem' }}
              placeholder={tx('Search by name, login ID, or phone…')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-input"
            style={{ maxWidth: 180 }}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">{tx('All roles')}</option>
            <option value="admin">{tx('Administrator')}</option>
            <option value="lecturer">{tx('Lecturer')}</option>
            <option value="student">{tx('Student')}</option>
          </select>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{tx('Full Name')}</th>
                <th>{tx('Login ID')}</th>
                <th>{tx('Role')}</th>
                <th>{tx('Phone')}</th>
                <th>{tx('Status')}</th>
                <th style={{ textAlign: 'right' }}>{tx('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>
                    {tx('Loading...')}
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdAdminPanelSettings className="empty-state-icon" />
                      <div className="empty-state-title">{tx('No accounts found')}</div>
                      <div className="empty-state-text">
                        {tx('Staff and user profiles will appear here as they are authenticated.')}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((profile) => (
                  <tr key={profile.id}>
                    <td>
                      <strong>{profile.full_name}</strong>
                    </td>
                    <td>
                      <code
                        style={{
                          fontSize: '0.8rem',
                          background: 'var(--color-bg)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {profile.login_id || '—'}
                      </code>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          profile.role === 'admin'
                            ? 'badge-red'
                            : profile.role === 'lecturer'
                              ? 'badge-purple'
                              : 'badge-gray'
                        }`}
                      >
                        {roleLabel(profile.role)}
                      </span>
                    </td>
                    <td>{profile.phone || '—'}</td>
                    <td>
                      <span className={`badge ${profile.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {profile.is_active ? tx('Active') : tx('Disabled')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-icon"
                        title={profile.is_active ? tx('Disable account') : tx('Enable account')}
                        onClick={() =>
                          toggleMutation.mutate({ id: profile.id, is_active: !profile.is_active })
                        }
                      >
                        {profile.is_active ? (
                          <MdToggleOn style={{ color: '#059669', fontSize: '1.25rem' }} />
                        ) : (
                          <MdToggleOff style={{ color: 'var(--color-text-muted)', fontSize: '1.25rem' }} />
                        )}
                      </button>
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
