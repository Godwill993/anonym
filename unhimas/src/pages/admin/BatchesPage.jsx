import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  MdCheckCircle,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import RowActionsMenu from '../../components/common/RowActionsMenu';
import { toast } from '../../components/common/Toast';
import {
  getBatches,
  createBatch,
  updateBatch,
  getDepartments,
  getAcademicYears,
  getProgrammes,
  getCourses,
  getSemesters,
  getBatchCourses,
  assignBatchCourse,
  deleteBatchCourse,
  markBatchProgrammeCompleted,
} from '../../services/academicService';

export default function BatchesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const deptFromUrl = searchParams.get('department') || '';
  const [selectedDeptFilter, setSelectedDeptFilter] = useState(deptFromUrl);

  useEffect(() => {
    const d = searchParams.get('department') || '';
    setSelectedDeptFilter(d);
  }, [searchParams]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [programmeBatch, setProgrammeBatch] = useState(null);
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [courseForm, setCourseForm] = useState({ course_id: '', semester_id: '' });
  const [completeBatch, setCompleteBatch] = useState(null);
  const [completeResult, setCompleteResult] = useState('pass');

  const [formData, setFormData] = useState({
    department_id: '',
    academic_year_id: '',
    programme_id: '',
    year_of_study: 1,
    name: '',
    level_name: '',
    batch_number: 1,
  });

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['admin-batches', selectedDeptFilter],
    queryFn: () => getBatches(selectedDeptFilter || null),
  });
  const { data: departments = [] } = useQuery({ queryKey: ['admin-departments'], queryFn: getDepartments });
  const { data: academicYears = [] } = useQuery({ queryKey: ['admin-academic-years'], queryFn: getAcademicYears });
  const { data: programmes = [] } = useQuery({
    queryKey: ['admin-programmes-active'],
    queryFn: () => getProgrammes({ activeOnly: true }),
  });
  const { data: courses = [] } = useQuery({
    queryKey: ['admin-courses'],
    queryFn: () => getCourses(),
    enabled: Boolean(programmeBatch) || addCourseOpen,
  });
  const { data: semesters = [] } = useQuery({
    queryKey: ['admin-semesters'],
    queryFn: () => getSemesters(),
    enabled: Boolean(programmeBatch) || addCourseOpen,
  });
  const { data: batchCourses = [], isLoading: programmeLoading } = useQuery({
    queryKey: ['admin-batch-courses', programmeBatch?.id],
    queryFn: () => getBatchCourses({ batchId: programmeBatch.id }),
    enabled: Boolean(programmeBatch?.id),
  });

  const createMutation = useMutation({
    mutationFn: createBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batches'] });
      toast.success('Batch created');
      setIsModalOpen(false);
    },
    onError: (err) => toast.error(err.message || 'Failed to create batch'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => updateBatch(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batches'] });
      toast.success('Batch updated');
      setIsModalOpen(false);
      setEditingBatch(null);
    },
    onError: (err) => toast.error(err.message || 'Failed to update batch'),
  });

  const completeMutation = useMutation({
    mutationFn: ({ batchId, result }) => markBatchProgrammeCompleted(batchId, result),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batches'] });
      toast.success('Programme completion recorded');
      setCompleteBatch(null);
    },
    onError: (err) => toast.error(err.message || 'Failed to complete programme'),
  });

  const assignCourseMutation = useMutation({
    mutationFn: (payload) => assignBatchCourse(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batch-courses', programmeBatch?.id] });
      toast.success('Course assigned');
      setAddCourseOpen(false);
      setCourseForm({ course_id: '', semester_id: '' });
    },
    onError: (err) => toast.error(err.message || 'Failed to assign course'),
  });

  const removeCourseMutation = useMutation({
    mutationFn: (id) => deleteBatchCourse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batch-courses', programmeBatch?.id] });
      toast.success('Course removed');
    },
    onError: (err) => toast.error(err.message || 'Failed to remove course'),
  });

  const openAdd = () => {
    setEditingBatch(null);
    setFormData({
      department_id: departments[0]?.id || '',
      academic_year_id: academicYears[0]?.id || '',
      programme_id: '',
      year_of_study: 1,
      name: '',
      level_name: '',
      batch_number: 1,
    });
    setIsModalOpen(true);
  };

  const openEdit = (batch) => {
    setEditingBatch(batch);
    setFormData({
      department_id: batch.department_id || '',
      academic_year_id: batch.academic_year_id || '',
      programme_id: batch.programme_id || '',
      year_of_study: batch.year_of_study || 1,
      name: batch.name || '',
      level_name: batch.level_name || '',
      batch_number: batch.batch_number || 1,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.department_id || !formData.academic_year_id) {
      toast.error('Name, department, and academic year are required');
      return;
    }
    const payload = {
      ...formData,
      programme_id: formData.programme_id || null,
      year_of_study: Number(formData.year_of_study) || 1,
      batch_number: Number(formData.batch_number) || 1,
    };
    if (editingBatch) {
      updateMutation.mutate({ id: editingBatch.id, updates: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered = (batches || []).filter((b) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (b.name || '').toLowerCase().includes(q) ||
      (b.level_name || '').toLowerCase().includes(q) ||
      (b.departments?.name || '').toLowerCase().includes(q) ||
      (b.programmes?.name || '').toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Batches</h1>
          <p className="page-subtitle">
            Student cohorts by department, programme (HND / B.Tech / M.Tech), year of study, and school year
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openAdd}>
          <MdAdd /> Add Batch
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
            <label className="form-label">Search</label>
            <input
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search batch, level, department…"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
            <label className="form-label">Department</label>
            <select
              className="form-input"
              value={selectedDeptFilter}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedDeptFilter(value);
                if (value) {
                  setSearchParams({ department: value });
                } else {
                  setSearchParams({});
                }
              }}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Department</th>
                <th>Programme</th>
                <th>Year</th>
                <th>Academic year</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7}>No batches found</td></tr>
              ) : (
                filtered.map((batch) => (
                  <tr key={batch.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MdGroups style={{ color: 'var(--color-primary)' }} />
                        <strong>{batch.name}</strong>
                      </div>
                    </td>
                    <td>{batch.departments?.name || '—'}</td>
                    <td>{batch.programmes?.name || '—'}</td>
                    <td>{batch.year_of_study || batch.level_name || '—'}</td>
                    <td>{batch.academic_years?.name || '—'}</td>
                    <td>
                      <span className={`badge ${batch.is_active !== false ? 'badge-success' : 'badge-danger'}`}>
                        {batch.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <RowActionsMenu
                        ariaLabel="Batch actions"
                        items={[
                          {
                            id: 'edit',
                            label: 'Edit',
                            icon: <MdEdit />,
                            onClick: () => openEdit(batch),
                          },
                          {
                            id: 'programme',
                            label: 'Manage courses',
                            icon: <MdMenuBook />,
                            onClick: () => setProgrammeBatch(batch),
                          },
                          {
                            id: 'complete',
                            label: 'Mark programme completed',
                            icon: <MdCheckCircle />,
                            onClick: () => {
                              setCompleteBatch(batch);
                              setCompleteResult('pass');
                            },
                          },
                          {
                            id: 'toggle',
                            label: batch.is_active !== false ? 'Deactivate' : 'Activate',
                            icon: batch.is_active !== false ? <MdToggleOn /> : <MdToggleOff />,
                            onClick: () =>
                              updateMutation.mutate({
                                id: batch.id,
                                updates: { is_active: !batch.is_active },
                              }),
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

      {isModalOpen && (
        <Modal
          title={editingBatch ? 'Edit Batch' : 'Add Batch'}
          onClose={() => {
            setIsModalOpen(false);
            setEditingBatch(null);
          }}
        >
          <form onSubmit={handleSubmit}>
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
              <label className="form-label">Academic year *</label>
              <select
                className="form-input"
                value={formData.academic_year_id}
                onChange={(e) => setFormData({ ...formData, academic_year_id: e.target.value })}
                required
              >
                <option value="">Select year</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Programme</label>
              <select
                className="form-input"
                value={formData.programme_id}
                onChange={(e) => setFormData({ ...formData, programme_id: e.target.value })}
              >
                <option value="">Select programme</option>
                {programmes.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Year of study</label>
                <input
                  type="number"
                  min={1}
                  className="form-input"
                  value={formData.year_of_study}
                  onChange={(e) => setFormData({ ...formData, year_of_study: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Level name</label>
                <input
                  className="form-input"
                  value={formData.level_name}
                  onChange={(e) => setFormData({ ...formData, level_name: e.target.value })}
                  placeholder="Level 1"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Batch number</label>
                <input
                  type="number"
                  min={1}
                  className="form-input"
                  value={formData.batch_number}
                  onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingBatch ? 'Save changes' : 'Create batch'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {programmeBatch && (
        <Modal title={`Courses — ${programmeBatch.name}`} onClose={() => setProgrammeBatch(null)}>
          <div style={{ marginBottom: 12 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddCourseOpen(true)}>
              <MdAdd /> Assign course
            </button>
          </div>
          {programmeLoading ? (
            <p>Loading…</p>
          ) : batchCourses.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)' }}>No courses assigned to this batch.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Course</th>
                    <th>Semester</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {batchCourses.map((bc) => (
                    <tr key={bc.id}>
                      <td><code>{bc.courses?.code || '—'}</code></td>
                      <td>{bc.courses?.name || '—'}</td>
                      <td>{bc.semesters?.name || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => removeCourseMutation.mutate(bc.id)}
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
      )}

      {addCourseOpen && programmeBatch && (
        <Modal title="Assign course" onClose={() => setAddCourseOpen(false)}>
          <div className="form-group">
            <label className="form-label">Course</label>
            <select
              className="form-input"
              value={courseForm.course_id}
              onChange={(e) => setCourseForm({ ...courseForm, course_id: e.target.value })}
            >
              <option value="">Select…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Semester</label>
            <select
              className="form-input"
              value={courseForm.semester_id}
              onChange={(e) => setCourseForm({ ...courseForm, semester_id: e.target.value })}
            >
              <option value="">Select…</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setAddCourseOpen(false)}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!courseForm.course_id || assignCourseMutation.isPending}
              onClick={() =>
                assignCourseMutation.mutate({
                  batch_id: programmeBatch.id,
                  course_id: courseForm.course_id,
                  semester_id: courseForm.semester_id || null,
                })
              }
            >
              Assign
            </button>
          </div>
        </Modal>
      )}

      {completeBatch && (
        <Modal title="Mark programme completed" onClose={() => setCompleteBatch(null)}>
          <p style={{ marginBottom: 12 }}>
            {completeBatch.name} — choose result for all active students in this batch.
          </p>
          <div className="form-group">
            <label className="form-label">Result</label>
            <select className="form-input" value={completeResult} onChange={(e) => setCompleteResult(e.target.value)}>
              <option value="pass">Pass</option>
              <option value="fail_or_exit">Fail / exit</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setCompleteBatch(null)}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={completeMutation.isPending}
              onClick={() => completeMutation.mutate({ batchId: completeBatch.id, result: completeResult })}
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
