import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdAdd,
  MdGroups,
  MdSearch,
  MdToggleOn,
  MdToggleOff,
  MdEdit,
  MdMenuBook,
  MdDelete,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import { toast } from '../../components/common/Toast';
import {
  getBatches,
  createBatch,
  updateBatch,
  getDepartments,
  getAcademicYears,
  getCourses,
  getSemesters,
  getBatchCourses,
  assignBatchCourse,
  deleteBatchCourse,
} from '../../services/academicService';

export default function BatchesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);

  // Programme (courses for a specific batch)
  const [programmeBatch, setProgrammeBatch] = useState(null);
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [courseForm, setCourseForm] = useState({ course_id: '', semester_id: '' });

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

  const { data: programmeCourses = [], isLoading: programmeLoading } = useQuery({
    queryKey: ['batch-programme', programmeBatch?.id],
    queryFn: () => getBatchCourses({ batchId: programmeBatch.id }),
    enabled: !!programmeBatch?.id,
  });

  const { data: allCourses = [] } = useQuery({
    queryKey: ['admin-courses', programmeBatch?.department_id],
    queryFn: () => getCourses(programmeBatch?.department_id || null),
    enabled: !!programmeBatch?.id,
  });

  const { data: semesters = [] } = useQuery({
    queryKey: ['admin-semesters'],
    queryFn: () => getSemesters(),
    enabled: !!programmeBatch?.id,
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

  const assignMutation = useMutation({
    mutationFn: assignBatchCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-programme', programmeBatch?.id] });
      toast.success('Course added to this batch');
      setCourseForm({ course_id: '', semester_id: '' });
      setAddCourseOpen(false);
    },
    onError: (err) => {
      const msg = err?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        toast.error('This course is already on the batch for that semester');
      } else {
        toast.error(msg || 'Could not add course');
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: deleteBatchCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-programme', programmeBatch?.id] });
      toast.success('Course removed from this batch');
    },
    onError: (err) => {
      toast.error(err.message || 'Could not remove course');
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

  const handleOpenProgramme = (batch) => {
    setProgrammeBatch(batch);
    setAddCourseOpen(false);
    setCourseForm({ course_id: '', semester_id: '' });
  };

  const handleCloseProgramme = () => {
    setProgrammeBatch(null);
    setAddCourseOpen(false);
    setCourseForm({ course_id: '', semester_id: '' });
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

  const handleAddCourse = (e) => {
    e.preventDefault();
    if (!courseForm.course_id || !courseForm.semester_id) {
      toast.error('Select a course and a semester');
      return;
    }
    assignMutation.mutate({
      batch_id: programmeBatch.id,
      course_id: courseForm.course_id,
      semester_id: courseForm.semester_id,
      is_compulsory: true,
    });
  };

  const assignedCourseIds = new Set(programmeCourses.map((bc) => bc.course_id));
  const availableCourses = allCourses.filter((c) => !assignedCourseIds.has(c.id));

  const filteredBatches = batches.filter((b) => {
    const s = search.toLowerCase();
    const matchSearch =
      b.name.toLowerCase().includes(s) ||
      (b.code && b.code.toLowerCase().includes(s)) ||
      (b.departments?.name && b.departments.name.toLowerCase().includes(s));

    const matchDept = selectedDeptFilter ? b.department_id === selectedDeptFilter : true;
    return matchSearch && matchDept;
  });

  return (
    <AppLayout pageTitle="Academic Batches">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Batches / Student Cohorts</h1>
          <p className="page-subtitle">
            Manage class groups and their programme (courses by semester)
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <MdAdd /> Create Batch
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
              placeholder="Search batches by name, code, or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ minWidth: '180px' }}>
            <select
              className="form-input"
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Department</th>
                <th>Academic Year</th>
                <th>Level</th>
                <th>Students</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                    Loading batches...
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdGroups className="empty-state-icon" />
                      <div className="empty-state-title">No Batches Found</div>
                      <div className="empty-state-text">
                        Create your first cohort (e.g. UNH-SWE-26 Batch 1) to start registering students.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch) => (
                  <tr key={batch.id}>
                    <td>
                      <strong>{batch.name}</strong>
                    </td>
                    <td>
                      <code
                        style={{
                          fontSize: '0.8rem',
                          background: 'var(--color-bg)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        {batch.code || '—'}
                      </code>
                    </td>
                    <td>
                      {batch.departments?.name} ({batch.departments?.abbreviation})
                    </td>
                    <td>{batch.academic_years?.name}</td>
                    <td>
                      <span className="badge badge-purple">{batch.level_name || 'Level 1'}</span>
                    </td>
                    <td>
                      <strong>{batch.students?.[0]?.count ?? 0}</strong> students
                    </td>
                    <td>
                      <span className={`badge ${batch.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {batch.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                        <button
                          className="btn-icon"
                          title="Programme — courses for this batch"
                          onClick={() => handleOpenProgramme(batch)}
                        >
                          <MdMenuBook />
                        </button>
                        <button
                          className="btn-icon"
                          title="Edit batch"
                          onClick={() => handleOpenEdit(batch)}
                        >
                          <MdEdit />
                        </button>
                        <button
                          className="btn-icon"
                          title={batch.is_active ? 'Deactivate' : 'Activate'}
                          onClick={() => handleToggleStatus(batch)}
                        >
                          {batch.is_active ? <MdToggleOn /> : <MdToggleOff />}
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

      {/* Create / Edit batch */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingBatch ? 'Edit Batch' : 'Create Batch'}
        footer={
          <>
            <button className="btn btn-outline" type="button" onClick={handleCloseModal}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              type="submit"
              form="batch-form"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving…'
                : editingBatch
                  ? 'Save Changes'
                  : 'Create Batch'}
            </button>
          </>
        }
      >
        <form id="batch-form" onSubmit={handleSubmit}>
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

      {/* Programme: courses for this batch */}
      <Modal
        isOpen={!!programmeBatch}
        onClose={handleCloseProgramme}
        title={programmeBatch ? `Programme — ${programmeBatch.name}` : 'Programme'}
        footer={
          <>
            <button className="btn btn-outline" type="button" onClick={handleCloseProgramme}>
              Close
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setAddCourseOpen(true)}
            >
              <MdAdd /> Add course
            </button>
          </>
        }
      >
        <p style={{ margin: '0 0 1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Courses this cohort studies. Pick from the school catalogue and choose the semester.
          {programmeBatch?.departments?.name
            ? ` Showing courses for ${programmeBatch.departments.name} first.`
            : ''}
        </p>

        {programmeLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Loading programme…
          </div>
        ) : programmeCourses.length === 0 ? (
          <div className="empty-state" style={{ padding: '1.5rem 0' }}>
            <MdMenuBook className="empty-state-icon" />
            <div className="empty-state-title">No courses yet</div>
            <div className="empty-state-text">
              This batch has no programme. Add courses from the catalogue so students know what they study.
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: '0.75rem' }}
              onClick={() => setAddCourseOpen(true)}
            >
              <MdAdd /> Add courses
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Course</th>
                  <th>Credits</th>
                  <th>Semester</th>
                  <th style={{ textAlign: 'right' }}>Remove</th>
                </tr>
              </thead>
              <tbody>
                {programmeCourses.map((bc) => (
                  <tr key={bc.id}>
                    <td>
                      <code style={{ fontSize: '0.8rem' }}>{bc.courses?.code || '—'}</code>
                    </td>
                    <td>{bc.courses?.name || '—'}</td>
                    <td>{bc.courses?.credit_units ?? '—'}</td>
                    <td>
                      {bc.semesters?.name || '—'}
                      {bc.semesters?.academic_years?.name
                        ? ` (${bc.semesters.academic_years.name})`
                        : ''}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-icon"
                        title="Remove from this batch"
                        disabled={removeMutation.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remove ${bc.courses?.code || 'this course'} from ${programmeBatch.name}?`,
                            )
                          ) {
                            removeMutation.mutate(bc.id);
                          }
                        }}
                      >
                        <MdDelete />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Add course to batch */}
      <Modal
        isOpen={addCourseOpen && !!programmeBatch}
        onClose={() => setAddCourseOpen(false)}
        title="Add course to batch"
        footer={
          <>
            <button className="btn btn-outline" type="button" onClick={() => setAddCourseOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              type="submit"
              form="add-batch-course-form"
              disabled={assignMutation.isPending}
            >
              {assignMutation.isPending ? 'Adding…' : 'Add to programme'}
            </button>
          </>
        }
      >
        <form id="add-batch-course-form" onSubmit={handleAddCourse}>
          <div className="form-group">
            <label className="form-label">Course *</label>
            <select
              className="form-input"
              value={courseForm.course_id}
              onChange={(e) => setCourseForm({ ...courseForm, course_id: e.target.value })}
              required
            >
              <option value="">Select a course…</option>
              {availableCourses.length === 0 ? (
                <option value="" disabled>
                  No more courses available (create some on Courses page)
                </option>
              ) : (
                availableCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                    {c.credit_units != null ? ` (${c.credit_units} CU)` : ''}
                  </option>
                ))
              )}
            </select>
            <div className="form-hint">
              Catalogue courses for this department. Create new ones under Courses first if needed.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Semester *</label>
            <select
              className="form-input"
              value={courseForm.semester_id}
              onChange={(e) => setCourseForm({ ...courseForm, semester_id: e.target.value })}
              required
            >
              <option value="">Select semester…</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.academic_years?.name ? ` — ${s.academic_years.name}` : ''}
                  {s.is_current ? ' (Current)' : ''}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
