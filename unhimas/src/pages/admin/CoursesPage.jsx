import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdd, MdBook, MdEdit, MdToggleOn, MdToggleOff } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import DataTable from '../../components/common/DataTable';
import { toast } from '../../components/common/Toast';
import {
  getCourses,
  createCourse,
  updateCourse,
  getDepartments,
} from '../../services/academicService';

export default function CoursesPage() {
  const queryClient = useQueryClient();
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
    onError: (err) => {
      toast.error(err.message || 'Failed to create course');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => updateCourse(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      toast.success('Course updated successfully');
      handleCloseModal();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update course');
    },
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

  const handleOpenEdit = (course) => {
    setEditingCourse(course);
    setFormData({
      department_id: course.department_id,
      code: course.code,
      name: course.name,
      credit_units: course.credit_units,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCourse(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.department_id || !formData.code.trim() || !formData.name.trim()) {
      toast.error('All fields are required');
      return;
    }
    if (editingCourse) {
      updateMutation.mutate({
        id: editingCourse.id,
        updates: {
          code: formData.code.trim().toUpperCase(),
          name: formData.name.trim(),
          credit_units: Number(formData.credit_units),
        },
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleToggleStatus = (course) => {
    updateMutation.mutate({
      id: course.id,
      updates: { is_active: !course.is_active },
    });
  };

  const filteredCourses = courses.filter((c) => {
    if (!deptFilter) return true;
    return c.department_id === deptFilter;
  });

  const columns = [
    {
      key: 'code',
      header: 'Course Code',
      sortable: true,
      render: (row) => (
        <code style={{ fontSize: '0.85rem', background: 'var(--color-bg)', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, color: 'var(--color-primary)' }}>
          {row.code}
        </code>
      ),
    },
    {
      key: 'name',
      header: 'Course Title',
      sortable: true,
      render: (row) => <strong>{row.name}</strong>,
    },
    {
      key: 'department',
      header: 'Department',
      sortable: true,
      accessor: (row) => `${row.departments?.name || ''} (${row.departments?.abbreviation || ''})`,
    },
    {
      key: 'credit_units',
      header: 'Credit Units',
      sortable: true,
      render: (row) => <span className="badge badge-blue">{row.credit_units} Credits</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <span className={`badge ${row.is_active ? 'badge-green' : 'badge-gray'}`}>
          {row.is_active ? 'Active' : 'Archived'}
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
            title="Edit course"
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
    <AppLayout pageTitle="Curriculum Courses">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Curriculum Courses</h1>
          <p className="page-subtitle">Configure university courses, credit weights, and departmental syllabi</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <MdAdd /> Add Course
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '1rem 1.25rem 0', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: '220px' }}>
            <select
              className="form-input"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
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
          data={filteredCourses}
          isLoading={isLoading}
          searchPlaceholder="Search courses by code, title, department..."
          searchFilter={(item, query) => {
            const q = query.toLowerCase();
            return (
              item.code?.toLowerCase().includes(q) ||
              item.name?.toLowerCase().includes(q) ||
              item.departments?.name?.toLowerCase().includes(q) ||
              item.departments?.abbreviation?.toLowerCase().includes(q)
            );
          }}
          exportFileName="unhimas_courses"
          emptyTitle="No Courses Found"
          emptySubtitle="Add courses to your academic department (e.g. SWE 101, CEN 205)."
          emptyIcon={<MdBook />}
        />
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingCourse ? 'Edit Course' : 'Add Curriculum Course'}
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
              {editingCourse ? 'Save Changes' : 'Create Course'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          {!editingCourse && (
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
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Course Code *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. SWE 101"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Credit Units *</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="12"
                className="form-input"
                value={formData.credit_units}
                onChange={(e) => setFormData({ ...formData, credit_units: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Course Title *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Introduction to Software Engineering"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
