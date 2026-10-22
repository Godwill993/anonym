import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdd, MdApartment, MdEdit, MdToggleOn, MdToggleOff, MdSearch } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import { toast } from '../../components/common/Toast';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
} from '../../services/academicService';
import { useTranslation } from '../../i18n';

export default function DepartmentsPage() {
  const { translateText: tx } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    abbreviation: '',
    description: '',
  });

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: getDepartments,
  });

  const createMutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
      toast.success(tx('Department created successfully'));
      handleCloseModal();
    },
    onError: (err) => {
      toast.error(err.message || tx('Failed to create department'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => updateDepartment(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
      toast.success(tx('Department updated successfully'));
      handleCloseModal();
    },
    onError: (err) => {
      toast.error(err.message || tx('Failed to update department'));
    },
  });

  const handleOpenAdd = () => {
    setEditingDept(null);
    setFormData({ name: '', abbreviation: '', description: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (dept) => {
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      abbreviation: dept.abbreviation,
      description: dept.description || '',
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDept(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.abbreviation.trim()) {
      toast.error(tx('Name and abbreviation are required'));
      return;
    }

    if (editingDept) {
      updateMutation.mutate({
        id: editingDept.id,
        updates: {
          name: formData.name.trim(),
          abbreviation: formData.abbreviation.trim().toUpperCase(),
          description: formData.description.trim() || null,
        },
      });
    } else {
      createMutation.mutate({
        name: formData.name.trim(),
        abbreviation: formData.abbreviation.trim().toUpperCase(),
        description: formData.description.trim() || null,
      });
    }
  };

  const handleToggleStatus = (dept) => {
    updateMutation.mutate({
      id: dept.id,
      updates: { is_active: !dept.is_active },
    });
  };

  const filteredDepts = departments.filter((d) => {
    const s = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(s) ||
      d.abbreviation.toLowerCase().includes(s) ||
      (d.code && d.code.toLowerCase().includes(s))
    );
  });

  return (
    <AppLayout pageTitle={tx('Departments')}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{tx('Departments')}</h1>
          <p className="page-subtitle">{tx('Manage university academic faculties & departmental codes')}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <MdAdd /> {tx('Add')} {tx('Department')}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ position: 'relative', minWidth: '260px', flex: '1 1 200px' }}>
            <MdSearch
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
                fontSize: '1.1rem',
              }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.25rem' }}
              placeholder={tx('Search departments by name, code or abbreviation...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {tx('Total')}: <strong>{departments.length}</strong>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{tx('Department Name')}</th>
                <th>{tx('Abbreviation')}</th>
                <th>{tx('Code')}</th>
                <th>{tx('Batches')}</th>
                <th>{tx('Courses')}</th>
                <th>{tx('Faculty Lecturers')}</th>
                <th>{tx('Status')}</th>
                <th style={{ textAlign: 'right' }}>{tx('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                    {tx('Loading...')}
                  </td>
                </tr>
              ) : filteredDepts.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdApartment className="empty-state-icon" />
                      <div className="empty-state-title">{tx('No Departments Found')}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDepts.map((dept) => (
                  <tr key={dept.id}>
                    <td>
                      <strong>{dept.name}</strong>
                      {dept.description && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {dept.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-blue">{dept.abbreviation}</span>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.8rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px' }}>
                        {dept.code || '—'}
                      </code>
                    </td>
                    <td>{dept.batches?.[0]?.count ?? 0}</td>
                    <td>{dept.courses?.[0]?.count ?? 0}</td>
                    <td>{dept.lecturers?.[0]?.count ?? 0}</td>
                    <td>
                      <span className={`badge ${dept.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {dept.is_active ? tx('Active') : tx('Inactive')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                        <button
                          className="btn-icon"
                          title={tx('Edit department')}
                          onClick={() => handleOpenEdit(dept)}
                        >
                          <MdEdit />
                        </button>
                        <button
                          className="btn-icon"
                          title={dept.is_active ? tx('Deactivate') : tx('Activate')}
                          onClick={() => handleToggleStatus(dept)}
                        >
                          {dept.is_active ? <MdToggleOn style={{ color: '#059669', fontSize: '1.25rem' }} /> : <MdToggleOff style={{ color: 'var(--color-text-muted)', fontSize: '1.25rem' }} />}
                        </button>
                      </div>
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
        onClose={handleCloseModal}
        title={editingDept ? tx('Edit') + ' ' + tx('Department') : tx('Add') + ' ' + tx('Department')}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={handleCloseModal}>
              {tx('Cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingDept ? tx('Save Changes') : tx('Save')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{tx('Department Name *')}</label>
            <input
              type="text"
              className="form-input"
              placeholder={tx('e.g. Computer Engineering')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{tx('Abbreviation *')}</label>
            <input
              type="text"
              className="form-input"
              placeholder={tx('e.g. CEN or SWE')}
              value={formData.abbreviation}
              onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value.toUpperCase() })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{tx('Description (Optional)')}</label>
            <textarea
              className="form-input"
              rows="3"
              placeholder={tx('Brief summary of department focus...')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
