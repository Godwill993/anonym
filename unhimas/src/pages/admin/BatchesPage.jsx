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
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
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
      toast.success('Batch created successfully');
      setIsModalOpen(false);
    },
    onError: (err) => toast.error(err.message || 'Failed to create batch'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => updateBatch(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batches'] });
      toast.success('Batch updated successfully');
      setIsModalOpen(false);
      setEditingBatch(null);
    },
    onError: (err) => toast.error(err.message || 'Failed to update batch'),
  });
  const assignCourseMutation = useMutation({
    mutationFn: assignBatchCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batch-courses'] });
      toast.success('Course added to programme');
      setAddCourseOpen(false);
      setCourseForm({ course_id: '', semester_id: '' });
    },
    onError: (err) => toast.error(err.message || 'Failed to add course'),
  });
  const deleteCourseMutation = useMutation({
    mutationFn: deleteBatchCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batch-courses'] });
      toast.success('Course removed from programme');
    },
    onError: (err) => toast.error(err.message || 'Failed to remove course'),
  });
  const completeMutation = useMutation({
    mutationFn: ({ batchId, result }) => markBatchProgrammeCompleted(batchId, result),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batches'] });
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      toast.success('Programme marked completed for batch students');
      setCompleteBatch(null);
    },
    onError: (err) => toast.error(err.message || 'Failed to mark batch completed'),
  });

  const selectedProgramme = programmes.find((p) => p.id === formData.programme_id);

  const isFinalYear = (batch) => {
    const dur = batch.programmes?.duration_years;
    if (!batch.year_of_study || !dur) return false;
    return batch.year_of_study >= Math.ceil(Number(dur));
  };

  const handleOpenAdd = () => {
    setEditingBatch(null);
    const defaultProg = programmes.find((p) => p.code === 'HND') || programmes[0];
    setFormData({
      department_id: departments[0]?.id || '',
      academic_year_id: academicYears.find((y) => y.is_current)?.id || academicYears[0]?.id || '',
      programme_id: defaultProg?.id || '',
      year_of_study: 1,
      name: '',
      level_name: '',
      batch_number: 1,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (batch) => {
    setEditingBatch(batch);
    setFormData({
      department_id: batch.department_id || '',
      academic_year_id: batch.academic_year_id || '',
      programme_id: batch.programme_id || '',
      year_of_study: batch.year_of_study ?? 1,
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
    if (!formData.programme_id) {
      toast.error('Programme is required (HND / B.Tech / M.Tech)');
      return;
    }
    if (!formData.year_of_study || formData.year_of_study < 1) {
      toast.error('Year of study is required');
      return;
    }
    const maxYear = selectedProgramme ? Number(selectedProgramme.duration_years) || 99 : 99;
    if (selectedProgramme && formData.year_of_study > maxYear) {
      toast.error(`Year of study cannot exceed ${maxYear} for ${selectedProgramme.code}`);
      return;
    }
    const payload = {
      ...formData,
      year_of_study: Number(formData.year_of_study),
      batch_number: Number(formData.batch_number) || 1,
    };
    if (editingBatch) {
      updateMutation.mutate({ id: editingBatch.id, updates: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered = batches.filter((b) => {
    const s = search.toLowerCase();
    return (
      b.name?.toLowerCase().includes(s) ||
      b.code?.toLowerCase().includes(s) ||
      b.level_name?.toLowerCase().includes(s) ||
      b.programmes?.code?.toLowerCase().includes(s)
    );
  });

  return (
    <AppLayout pageTitle="Batches / Cohorts">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Batches / Cohorts</h1>
          <p className="page-subtitle">
            Student cohorts by department, programme (HND / B.Tech / M.Tech), year of study, and school year
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <MdAdd /> Add Batch
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 200px' }}>
            <MdSearch style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '1.1rem' }} />
            <input type="text" className="form-input" style={{ paddingLeft: '2.25rem' }} placeholder="Search by name, code, programme…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ minWidth: '180px' }}>
            <select className="form-input" value={selectedDeptFilter} onChange={(e) => setSelectedDeptFilter(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.abbreviation})</option>
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
                <th>Programme</th>
                <th>Year</th>
                <th>School year</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>Loading batches...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdGroups className="empty-state-icon" />
                      <div className="empty-state-title">No Batches Found</div>
                      <div className="empty-state-text">Create cohorts with a programme and year of study.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((batch) => (
                  <tr key={batch.id}>
                    <td><strong>{batch.name}</strong></td>
                    <td><code>{batch.code}</code></td>
                    <td>{batch.departments?.name || '—'}</td>
                    <td>
                      {batch.programmes ? (
                        <><code>{batch.programmes.code}</code><div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{batch.programmes.name}</div></>
                      ) : '—'}
                    </td>
                    <td>
                      {batch.year_of_study != null ? (
                        <span>
                          Year {batch.year_of_study}
                          {batch.programmes?.duration_years != null && <> of {batch.programmes.duration_years}</>}
                          {isFinalYear(batch) && (
                            <span className="badge badge-amber" style={{ marginLeft: 6 }}>Final year</span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    <td>{batch.academic_years?.name || '—'}</td>
                    <td>
                      <span className={`badge ${batch.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {batch.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <RowActionsMenu
                        ariaLabel="Batch actions"
                        items={[
                          { id: 'programme', label: 'Programme / courses', icon: <MdMenuBook />, onClick: () => setProgrammeBatch(batch) },
                          { id: 'edit', label: 'Edit', icon: <MdEdit />, onClick: () => handleOpenEdit(batch) },
                          {
                            id: 'complete',
                            label: 'Mark programme completed',
                            icon: <MdCheckCircle />,
                            onClick: () => { setCompleteBatch(batch); setCompleteResult('pass'); },
                            hidden: !isFinalYear(batch),
                          },
                          {
                            id: 'toggle',
                            label: batch.is_active ? 'Deactivate' : 'Activate',
                            icon: batch.is_active ? <MdToggleOn /> : <MdToggleOff />,
                            onClick: () => updateMutation.mutate({ id: batch.id, updates: { is_active: !batch.is_active } }),
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingBatch ? 'Edit Batch' : 'Add Batch'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className="form-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Department *</label>
            <select className="form-input" value={formData.department_id} onChange={(e) => setFormData({ ...formData, department_id: e.target.value })} required>
              <option value="">Select department</option>
              {departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Programme *</label>
            <select
              className="form-input"
              value={formData.programme_id}
              onChange={(e) => {
                const pid = e.target.value;
                setFormData({ ...formData, programme_id: pid, year_of_study: 1 });
              }}
              required
            >
              <option value="">Select programme</option>
              {programmes.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.code} — {pr.name} ({pr.duration_years} yr{Number(pr.duration_years) === 1 ? '' : 's'})
                </option>
              ))}
            </select>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0' }}>
              HND (2 yrs), B.Tech (1 yr), M.Tech (2 yrs) — system programmes
            </p>
          </div>
          <div className="form-group">
            <label className="form-label">Year of study *</label>
            <input
              type="number"
              min={1}
              max={selectedProgramme ? Number(selectedProgramme.duration_years) || 6 : 6}
              className="form-input"
              value={formData.year_of_study}
              onChange={(e) => setFormData({ ...formData, year_of_study: Number(e.target.value) || 1 })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">School year *</label>
            <select className="form-input" value={formData.academic_year_id} onChange={(e) => setFormData({ ...formData, academic_year_id: e.target.value })} required>
              <option value="">Select year</option>
              {academicYears.map((y) => (<option key={y.id} value={y.id}>{y.name}{y.is_current ? ' (current)' : ''}</option>))}
            </select>
          </div>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Level name</label>
              <input className="form-input" value={formData.level_name} onChange={(e) => setFormData({ ...formData, level_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Batch number</label>
              <input type="number" min={1} className="form-input" value={formData.batch_number} onChange={(e) => setFormData({ ...formData, batch_number: Number(e.target.value) })} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {editingBatch ? 'Save Changes' : 'Add Batch'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(programmeBatch)}
        onClose={() => setProgrammeBatch(null)}
        title={programmeBatch ? `Programme — ${programmeBatch.name}` : 'Programme'}
        maxWidth="720px"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setProgrammeBatch(null)}>Close</button>
            <button type="button" className="btn btn-primary" onClick={() => setAddCourseOpen(true)}><MdAdd /> Add course</button>
          </>
        }
      >
        {programmeBatch && (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 0 }}>
            {programmeBatch.programmes && <><code>{programmeBatch.programmes.code}</code> · </>}
            {programmeBatch.year_of_study != null && <>Year {programmeBatch.year_of_study}</>}
          </p>
        )}
        {programmeLoading ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading courses...</p>
        ) : batchCourses.length === 0 ? (
          <div className="empty-state" style={{ padding: '1.5rem' }}>
            <MdMenuBook className="empty-state-icon" />
            <div className="empty-state-title">No courses in programme</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Semester</th>
                  <th>Lecturer</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {batchCourses.map((bc) => (
                  <tr key={bc.id}>
                    <td><code>{bc.courses?.code}</code> <strong>{bc.courses?.name}</strong></td>
                    <td>{bc.semesters?.name || '—'}</td>
                    <td>{bc.lecturers ? `${bc.lecturers.first_name} ${bc.lecturers.last_name}` : <span className="badge badge-amber">Unassigned</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn-icon" title="Remove" onClick={() => deleteCourseMutation.mutate(bc.id)} disabled={deleteCourseMutation.isPending}>
                        <MdDelete style={{ color: 'var(--color-secondary)' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal isOpen={addCourseOpen} onClose={() => setAddCourseOpen(false)} title="Add course to programme">
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!courseForm.course_id || !courseForm.semester_id || !programmeBatch?.id) {
            toast.error('Course and semester are required');
            return;
          }
          assignCourseMutation.mutate({
            batch_id: programmeBatch.id,
            course_id: courseForm.course_id,
            semester_id: courseForm.semester_id,
            is_compulsory: true,
          });
        }}>
          <div className="form-group">
            <label className="form-label">Course *</label>
            <select className="form-input" value={courseForm.course_id} onChange={(e) => setCourseForm({ ...courseForm, course_id: e.target.value })} required>
              <option value="">Choose course...</option>
              {courses.map((c) => (<option key={c.id} value={c.id}>{c.code} — {c.name}</option>))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Semester *</label>
            <select className="form-input" value={courseForm.semester_id} onChange={(e) => setCourseForm({ ...courseForm, semester_id: e.target.value })} required>
              <option value="">Choose semester...</option>
              {semesters.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-outline" onClick={() => setAddCourseOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={assignCourseMutation.isPending}>Add course</button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(completeBatch)}
        onClose={() => setCompleteBatch(null)}
        title="Mark programme completed"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setCompleteBatch(null)}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={completeMutation.isPending}
              onClick={() => completeMutation.mutate({ batchId: completeBatch.id, result: completeResult })}
            >
              <MdCheckCircle /> {completeMutation.isPending ? 'Saving…' : 'Confirm completion'}
            </button>
          </>
        }
      >
        {completeBatch && (
          <>
            <p>
              Mark all active students in <strong>{completeBatch.name}</strong> as having completed{' '}
              {completeBatch.programmes ? <code>{completeBatch.programmes.code}</code> : 'their programme'}.
            </p>
            <div className="form-group">
              <label className="form-label">Result</label>
              <select className="form-input" value={completeResult} onChange={(e) => setCompleteResult(e.target.value)}>
                <option value="pass">Pass (eligible for next programme)</option>
                <option value="fail_or_exit">Fail / exit</option>
              </select>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Only use this for final-year batches (e.g. HND Year 2, B.Tech Year 1, M.Tech Year 2).
            </p>
          </>
        )}
      </Modal>
    </AppLayout>
  );
}
