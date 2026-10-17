import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdd, MdApartment, MdEdit, MdToggleOn, MdToggleOff } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import DataTable from '../../components/common/DataTable';
import { toast } from '../../components/common/Toast';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
} from '../../services/academicService';

export default function DepartmentsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);

  // Form State
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
      toast.success('Department created successfully');
      handleCloseModal();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create department');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => updateDepartment(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
      toast.success('Department updated successfully');
      handleCloseModal();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update department');
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
      toast.error('Name and abbreviation are required');
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

  const columns = [
    {
      key: 'name',
      header: 'Department Name',
      sortable: true,
      render: (row) => (
        <div>
          <strong>{row.name}</strong>
          {row.description && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {row.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'abbreviation',
      header: 'Abbreviation',
      sortable: true,
      render: (row) => <span className="badge badge-blue">{row.abbreviation}</span>,
    },
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      render: (row) => (
        <code style={{ fontSize: '0.8rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px' }}>
          {row.code || '—'}
        </code>
      ),
    },
    {
      key: 'batches',
      header: 'Batches',
      sortable: true,
      accessor: (row) => row.batches?.[0]?.count ?? 0,
    },
    {
      key: 'courses',
      header: 'Courses',
      sortable: true,
      accessor: (row) => row.courses?.[0]?.count ?? 0,
    },
    {
      key: 'lecturers',
      header: 'Faculty Lecturers',
      sortable: true,
      accessor: (row) => row.lecturers?.[0]?.count ?? 0,
    },
    {
      key: 'is_active',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <span className={`badge ${row.is_active ? 'badge-green' : 'badge-gray'}`}>
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
          <button
            className="btn-icon"
            title="Edit department"
            onClick={() => handleOpenEdit(row)}
          >
            <MdEdit />
          </button>
          <button
            className="btn-icon"
            title={row.is_active ? 'Deactivate' : 'Activate'}
            onClick={() => handleToggleStatus(row)}
          >
            {row.is_active ? (
              <MdToggleOn style={{ color: '#059669', fontSize: '1.25rem' }} />
            ) : (
              <MdToggleOff style={{ color: 'var(--color-text-muted)', fontSize: '1.25rem' }} />
            )}
          </button>
        </div>
      ),
    },
  ];

  return (
    <AppLayout pageTitle="Departments">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Departments</h1>
          <p className="page-subtitle">Manage university academic faculties & departmental codes</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <MdAdd /> Add Department
          </button>
        </div>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={departments}
          isLoading={isLoading}
          searchPlaceholder="Search departments by name, code or abbreviation..."
          searchFilter={(item, query) => {
            const q = query.toLowerCase();
            return (
              item.name?.toLowerCase().includes(q) ||
              item.abbreviation?.toLowerCase().includes(q) ||
              item.code?.toLowerCase().includes(q)
            );
          }}
          exportFileName="unhimas_departments"
          emptyTitle="No Departments Found"
          emptySubtitle="Create your first academic department to begin building curricula."
          emptyIcon={<MdApartment />}
        />
      </div>

      {/* Add / Edit Department Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingDept ? 'Edit Department' : 'Add New Department'}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={handleCloseModal}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingDept ? 'Update Department' : 'Create Department'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Department Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Computer Engineering"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Abbreviation *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. CEN or SWE"
              value={formData.abbreviation}
              onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value.toUpperCase() })}
              required
            />
            <div className="form-hint">
              Used in generated codes (e.g. UNH-CEN-...)
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <textarea
              className="form-input"
              rows="3"
              placeholder="Brief summary of department focus..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
