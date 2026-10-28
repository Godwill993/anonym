import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdd, MdBook, MdSearch, MdEdit, MdToggleOn, MdToggleOff } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import RowActionsMenu from '../../components/common/RowActionsMenu';
import { toast } from '../../components/common/Toast';
import {
  getCourses,
  createCourse,
  updateCourse,
  getDepartments,
} from '../../services/academicService';

export default function CoursesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);

  const [formData, setFormData] = useState({
    department_id: '',
    code: '',
    name: '',
    credit_units: 3,
  });

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['admin-courses'],
    queryFn: () => getCourses(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: getDepartments,
  });

  const createMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      toast.success('Course created successfully');
      handleCloseModal();
    },
    onError: (err) => toast.error(err.message || 'Failed to create course'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => updateCourse(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      toast.success('Course updated successfully');
      handleCloseModal();
    },
    onError: (err) => toast.error(err.message || 'Failed to update course'),
  });

  const handleOpenAdd = () => {
    setEditingCourse(null);
    setFormData({
      department_id: departments[0]?.id || '',
      code: '',
      name: '',
      credit_units: 3,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c) => {
    setEditingCourse(c);
    setFormData({
      department_id: c.department_id || '',
      code: c.code || '',
      name: c.name || '',
      credit_units: c.credit_units ?? 3,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCourse(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim() || !formData.department_id) {
      toast.error('Department, code, and name are required');
      return;
    }
    if (editingCourse) {
      updateMutation.mutate({ id: editingCourse.id, updates: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleToggleStatus = (c) => {
    updateMutation.mutate({ id: c.id, updates: { is_active: !c.is_active } });
  };

  const filtered = courses.filter((c) => {
    const s = search.toLowerCase();
    const matchSearch =
      c.code?.toLowerCase().includes(s) ||
      c.name?.toLowerCase().includes(s);
    const matchDept = deptFilter ? c.department_id === deptFilter : true;
    return matchSearch && matchDept;
  });

  return (
    <AppLayout pageTitle="Courses">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Courses</h1>
          <p className="page-subtitle">Curriculum catalogue by department and credit load</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <MdAdd /> Add Course
          </button>
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
                fontSize: '1.1rem',
              }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.25rem' }}
              placeholder="Search by code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ minWidth: '180px' }}>
            <select
              className="form-input"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
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

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Department</th>
                <th>Credits</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>
                    Loading courses...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdBook className="empty-state-icon" />
                      <div className="empty-state-title">No Courses Found</div>
                      <div className="empty-state-text">Add courses to build your curriculum catalogue.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <code style={{ fontSize: '0.85rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {c.code}
                      </code>
                    </td>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>{c.departments?.name} ({c.departments?.abbreviation})</td>
                    <td>
                      <span className="badge badge-blue">{c.credit_units} Credits</span>
                    </td>
                    <td>
                      <span className={`badge ${c.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {c.is_active ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <RowActionsMenu
                        ariaLabel="Course actions"
                        items={[
                          {
                            id: 'edit',
                            label: 'Edit',
                            icon: <MdEdit />,
                            onClick: () => handleOpenEdit(c),
                          },
                          {
                            id: 'toggle',
                            label: c.is_active ? 'Deactivate' : 'Activate',
                            icon: c.is_active ? <MdToggleOn /> : <MdToggleOff />,
                            onClick: () => handleToggleStatus(c),
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
        onClose={handleCloseModal}
        title={editingCourse ? 'Edit Course' : 'Add Course'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Department *</label>
            <select
              className="form-input"
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
              required
            >
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Code *</label>
            <input
              className="form-input"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Credit units</label>
            <input
              type="number"
              min={1}
              className="form-input"
              value={formData.credit_units}
              onChange={(e) => setFormData({ ...formData, credit_units: Number(e.target.value) })}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-outline" onClick={handleCloseModal}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {editingCourse ? 'Save Changes' : 'Add Course'}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
