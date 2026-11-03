import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdd, MdApartment, MdEdit, MdToggleOn, MdToggleOff, MdSearch, MdGroups } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import RowActionsMenu from '../../components/common/RowActionsMenu';
import { toast } from '../../components/common/Toast';
import { useTranslation } from '../../i18n';
import { getDepartments, createDepartment, updateDepartment } from '../../services/academicService';

export default function DepartmentsPage() {
  const { translateText: tx } = useTranslation();
  const navigate = useNavigate();
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
    if (editing) {
      updateMutation.mutate({ id: editing.id, updates: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filtered = departments.filter((d) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (d.name || '').toLowerCase().includes(q) ||
      (d.abbreviation || '').toLowerCase().includes(q) ||
      (d.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">{tx('Departments')}</h1>
          <p className="page-subtitle">{tx('Academic departments and units')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleOpenAdd}>
          <MdAdd /> {tx('Add Department')}
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1rem', padding: '0.875rem 1.25rem' }}>
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <MdSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
          <input
            className="form-input"
            style={{ paddingLeft: '2.25rem' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tx('Search by name or abbreviation…')}
            aria-label={tx('Search by name or abbreviation…')}
          />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{tx('Name')}</th>
                <th>{tx('Abbreviation')}</th>
                <th>{tx('Description')}</th>
                <th>{tx('Status')}</th>
                <th>{tx('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5}>{tx('Loading…')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5}>{tx('No departments found')}</td></tr>
              ) : (
                filtered.map((dept) => (
                  <tr key={dept.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MdApartment style={{ color: 'var(--color-primary)' }} />
                        <strong>{dept.name}</strong>
                      </div>
                    </td>
                    <td><code>{dept.abbreviation || '—'}</code></td>
                    <td style={{ maxWidth: 280, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                      {dept.description || '—'}
                    </td>
                    <td>
                      <span className={`badge ${dept.is_active !== false ? 'badge-success' : 'badge-danger'}`}>
                        {dept.is_active !== false ? tx('Active') : tx('Inactive')}
                      </span>
                    </td>
                    <td>
                      <RowActionsMenu
                        ariaLabel={tx('Department actions')}
                        items={[
                          {
                            id: 'view-batches',
                            label: tx('View batches'),
                            icon: <MdGroups />,
                            onClick: () => navigate(`/admin/batches?department=${dept.id}`),
                          },
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
        title={editing ? tx('Edit Department') : tx('Add Department')}
        onClose={() => {
          setIsModalOpen(false);
          setEditing(null);
        }}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{tx('Name')} *</label>
            <input
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">{tx('Abbreviation')} *</label>
            <input
              className="form-input"
              value={formData.abbreviation}
              onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value.toUpperCase() })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">{tx('Description')}</label>
            <textarea
              className="form-input"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              {tx('Cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? tx('Save changes') : tx('Create')}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
