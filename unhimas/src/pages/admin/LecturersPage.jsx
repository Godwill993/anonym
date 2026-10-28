import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdAdd, MdPersonPin, MdSearch, MdClose, MdEdit, MdDelete,
  MdEmail, MdPhone, MdPersonAdd, MdCheckCircle, MdFileDownload, MdChevronLeft, MdChevronRight,
  MdMenuBook, MdPlaylistAdd,
} from 'react-icons/md';
import { Link } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import RowActionsMenu from '../../components/common/RowActionsMenu';
import { toast } from '../../components/common/Toast';
import { useTranslation } from '../../i18n';
import { usePermissions } from '../../hooks/usePermissions';
import { exportToCsv } from '../../utils/exportUtils';
import { getLecturers, createLecturer, updateLecturer, deleteSchoolAccount } from '../../services/peopleService';
import {
  getDepartments,
  getBatchCourses,
  getBatches,
  getCourses,
  getSemesters,
  assignBatchCourse,
  updateBatchCourse,
  deleteBatchCourse,
} from '../../services/academicService';

export default function LecturersPage() {
  const { language, translateText } = useTranslation();
  const { canManagePeople, canCreateAccounts } = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLecturer, setEditingLecturer] = useState(null);
  const [lecturerToDelete, setLecturerToDelete] = useState(null);
  const [coursesLecturer, setCoursesLecturer] = useState(null);
  const [assignLecturer, setAssignLecturer] = useState(null);
  const [assignForm, setAssignForm] = useState({
    batch_id: '', course_id: '', semester_id: '', is_compulsory: true, existing_id: '', mode: 'new',
  });
  const [formData, setFormData] = useState({
    staff_id: '', first_name: '', middle_name: '', last_name: '', email: '', phone: '', department_id: '', specialization: '',
  });

  const { data: lecturers = [], isLoading } = useQuery({
    queryKey: ['admin-lecturers', deptFilter],
    queryFn: () => getLecturers({ departmentId: deptFilter || null }),
  });
  const { data: departments = [] } = useQuery({ queryKey: ['admin-departments'], queryFn: getDepartments });

  const {
    data: lecturerCourses = [],
    isLoading: coursesLoading,
    isError: coursesError,
    error: coursesErrorObj,
    refetch: refetchCourses,
  } = useQuery({
    queryKey: ['admin-lecturer-courses', coursesLecturer?.id],
    queryFn: async () => {
      if (!coursesLecturer?.id) return [];
      return getBatchCourses({ lecturerId: coursesLecturer.id });
    },
    enabled: Boolean(coursesLecturer?.id),
    retry: 1,
  });

  const { data: allBatchCourses = [], isLoading: allBcLoading } = useQuery({
    queryKey: ['admin-batch-courses'],
    queryFn: () => getBatchCourses(),
    enabled: Boolean(assignLecturer),
  });
  const unassignedAllocations = useMemo(
    () => (allBatchCourses || []).filter((bc) => !bc.lecturer_id),
    [allBatchCourses],
  );

  const { data: batches = [] } = useQuery({
    queryKey: ['admin-batches'],
    queryFn: () => getBatches(),
    enabled: Boolean(assignLecturer),
  });
  const { data: courses = [] } = useQuery({
    queryKey: ['admin-courses'],
    queryFn: () => getCourses(),
    enabled: Boolean(assignLecturer),
  });
  const { data: semesters = [] } = useQuery({
    queryKey: ['admin-semesters'],
    queryFn: () => getSemesters(),
    enabled: Boolean(assignLecturer),
  });

  const createMutation = useMutation({
    mutationFn: createLecturer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lecturers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview-stats'] });
      toast.success(translateText('Lecturer record created. Use "Create Account" to provision their login.'));
      handleCloseModal();
    },
    onError: (err) => toast.error(err.message || translateText('Failed to create lecturer')),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => updateLecturer(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lecturers'] });
      toast.success(translateText('Lecturer updated successfully'));
      handleCloseModal();
    },
    onError: (err) => toast.error(err.message || translateText('Failed to update lecturer')),
  });
  const deleteMutation = useMutation({
    mutationFn: (lecturer) => deleteSchoolAccount({ recordType: 'lecturer', recordId: lecturer.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lecturers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-batch-courses'] });
      toast.success(translateText('Lecturer deleted successfully'));
      setLecturerToDelete(null);
    },
    onError: (err) => toast.error(err.message || translateText('Failed to delete lecturer')),
  });

  const assignCourseMutation = useMutation({
    mutationFn: assignBatchCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batch-courses'] });
      queryClient.invalidateQueries({ queryKey: ['admin-lecturer-courses'] });
      toast.success(translateText('Course assigned to lecturer'));
      setAssignLecturer(null);
    },
    onError: (err) => toast.error(err.message || translateText('Failed to assign course')),
  });

  const unassignMutation = useMutation({
    mutationFn: deleteBatchCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batch-courses'] });
      queryClient.invalidateQueries({ queryKey: ['admin-lecturer-courses'] });
      toast.success(translateText('Course allocation removed'));
    },
    onError: (err) => toast.error(err.message || translateText('Failed to remove allocation')),
  });

  const claimExistingMutation = useMutation({
    mutationFn: ({ id, lecturer_id }) => updateBatchCourse(id, { lecturer_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batch-courses'] });
      queryClient.invalidateQueries({ queryKey: ['admin-lecturer-courses'] });
      toast.success(translateText('Course assigned to lecturer'));
      setAssignLecturer(null);
    },
    onError: (err) => toast.error(err.message || translateText('Failed to assign course')),
  });

  const handleOpenAdd = () => {
    setEditingLecturer(null);
    setFormData({
      staff_id: `LEC-${Math.floor(1000 + Math.random() * 9000)}`,
      first_name: '', middle_name: '', last_name: '', email: '', phone: '',
      department_id: departments[0]?.id || '', specialization: '',
    });
    setIsModalOpen(true);
  };
  const handleOpenEdit = (lec) => {
    setEditingLecturer(lec);
    setFormData({
      staff_id: lec.staff_id, first_name: lec.first_name, middle_name: lec.middle_name || '',
      last_name: lec.last_name, email: lec.email || '', phone: lec.phone || '',
      department_id: lec.department_id || '', specialization: lec.specialization || '',
    });
    setIsModalOpen(true);
  };
  const handleCloseModal = () => { setIsModalOpen(false); setEditingLecturer(null); };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.staff_id.trim() || !formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error(translateText('Staff ID, First Name, and Last Name are required'));
      return;
    }
    if (editingLecturer) updateMutation.mutate({ id: editingLecturer.id, updates: formData });
    else createMutation.mutate(formData);
  };

  const openAssignModal = (lec) => {
    setAssignLecturer(lec);
    setAssignForm({ batch_id: '', course_id: '', semester_id: '', is_compulsory: true, existing_id: '', mode: 'new' });
  };

  const handleAssignSubmit = (e) => {
    e?.preventDefault?.();
    if (!assignLecturer?.id) { toast.error(translateText('No lecturer selected')); return; }
    if (assignForm.mode === 'existing') {
      if (!assignForm.existing_id) { toast.error(translateText('Select an existing course allocation')); return; }
      claimExistingMutation.mutate({ id: assignForm.existing_id, lecturer_id: assignLecturer.id });
      return;
    }
    if (!assignForm.batch_id || !assignForm.course_id || !assignForm.semester_id) {
      toast.error(translateText('Batch, Course, and Semester are required'));
      return;
    }
    assignCourseMutation.mutate({
      batch_id: assignForm.batch_id,
      course_id: assignForm.course_id,
      semester_id: assignForm.semester_id,
      lecturer_id: assignLecturer.id,
      is_compulsory: assignForm.is_compulsory,
    });
  };

  const filteredLecturers = useMemo(() => {
    const term = search.toLowerCase();
    return lecturers.filter((l) =>
      l.staff_id?.toLowerCase().includes(term) ||
      l.first_name?.toLowerCase().includes(term) ||
      l.last_name?.toLowerCase().includes(term) ||
      (l.specialization && l.specialization.toLowerCase().includes(term))
    );
  }, [lecturers, search]);
  const totalPages = Math.ceil(filteredLecturers.length / pageSize) || 1;
  const paginatedLecturers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLecturers.slice(start, start + pageSize);
  }, [filteredLecturers, currentPage, pageSize]);

  const handleExportCsv = () => {
    if (!filteredLecturers.length) return;
    const headers = [
      { label: 'Staff ID', key: 'staff_id' }, { label: 'First Name', key: 'first_name' },
      { label: 'Middle Name', key: 'middle_name' }, { label: 'Last Name', key: 'last_name' },
      { label: 'Department', key: 'department_name' }, { label: 'Specialization', key: 'specialization' },
      { label: 'Email', key: 'email' }, { label: 'Phone', key: 'phone' }, { label: 'Status', key: 'status_label' },
    ];
    const exportRows = filteredLecturers.map((l) => ({
      ...l,
      department_name: l.departments?.name ? `${l.departments.name} (${l.departments.abbreviation})` : '',
      status_label: l.is_active ? 'Active' : 'On Leave',
    }));
    exportToCsv('unhimas_faculty_lecturers', headers, exportRows);
  };

  return (
    <AppLayout pageTitle={translateText('Faculty Lecturers')}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Faculty Lecturers')}</h1>
          <p className="page-subtitle">{translateText('Academic teaching staff, departmental assignments, and credentials')}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={handleExportCsv} disabled={filteredLecturers.length === 0} title={translateText('Export faculty to CSV')}>
            <MdFileDownload /> {translateText('Export CSV')}
          </button>
          {canCreateAccounts && (
            <Link to="/admin/create-account" className="btn btn-outline btn-sm"><MdPersonAdd /> {translateText('Create Account')}</Link>
          )}
          {canManagePeople && (
            <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}><MdAdd /> {translateText('Add Faculty Lecturer')}</button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 200px' }}>
            <MdSearch style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '1.1rem' }} />
            <input type="text" className="form-input" style={{ paddingLeft: '2.25rem', paddingRight: search ? '2rem' : '0.875rem' }} placeholder={translateText('Search by staff ID, name, or specialization...')} value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} />
            {search && (
              <button type="button" onClick={() => { setSearch(''); setCurrentPage(1); }} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} aria-label={translateText('Clear search')}>
                <MdClose size={16} />
              </button>
            )}
          </div>
          <div style={{ minWidth: '180px' }}>
            <select className="form-input" value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setCurrentPage(1); }} aria-label={translateText('Filter by department')}>
              <option value="">{translateText('All Departments')}</option>
              {departments.map((d) => (<option key={d.id} value={d.id}>{d.name} ({d.abbreviation})</option>))}
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{translateText('Staff ID')}</th>
                <th>{translateText('Lecturer Name')}</th>
                <th>{translateText('Primary Department')}</th>
                <th>{translateText('Specialization')}</th>
                <th>{translateText('Contact')}</th>
                <th>{translateText('Status')}</th>
                <th>{translateText('Account')}</th>
                <th style={{ textAlign: 'right' }}>{translateText('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>{translateText('Loading faculty staff...')}</td></tr>
              ) : filteredLecturers.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdPersonPin className="empty-state-icon" />
                      <div className="empty-state-title">{translateText(search ? 'No Matching Lecturers' : 'No Lecturers Found')}</div>
                      <div className="empty-state-text">{translateText(search ? 'No faculty members match your filter criteria.' : 'Add lecturers to assign course loads and track campus hours.')}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLecturers.map((lec) => (
                  <tr key={lec.id}>
                    <td><code style={{ fontSize: '0.85rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, color: 'var(--color-secondary)' }}>{lec.staff_id}</code></td>
                    <td><strong>{lec.first_name} {lec.middle_name ? `${lec.middle_name} ` : ''}{lec.last_name}</strong></td>
                    <td>{lec.departments?.name ? `${lec.departments.name} (${lec.departments.abbreviation})` : '—'}</td>
                    <td>{lec.specialization ? <span className="badge badge-purple">{lec.specialization}</span> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
                    <td>
                      {lec.email && (<div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}><MdEmail style={{ color: 'var(--color-text-muted)' }} /> {lec.email}</div>)}
                      {lec.phone && (<div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}><MdPhone /> {lec.phone}</div>)}
                    </td>
                    <td><span className={`badge ${lec.is_active ? 'badge-green' : 'badge-gray'}`}>{lec.is_active ? translateText('Active') : translateText('On Leave')}</span></td>
                    <td>
                      {lec.profile_id ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#059669' }}><MdCheckCircle /> {translateText('Linked')}</span>
                      ) : canCreateAccounts ? (
                        <Link to="/admin/create-account" className="btn-icon" title={translateText('Create login account for this lecturer')} style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-secondary)' }}>
                          <MdPersonAdd /> {translateText('Create Account')}
                        </Link>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <RowActionsMenu
                        ariaLabel={translateText('Lecturer actions')}
                        items={[
                          { id: 'view-courses', label: translateText('View courses'), icon: <MdMenuBook />, onClick: () => setCoursesLecturer(lec) },
                          { id: 'assign-course', label: translateText('Assign course'), icon: <MdPlaylistAdd />, onClick: () => openAssignModal(lec), hidden: !canManagePeople },
                          { id: 'edit', label: translateText('Edit'), icon: <MdEdit />, onClick: () => handleOpenEdit(lec), hidden: !canManagePeople },
                          { id: 'delete', label: translateText('Delete'), icon: <MdDelete />, onClick: () => setLecturerToDelete(lec), disabled: deleteMutation.isPending, danger: true, hidden: !canManagePeople },
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredLecturers.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderTop: '1px solid var(--color-border)', fontSize: '0.8125rem', color: 'var(--color-text-muted)', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                {language === 'fr'
                  ? `Affichage de ${(currentPage - 1) * pageSize + 1} à ${Math.min(currentPage * pageSize, filteredLecturers.length)} sur ${filteredLecturers.length} enseignants`
                  : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, filteredLecturers.length)} of ${filteredLecturers.length} faculty members`}
              </div>
              {filteredLecturers.length > 10 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem' }}>{translateText('Per page:')}</span>
                  <select className="form-input" style={{ height: '30px', padding: '0.1rem 0.5rem', width: 'auto', fontSize: '0.75rem' }} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} aria-label={translateText('Select rows per page')}>
                    <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
                  </select>
                </div>
              )}
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button type="button" className="btn btn-outline btn-sm" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} aria-label={translateText('Previous page')}>
                  <MdChevronLeft /> {translateText('Prev')}
                </button>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 0.5rem' }}>{currentPage} / {totalPages}</span>
                <button type="button" className="btn btn-outline btn-sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} aria-label={translateText('Next page')}>
                  {translateText('Next')} <MdChevronRight />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingLecturer ? translateText('Edit Lecturer') : translateText('Add Faculty Lecturer')}>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label">{translateText('Staff ID')} *</label><input className="form-input" value={formData.staff_id} onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })} required /></div>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group"><label className="form-label">{translateText('First Name')} *</label><input className="form-input" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">{translateText('Middle Name')}</label><input className="form-input" value={formData.middle_name} onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">{translateText('Last Name')} *</label><input className="form-input" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} required /></div>
          </div>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group"><label className="form-label">{translateText('Email')}</label><input type="email" className="form-input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">{translateText('Phone')}</label><input className="form-input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
          </div>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group"><label className="form-label">{translateText('Department')}</label><select className="form-input" value={formData.department_id} onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}><option value="">{translateText('Select department')}</option>{departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}</select></div>
            <div className="form-group"><label className="form-label">{translateText('Specialization')}</label><input className="form-input" value={formData.specialization} onChange={(e) => setFormData({ ...formData, specialization: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-outline" onClick={handleCloseModal}>{translateText('Cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>{editingLecturer ? translateText('Save Changes') : translateText('Add Lecturer')}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(coursesLecturer)} onClose={() => setCoursesLecturer(null)} title={translateText('Courses taught')} maxWidth="720px" footer={<><button type="button" className="btn btn-outline" onClick={() => setCoursesLecturer(null)}>{translateText('Close')}</button>{canManagePeople && coursesLecturer && (<button type="button" className="btn btn-primary" onClick={() => { const lec = coursesLecturer; setCoursesLecturer(null); openAssignModal(lec); }}><MdPlaylistAdd /> {translateText('Assign course')}</button>)}</>}>
        {coursesLecturer && (<p style={{ marginTop: 0, marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}><strong>{coursesLecturer.first_name} {coursesLecturer.last_name}</strong>{coursesLecturer.staff_id ? ` · ${coursesLecturer.staff_id}` : ''}</p>)}
        {coursesLoading ? (<p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>{translateText('Loading courses...')}</p>) : coursesError ? (<div className="empty-state" style={{ padding: '1.5rem' }}><div className="empty-state-title">{translateText('Could not load courses')}</div><div className="empty-state-text" style={{ marginBottom: '0.75rem' }}>{coursesErrorObj?.message || translateText('Something went wrong. Try again.')}</div><button type="button" className="btn btn-outline btn-sm" onClick={() => refetchCourses()}>{translateText('Retry')}</button></div>) : lecturerCourses.length === 0 ? (<div className="empty-state" style={{ padding: '1.5rem' }}><MdMenuBook className="empty-state-icon" /><div className="empty-state-title">{translateText('No courses assigned')}</div><div className="empty-state-text">{translateText('This lecturer has no course allocations yet. Assign a batch course to get started.')}</div></div>) : (<div className="table-wrapper"><table className="data-table"><thead><tr><th>{translateText('Course')}</th><th>{translateText('Batch')}</th><th>{translateText('Semester')}</th><th>{translateText('Type')}</th>{canManagePeople && <th style={{ textAlign: 'right' }}>{translateText('Action')}</th>}</tr></thead><tbody>{lecturerCourses.map((bc) => (<tr key={bc.id}><td><code style={{ fontSize: '0.85rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, color: 'var(--color-primary)' }}>{bc.courses?.code}</code>{' '}<strong>{bc.courses?.name}</strong></td><td><div>{bc.batches?.name}</div></td><td><div>{bc.semesters?.name}</div></td><td><span className={`badge ${bc.is_compulsory ? 'badge-blue' : 'badge-gray'}`}>{bc.is_compulsory ? translateText('Compulsory') : translateText('Elective')}</span></td>{canManagePeople && (<td style={{ textAlign: 'right' }}><button type="button" className="btn-icon" title={translateText('Remove allocation')} onClick={() => { if (window.confirm(translateText('Remove this course allocation?'))) unassignMutation.mutate(bc.id); }} disabled={unassignMutation.isPending}><MdDelete style={{ color: 'var(--color-secondary)' }} /></button></td>)}</tr>))}</tbody></table></div>)}
      </Modal>

      <Modal isOpen={Boolean(assignLecturer)} onClose={() => setAssignLecturer(null)} title={translateText('Assign course')} maxWidth="560px" footer={<><button type="button" className="btn btn-outline" onClick={() => setAssignLecturer(null)}>{translateText('Cancel')}</button><button type="button" className="btn btn-primary" onClick={handleAssignSubmit} disabled={assignCourseMutation.isPending || claimExistingMutation.isPending}>{translateText('Assign Course')}</button></>}>
        {assignLecturer && (<p style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>{translateText('Lecturer')}: <strong>{assignLecturer.first_name} {assignLecturer.last_name}</strong></p>)}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button type="button" className={`btn btn-sm ${assignForm.mode === 'new' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAssignForm((f) => ({ ...f, mode: 'new' }))}>{translateText('New allocation')}</button>
          <button type="button" className={`btn btn-sm ${assignForm.mode === 'existing' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAssignForm((f) => ({ ...f, mode: 'existing' }))}>{translateText('Use existing')}</button>
        </div>
        <form onSubmit={handleAssignSubmit}>
          {assignForm.mode === 'existing' ? (
            <div className="form-group"><label className="form-label">{translateText('Unassigned allocation')} *</label>
              {allBcLoading ? <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{translateText('Loading...')}</p> : unassignedAllocations.length === 0 ? <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{translateText('No unassigned allocations. Create a new one instead.')}</p> : (
                <select className="form-input" value={assignForm.existing_id} onChange={(e) => setAssignForm({ ...assignForm, existing_id: e.target.value })} required>
                  <option value="">{translateText('Choose allocation...')}</option>
                  {unassignedAllocations.map((bc) => (<option key={bc.id} value={bc.id}>{bc.courses?.code} — {bc.courses?.name} · {bc.batches?.name}</option>))}
                </select>
              )}
            </div>
          ) : (
            <>
              <div className="form-group"><label className="form-label">{translateText('Batch')} *</label><select className="form-input" value={assignForm.batch_id} onChange={(e) => setAssignForm({ ...assignForm, batch_id: e.target.value })} required><option value="">{translateText('Choose batch...')}</option>{batches.map((b) => (<option key={b.id} value={b.id}>{b.name} ({b.code})</option>))}</select></div>
              <div className="form-group"><label className="form-label">{translateText('Course')} *</label><select className="form-input" value={assignForm.course_id} onChange={(e) => setAssignForm({ ...assignForm, course_id: e.target.value })} required><option value="">{translateText('Choose course...')}</option>{courses.map((c) => (<option key={c.id} value={c.id}>{c.code} — {c.name}</option>))}</select></div>
              <div className="form-group"><label className="form-label">{translateText('Semester')} *</label><select className="form-input" value={assignForm.semester_id} onChange={(e) => setAssignForm({ ...assignForm, semester_id: e.target.value })} required><option value="">{translateText('Choose semester...')}</option>{semesters.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}</select></div>
            </>
          )}
        </form>
      </Modal>

      <ConfirmDialog isOpen={Boolean(lecturerToDelete)} onClose={() => setLecturerToDelete(null)} onConfirm={() => lecturerToDelete && deleteMutation.mutate(lecturerToDelete)} title={translateText('Delete Lecturer')} message={lecturerToDelete ? translateText(`Permanently delete ${lecturerToDelete.first_name} ${lecturerToDelete.last_name} and any linked login account? This cannot be undone.`) : ''} isDestructive isLoading={deleteMutation.isPending} />
    </AppLayout>
  );
}
