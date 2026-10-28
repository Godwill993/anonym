import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdd, MdApartment, MdEdit, MdToggleOn, MdToggleOff, MdSearch } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import RowActionsMenu from '../../components/common/RowActionsMenu';
import { toast } from '../../components/common/Toast';
import { useTranslation } from '../../i18n';
import { getDepartments, createDepartment, updateDepartment } from '../../services/academicService';

export default function DepartmentsPage() {
  const { translateText: tx } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', abbreviation: '', description: '' });

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: getDepartments,
  });

  const createMutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
      toast.success(tx('Department created'));
      setIsModalOpen(false);
    },
    onError: (err) => toast.error(err.message || tx('Failed to create department')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => updateDepartment(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
      toast.success(tx('Department updated'));
      setIsModalOpen(false);
      setEditing(null);
    },
    onError: (err) => toast.error(err.message || tx('Failed to update department')),
  });

  const handleOpenAdd = () => {
    setEditing(null);
    setFormData({ name: '', abbreviation: '', description: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (dept) => {
    setEditing(dept);
    setFormData({
      name: dept.name || '',
      abbreviation: dept.abbreviation || '',
      description: dept.description || '',
    });
    setIsModalOpen(true);
  };

  const handleToggleStatus = (dept) => {
    updateMutation.mutate({ id: dept.id, updates: { is_active: !dept.is_active } });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.abbreviation.trim()) {
      toast.error(tx('Name and abbreviation are required'));
      return;
    }
    if (editing) updateMutation.mutate({ id: editing.id, updates: formData });
    else createMutation.mutate(formData);
  };

  const filtered = departments.filter((d) => {
    const s = search.toLowerCase();
    return (
      d.name?.toLowerCase().includes(s) ||
      d.abbreviation?.toLowerCase().includes(s)
    );
  });

  return (
    <AppLayout pageTitle={tx('Departments')}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{tx('Departments')}</h1>
          <p className="page-subtitle">{tx('Academic departments and faculties')}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <MdAdd /> {tx('Add Department')}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 200px' }}>
            <MdSearch style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.25rem' }}
              placeholder={tx('Search departments...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{tx('Name')}</th>
                <th>{tx('Abbreviation')}</th>
                <th>{tx('Description')}</th>
                <th>{tx('Status')}</th>
                <th style={{ textAlign: 'right' }}>{tx('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>{tx('Loading...')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdApartment className="empty-state-icon" />
                      <div className="empty-state-title">{tx('No departments')}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((dept) => (
                  <tr key={dept.id}>
                    <td><strong>{dept.name}</strong></td>
                    <td><code>{dept.abbreviation}</code></td>
                    <td>{dept.description || '—'}</td>
                    <td>
                      <span className={`badge ${dept.is_active !== false ? 'badge-green' : 'badge-gray'}`}>
                        {dept.is_active !== false ? tx('Active') : tx('Inactive')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <RowActionsMenu
                        ariaLabel={tx('Department actions')}
                        items={[
                          {
                            id: 'edit',
                            label: tx('Edit'),
                            icon: <MdEdit />,
                            onClick: () => handleOpenEdit(dept),
                          },
                          {
                            id: 'toggle',
                            label: dept.is_active !== false ? tx('Deactivate') : tx('Activate'),
                            icon: dept.is_active !== false ? <MdToggleOn /> : <MdToggleOff />,
                            onClick: () => handleToggleStatus(dept),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? tx('Edit Department') : tx('Add Department')}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{tx('Name')} *</label>
            <input className="form-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">{tx('Abbreviation')} *</label>
            <input className="form-input" value={formData.abbreviation} onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">{tx('Description')}</label>
            <textarea className="form-input" rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>{tx('Cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? tx('Save Changes') : tx('Add Department')}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
