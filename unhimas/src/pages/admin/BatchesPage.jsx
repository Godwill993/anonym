import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdd, MdGroups, MdToggleOn, MdToggleOff, MdEdit } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import DataTable from '../../components/common/DataTable';
import { toast } from '../../components/common/Toast';
import {
  getBatches,
  createBatch,
  updateBatch,
  getDepartments,
  getAcademicYears,
} from '../../services/academicService';

export default function BatchesPage() {
  const queryClient = useQueryClient();
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);

  const [formData, setFormData] = useState({
    department_id: '',
    academic_year_id: '',
    name: '',
    level_name: 'Level 1',
    batch_number: '1',
  });

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['admin-batches'],
    queryFn: () => getBatches(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: getDepartments,
  });

  const { data: academicYears = [] } = useQuery({
    queryKey: ['admin-academic-years'],
    queryFn: getAcademicYears,
  });

  const createMutation = useMutation({
    mutationFn: createBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batches'] });
      toast.success('Batch created successfully with auto-generated code');
      handleCloseModal();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create batch');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => updateBatch(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batches'] });
      toast.success('Batch updated successfully');
      handleCloseModal();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update batch');
    },
  });

  const handleOpenAdd = () => {
    setEditingBatch(null);
    setFormData({
      department_id: departments[0]?.id || '',
      academic_year_id: academicYears.find((y) => y.is_current)?.id || academicYears[0]?.id || '',
      name: '',
      level_name: 'Level 1',
      batch_number: '1',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (batch) => {
    setEditingBatch(batch);
    setFormData({
      department_id: batch.department_id,
      academic_year_id: batch.academic_year_id,
      name: batch.name,
      level_name: batch.level_name || 'Level 1',
      batch_number: batch.batch_number,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBatch(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.department_id || !formData.academic_year_id) {
      toast.error('All required fields must be filled');
      return;
    }

    if (editingBatch) {
      updateMutation.mutate({
        id: editingBatch.id,
        updates: {
          name: formData.name.trim(),
          level_name: formData.level_name.trim(),
          batch_number: formData.batch_number.trim(),
        },
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleToggleStatus = (batch) => {
    updateMutation.mutate({
      id: batch.id,
      updates: { is_active: !batch.is_active },
    });
  };

  const filteredBatches = batches.filter((b) => {
    if (!selectedDeptFilter) return true;
    return b.department_id === selectedDeptFilter;
  });

  const columns = [
    {
      key: 'name',
      header: 'Batch Name',
      sortable: true,
      render: (row) => <strong>{row.name}</strong>,
    },
    {
      key: 'code',
      header: 'Generated Code',
      sortable: true,
      render: (row) => (
        <code style={{ fontSize: '0.8rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
          {row.code || '—'}
        </code>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      sortable: true,
      accessor: (row) => `${row.departments?.name || ''} (${row.departments?.abbreviation || ''})`,
    },
    {
      key: 'academic_year',
      header: 'Academic Year',
      sortable: true,
      accessor: (row) => row.academic_years?.name || '—',
    },
    {
      key: 'level_name',
      header: 'Level',
      sortable: true,
      render: (row) => <span className="badge badge-purple">{row.level_name || 'Level 1'}</span>,
    },
    {
      key: 'enrolled',
      header: 'Enrolled Students',
      sortable: true,
      accessor: (row) => row.students?.[0]?.count ?? 0,
      render: (row) => <span><strong>{row.students?.[0]?.count ?? 0}</strong> students</span>,
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
            title="Edit batch"
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
    <AppLayout pageTitle="Academic Batches">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Batches / Student Cohorts</h1>
          <p className="page-subtitle">Manage class groups, levels, and department intakes</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <MdAdd /> Create Batch
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '1rem 1.25rem 0', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: '220px' }}>
            <select
              className="form-input"
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              aria-label="Filter by department"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.abbreviation})
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredBatches}
          isLoading={isLoading}
          searchPlaceholder="Search batches by name, code, department..."
          searchFilter={(item, query) => {
            const q = query.toLowerCase();
            return (
              item.name?.toLowerCase().includes(q) ||
              item.code?.toLowerCase().includes(q) ||
              item.departments?.name?.toLowerCase().includes(q) ||
              item.departments?.abbreviation?.toLowerCase().includes(q)
            );
          }}
          exportFileName="unhimas_batches"
          emptyTitle="No Batches Found"
          emptySubtitle="Create your first cohort (e.g. UNH-SWE-26 Batch 1) to start registering students."
          emptyIcon={<MdGroups />}
        />
      </div>

      {/* Add / Edit Batch Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingBatch ? 'Edit Batch' : 'Create New Cohort / Batch'}
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
              {editingBatch ? 'Save Changes' : 'Create Batch'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          {!editingBatch && (
            <>
              <div className="form-group">
                <label className="form-label">Department *</label>
                <select
                  className="form-input"
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  required
                >
                  <option value="">Select department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.abbreviation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Academic Year *</label>
                <select
                  className="form-input"
                  value={formData.academic_year_id}
                  onChange={(e) => setFormData({ ...formData, academic_year_id: e.target.value })}
                  required
                >
                  <option value="">Select academic year...</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.is_current ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Batch Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Software Engineering 2026 Batch A"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Level / Year</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Level 1 or Year 2"
                value={formData.level_name}
                onChange={(e) => setFormData({ ...formData, level_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Batch Number *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 1 or 2"
                value={formData.batch_number}
                onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="form-hint">
            The batch code (e.g. UNH-SWE-26) will be automatically assigned by the database trigger.
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
