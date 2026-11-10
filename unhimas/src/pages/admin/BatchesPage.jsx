import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdAdd,
  MdGroups,
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
  getEffectiveProgrammeDuration,
  getBatchCourses,
  assignBatchCourse,
  deleteBatchCourse,
  markBatchProgrammeCompleted,
  computeIsFinalYear,
  resolveBatchFinalYear,
} from '../../services/academicService';
import {
  getProgrammeAcademicYearRangeLabel,
  isAcademicYearInProgrammeRange,
  isProgrammePeriodComplete,
  resolveProgrammeEndAcademicYear,
} from '../../lib/programmeAcademicYear';
import { useTranslation } from '../../i18n';

export default function BatchesPage() {
  const queryClient = useQueryClient();
  const { translateText } = useTranslation();
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDeptFilter = searchParams.get('department') || '';
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
      toast.success(translateText('Batch created'));
      setIsModalOpen(false);
    },
    onError: (err) => toast.error(err.message || translateText('Failed to create batch')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => updateBatch(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batches'] });
      toast.success(translateText('Batch updated'));
      setIsModalOpen(false);
      setEditingBatch(null);
    },
    onError: (err) => toast.error(err.message || translateText('Failed to update batch')),
  });

  const completeMutation = useMutation({
    mutationFn: ({ batchId, result }) => markBatchProgrammeCompleted(batchId, result),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batches'] });
      toast.success(translateText('Programme completion recorded'));
      setCompleteBatch(null);
    },
    onError: (err) => toast.error(err.message || translateText('Failed to complete programme')),
  });

  const assignCourseMutation = useMutation({
    mutationFn: (payload) => assignBatchCourse(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batch-courses', programmeBatch?.id] });
      toast.success(translateText('Course assigned'));
      setAddCourseOpen(false);
      setCourseForm({ course_id: '', semester_id: '' });
    },
    onError: (err) => toast.error(err.message || translateText('Failed to assign course')),
  });

  const removeCourseMutation = useMutation({
    mutationFn: (id) => deleteBatchCourse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batch-courses', programmeBatch?.id] });
      toast.success(translateText('Course removed'));
    },
    onError: (err) => toast.error(err.message || translateText('Failed to remove course')),
  });

  const openAdd = () => {
    setEditingBatch(null);
    const defaultProg =
      programmes.find((p) => p.code === 'HND') || programmes[0] || null;
    const currentYear =
      academicYears.find((y) => y.is_current) || academicYears[0] || null;
    setFormData({
      department_id: departments[0]?.id || '',
      academic_year_id: currentYear?.id || '',
      programme_id: defaultProg?.id || '',
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
      name: batch.name || '',
      level_name: batch.level_name || '',
      batch_number: batch.batch_number || 1,
    });
    setIsModalOpen(true);
  };

  const selectedProgramme = programmes.find((p) => p.id === formData.programme_id) || null;
  const {
    data: effectiveDuration,
    isLoading: durationLoading,
    error: durationError,
  } = useQuery({
    queryKey: ['effective-programme-duration', formData.programme_id, formData.department_id],
    queryFn: () => getEffectiveProgrammeDuration(formData.programme_id, formData.department_id),
    enabled: isModalOpen && Boolean(formData.programme_id && formData.department_id),
  });
  const endAcademicYear = resolveProgrammeEndAcademicYear(
    academicYears,
    formData.academic_year_id,
    effectiveDuration,
  );
  const isCompletionEligible = (batch) => (
    batch.programme_end_academic_year_id
      ? isProgrammePeriodComplete(batch)
      : computeIsFinalYear({
          year_of_study: batch.year_of_study,
          duration_years: batch.programmes?.duration_years,
        })
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.department_id || !formData.academic_year_id) {
      toast.error(translateText('Name, department, and school year are required'));
      return;
    }
    if (!formData.programme_id) {
      toast.error(translateText('Programme is required (HND, B.Tech, or M.Tech). Students inherit it from this batch.'));
      return;
    }
    if (durationLoading) {
      toast.error(translateText('Wait for the programme duration to finish loading'));
      return;
    }
    if (durationError) {
      toast.error(durationError.message || translateText('Could not load the effective programme duration'));
      return;
    }
    if (!endAcademicYear) {
      toast.error(translateText('Add the required future academic years before creating this cohort.'));
      return;
    }
    const dept = departments.find((d) => d.id === formData.department_id);
    const payload = {
      ...formData,
      programme_id: formData.programme_id,
      programme_end_academic_year_id: endAcademicYear.id,
      year_of_study: null,
      batch_number: Number(formData.batch_number) || 1,
      departmentAbbr: dept?.abbreviation || null,
      programmeCode: selectedProgramme?.code || null,
      programme: selectedProgramme,
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
      (b.programmes?.name || '').toLowerCase().includes(q) ||
      getProgrammeAcademicYearRangeLabel(b).toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout pageTitle={translateText('Batches')}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{translateText('Batches')}</h1>
          <p className="page-subtitle">
            {translateText('Stable student cohorts spanning their programme start and end academic years')}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openAdd}>
          <MdAdd /> {translateText('Add Batch')}
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1rem', padding: '0.875rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={translateText('Search batch, level, department…')}
              aria-label={translateText('Search batch, level, department…')}
            />
          </div>
          <div style={{ minWidth: 200 }}>
            <select
              className="form-input"
              value={selectedDeptFilter}
              onChange={(e) => {
                const value = e.target.value;
                if (value) {
                  setSearchParams({ department: value });
                } else {
                  setSearchParams({});
                }
              }}
              aria-label={translateText('Department')}
            >
              <option value="">{translateText('All departments')}</option>
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
                <th>{translateText('Name')}</th>
                <th>{translateText('Department')}</th>
                <th>{translateText('Programme')}</th>
                <th>{translateText('Programme years')}</th>
                <th>{translateText('Status')}</th>
                <th>{translateText('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6}>{translateText('Loading…')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6}>{translateText('No batches found')}</td></tr>
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
                    <td>
                      {getProgrammeAcademicYearRangeLabel(batch) || batch.level_name || '—'}
                      {isCompletionEligible(batch) && (
                        <span className="badge badge-amber" style={{ marginLeft: 6 }}>{translateText('Programme ended')}</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${batch.is_active !== false ? 'badge-success' : 'badge-danger'}`}>
                        {batch.is_active !== false ? translateText('Active') : translateText('Inactive')}
                      </span>
                    </td>
                    <td>
                      <RowActionsMenu
                        ariaLabel={translateText('Batch actions')}
                        items={[
                          {
                            id: 'edit',
                            label: translateText('Edit'),
                            icon: <MdEdit />,
                            onClick: () => openEdit(batch),
                          },
                          {
                            id: 'programme',
                            label: translateText('Manage courses'),
                            icon: <MdMenuBook />,
                            onClick: () => setProgrammeBatch(batch),
                          },
                          {
                            id: 'complete',
                            label: translateText('Mark programme completed'),
                            icon: <MdCheckCircle />,
                            onClick: async () => {
                              try {
                                const { isFinalYear, source } = await resolveBatchFinalYear(batch);
                                if (!isFinalYear) {
                                  toast.error(
                                    source === 'rpc'
                                      ? translateText('This cohort programme period has not ended yet (server check).')
                                      : translateText('This cohort programme period has not ended yet.'),
                                  );
                                  return;
                                }
                              } catch (err) {
                                toast.error(err.message || translateText('Could not verify final year'));
                                return;
                              }
                              setCompleteBatch(batch);
                              setCompleteResult('pass');
                            },
                            hidden: !isCompletionEligible(batch),
                          },
                          {
                            id: 'toggle',
                            label: batch.is_active !== false ? translateText('Deactivate') : translateText('Activate'),
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
          title={editingBatch ? translateText('Edit Batch') : translateText('Add Batch')}
          onClose={() => {
            setIsModalOpen(false);
            setEditingBatch(null);
          }}
        >
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{translateText('Name *')}</label>
              <input
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">{translateText('Department *')}</label>
              <select
                className="form-input"
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                required
              >
                <option value="">{translateText('Select department')}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{translateText('Programme start academic year *')}</label>
              <select
                className="form-input"
                value={formData.academic_year_id}
                onChange={(e) => setFormData({ ...formData, academic_year_id: e.target.value })}
                required
              >
                <option value="">{translateText('Select start year')}</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{translateText('Programme *')}</label>
              <select
                className="form-input"
                value={formData.programme_id}
                onChange={(e) => {
                  const pid = e.target.value;
                  setFormData({ ...formData, programme_id: pid });
                }}
                required
              >
                <option value="">{translateText('Select programme')}</option>
                {programmes.map((p) => {
                  const duration = p.id === formData.programme_id
                    ? effectiveDuration ?? p.duration_years
                    : p.duration_years;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                      {duration != null ? ` (${duration} ${Number(duration) === 1 ? translateText('yr') : translateText('yrs')})` : ''}
                    </option>
                  );
                })}
              </select>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0' }}>
                {translateText('Students inherit this programme from the batch. The effective duration sets the cohort end year.')}
                {effectiveDuration != null && ` ${translateText('Effective duration:')} ${effectiveDuration} ${translateText('academic year(s).')}`}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">{translateText('Programme end academic year')}</label>
                <input
                  className="form-input"
                  value={durationLoading ? translateText('Calculating…') : (endAcademicYear?.name || '')}
                  placeholder={translateText('Select programme, department, and start year')}
                  readOnly
                />
                {durationError && (
                  <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.78rem', margin: '0.25rem 0 0' }}>
                    {durationError.message}
                  </p>
                )}
                {!endAcademicYear && !durationLoading && !durationError
                  && formData.academic_year_id && formData.programme_id && formData.department_id && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0' }}>
                    {translateText('Add missing future sessions in')} <Link to="/admin/academic-years">{translateText('Academic Years')}</Link>.
                  </p>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">{translateText('Level name')}</label>
                <input
                  className="form-input"
                  value={formData.level_name}
                  onChange={(e) => setFormData({ ...formData, level_name: e.target.value })}
                  placeholder="Level 1"
                />
              </div>
              <div className="form-group">
                <label className="form-label">{translateText('Batch number')}</label>
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
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                {translateText('Cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingBatch ? translateText('Save changes') : translateText('Create batch')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {programmeBatch && (
        <Modal title={`${translateText('Courses')} — ${programmeBatch.name}`} onClose={() => setProgrammeBatch(null)}>
          <div style={{ marginBottom: 12 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddCourseOpen(true)}>
              <MdAdd /> {translateText('Assign course')}
            </button>
          </div>
          {programmeLoading ? (
            <p>{translateText('Loading…')}</p>
          ) : batchCourses.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)' }}>{translateText('No courses assigned to this batch.')}</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{translateText('Code')}</th>
                    <th>{translateText('Course')}</th>
                    <th>{translateText('Semester')}</th>
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
                          title={translateText('Remove course')}
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
        <Modal title={translateText('Assign course')} onClose={() => setAddCourseOpen(false)}>
          <div className="form-group">
            <label className="form-label">{translateText('Course')}</label>
            <select
              className="form-input"
              value={courseForm.course_id}
              onChange={(e) => setCourseForm({ ...courseForm, course_id: e.target.value })}
            >
              <option value="">{translateText('Select…')}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{translateText('Semester')}</label>
            <select
              className="form-input"
              value={courseForm.semester_id}
              onChange={(e) => setCourseForm({ ...courseForm, semester_id: e.target.value })}
            >
              <option value="">{translateText('Select…')}</option>
              {semesters
                .filter((semester) => isAcademicYearInProgrammeRange(semester.academic_years, programmeBatch))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.academic_years?.name}
                  </option>
                ))}
            </select>
            {!semesters.some((semester) => isAcademicYearInProgrammeRange(semester.academic_years, programmeBatch)) && (
              <p className="form-hint">
                {translateText('No semesters are configured within this programme period. Add them in')} <Link to="/admin/academic-years">{translateText('Academic Years')}</Link>.
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setAddCourseOpen(false)}>
              {translateText('Cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!courseForm.course_id || !courseForm.semester_id || assignCourseMutation.isPending}
              onClick={() =>
                assignCourseMutation.mutate({
                  batch_id: programmeBatch.id,
                  course_id: courseForm.course_id,
                  semester_id: courseForm.semester_id,
                  is_compulsory: true,
                })
              }
            >
              {translateText('Assign')}
            </button>
          </div>
        </Modal>
      )}

      {completeBatch && (
        <Modal title={translateText('Mark programme completed')} onClose={() => setCompleteBatch(null)}>
          <p>
            {translateText('Mark all active students in')} <strong>{completeBatch.name}</strong> {translateText('as having completed')}{' '}
            {completeBatch.programmes ? <code>{completeBatch.programmes.code}</code> : translateText('their programme')}.
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {translateText("Completion is available after the cohort's programme end academic year has finished. Requires migration 20261104200000_batch_programme_year_range.sql on Supabase.")}
          </p>
          <div className="form-group">
            <label className="form-label">{translateText('Result')}</label>
            <select className="form-input" value={completeResult} onChange={(e) => setCompleteResult(e.target.value)}>
              <option value="pass">{translateText('Pass')}</option>
              <option value="fail_or_exit">{translateText('Fail / exit')}</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setCompleteBatch(null)}>
              {translateText('Cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={completeMutation.isPending}
              onClick={() => completeMutation.mutate({ batchId: completeBatch.id, result: completeResult })}
            >
              {translateText('Confirm')}
            </button>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
