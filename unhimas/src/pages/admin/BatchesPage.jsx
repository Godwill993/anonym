import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdAdd,
  MdGroups,
  MdToggleOn,
  MdToggleOff,
  MdEdit,
  MdMenuBook,
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
  resolveProgrammeEndAcademicYear,
} from '../../services/academicService';
import { getProgrammeAcademicYearRangeLabel } from '../../lib/programmeAcademicYear';
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

  const selectedProgramme = programmes.find((p) => p.id === formData.programme_id) || null;
  const { data: effectiveDuration, isLoading: durationLoading } = useQuery({
    queryKey: ['effective-programme-duration', formData.programme_id, formData.department_id],
    queryFn: () => getEffectiveProgrammeDuration(formData.programme_id, formData.department_id),
    enabled: isModalOpen && Boolean(formData.programme_id && formData.department_id),
  });
  const endAcademicYear = resolveProgrammeEndAcademicYear(
    academicYears,
    formData.academic_year_id,
    effectiveDuration,
  );

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
    const defaultProg = programmes.find((p) => p.code === 'HND') || programmes[0] || null;
    const currentYear = academicYears.find((y) => y.is_current) || academicYears[0] || null;
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.department_id || !formData.academic_year_id) {
      toast.error(translateText('Name, department, and school year are required'));
      return;
    }
    if (!formData.programme_id) {
      toast.error(translateText('Programme is required'));
      return;
    }
    if (durationLoading) {
      toast.error(translateText('Please wait'));
      return;
    }
    if (!endAcademicYear) {
      toast.error(translateText('Add the required future academic years before creating this batch.'));
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
      (b.programmes?.name || '').toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout pageTitle={translateText('Batch')}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{translateText('Batch')}</h1>
          <p className="page-subtitle">
            {translateText('Student groups for a programme, from start year to end year')}
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
            />
          </div>
          <div style={{ minWidth: 200 }}>
            <select
              className="form-input"
              value={selectedDeptFilter}
              onChange={(e) => {
                const value = e.target.value;
                if (value) setSearchParams({ department: value });
                else setSearchParams({});
              }}
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
                    <td>{batch.departments?.name || '-'}</td>
                    <td>{batch.programmes?.name || '-'}</td>
                    <td>{getProgrammeAcademicYearRangeLabel(batch) || batch.level_name || '-'}</td>
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
              <label className="form-label">{translateText('Name')} *</label>
              <input
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">{translateText('Department')} *</label>
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
              <label className="form-label">{translateText('Programme start academic year')} *</label>
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
              <label className="form-label">{translateText('Programme')} *</label>
              <select
                className="form-input"
                value={formData.programme_id}
                onChange={(e) => setFormData({ ...formData, programme_id: e.target.value })}
                required
              >
                <option value="">{translateText('Select programme')}</option>
                {programmes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
                {translateText('Cancel')}
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingBatch ? translateText('Save') : translateText('Create batch')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {programmeBatch && (
        <Modal
          title={`${translateText('Manage courses')} - ${programmeBatch.name}`}
          onClose={() => setProgrammeBatch(null)}
        >
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
            {translateText('Courses for this batch. Choose from the course list and set the semester.')}
          </p>
          {programmeLoading ? (
            <p>{translateText('Loading…')}</p>
          ) : batchCourses.length === 0 ? (
            <p>{translateText('No courses assigned to this batch.')}</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem' }}>
              {batchCourses.map((bc) => (
                <li
                  key={bc.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <span>
                    {bc.courses?.code || ''} {bc.courses?.title || bc.courses?.name || ''}
                    {bc.semesters?.name ? ` (${bc.semesters.name})` : ''}
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      if (window.confirm(translateText('Remove this course?'))) {
                        removeCourseMutation.mutate(bc.id);
                      }
                    }}
                  >
                    {translateText('Remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!addCourseOpen ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddCourseOpen(true)}>
              <MdAdd /> {translateText('Add course')}
            </button>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <select
                className="form-input"
                value={courseForm.course_id}
                onChange={(e) => setCourseForm({ ...courseForm, course_id: e.target.value })}
              >
                <option value="">{translateText('Select course')}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} - {c.title || c.name}</option>
                ))}
              </select>
              <select
                className="form-input"
                value={courseForm.semester_id}
                onChange={(e) => setCourseForm({ ...courseForm, semester_id: e.target.value })}
              >
                <option value="">{translateText('Select semester')}</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!courseForm.course_id || !courseForm.semester_id || assignCourseMutation.isPending}
                  onClick={() =>
                    assignCourseMutation.mutate({
                      batch_id: programmeBatch.id,
                      course_id: courseForm.course_id,
                      semester_id: courseForm.semester_id,
                    })
                  }
                >
                  {translateText('Save')}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setAddCourseOpen(false)}>
                  {translateText('Cancel')}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </AppLayout>
  );
}
