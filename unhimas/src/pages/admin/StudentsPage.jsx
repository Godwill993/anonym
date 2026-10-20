import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdAdd, MdSchool, MdSearch, MdClose, MdEdit, MdDelete, MdToggleOn, MdToggleOff,
  MdPhone, MdEmail, MdPersonAdd, MdCheckCircle, MdFileDownload, MdChevronLeft, MdChevronRight,
} from 'react-icons/md';
import { Link } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { toast } from '../../components/common/Toast';
import { useTranslation } from '../../i18n';
import { usePermissions } from '../../hooks/usePermissions';
import { exportToCsv } from '../../utils/exportUtils';
import { getStudents, createStudent, updateStudent, deleteSchoolAccount } from '../../services/peopleService';
import { getBatches } from '../../services/academicService';

export default function StudentsPage() {
  const { language, translateText } = useTranslation();
  const { canManagePeople, canCreateAccounts } = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [formData, setFormData] = useState({
    matricule: '', first_name: '', middle_name: '', last_name: '', email: '', phone: '',
    batch_id: '', admission_date: new Date().toISOString().split('T')[0],
  });

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['admin-students', batchFilter],
    queryFn: () => getStudents({ batchId: batchFilter || null }),
  });
  const { data: batches = [] } = useQuery({ queryKey: ['admin-batches'], queryFn: () => getBatches() });

  const createMutation = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview-stats'] });
      toast.success(translateText('Student record created. Use "Create Account" to provision their login.'));
      handleCloseModal();
    },
    onError: (err) => toast.error(err.message || translateText('Failed to register student')),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => updateStudent(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      toast.success(translateText('Student updated successfully'));
      handleCloseModal();
    },
    onError: (err) => toast.error(err.message || translateText('Failed to update student')),
  });
  const deleteMutation = useMutation({
    mutationFn: (student) => deleteSchoolAccount({ recordType: 'student', recordId: student.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview-stats'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard-stats'] });
      toast.success(translateText('Student deleted successfully'));
      setStudentToDelete(null);
    },
    onError: (err) => toast.error(err.message || translateText('Failed to delete student')),
  });

  const handleOpenAdd = () => {
    setEditingStudent(null);
    setFormData({
      matricule: `UNH/${new Date().getFullYear()}/`, first_name: '', middle_name: '', last_name: '',
      email: '', phone: '', batch_id: batches[0]?.id || '', admission_date: new Date().toISOString().split('T')[0],
    });
    setIsModalOpen(true);
  };
  const handleOpenEdit = (stu) => {
    setEditingStudent(stu);
    setFormData({
      matricule: stu.matricule, first_name: stu.first_name, middle_name: stu.middle_name || '',
      last_name: stu.last_name, email: stu.email || '', phone: stu.phone || '',
      batch_id: stu.batch_id, admission_date: stu.admission_date || '',
    });
    setIsModalOpen(true);
  };
  const handleCloseModal = () => { setIsModalOpen(false); setEditingStudent(null); };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.matricule.trim() || !formData.first_name.trim() || !formData.last_name.trim() || !formData.batch_id) {
      toast.error(translateText('Matricule, First Name, Last Name, and Batch are required'));
      return;
    }
    if (editingStudent) updateMutation.mutate({ id: editingStudent.id, updates: formData });
    else createMutation.mutate(formData);
  };
  const handleToggleStatus = (stu) => updateMutation.mutate({ id: stu.id, updates: { is_active: !stu.is_active } });

  const filteredStudents = useMemo(() => {
    const term = search.toLowerCase();
    return students.filter((s) =>
      s.matricule?.toLowerCase().includes(term) ||
      s.first_name?.toLowerCase().includes(term) ||
      s.last_name?.toLowerCase().includes(term) ||
      (s.email && s.email.toLowerCase().includes(term))
    );
  }, [students, search]);
  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const handleExportCsv = () => {
    if (!filteredStudents.length) return;
    const headers = [
      { label: 'Matricule', key: 'matricule' }, { label: 'First Name', key: 'first_name' },
      { label: 'Middle Name', key: 'middle_name' }, { label: 'Last Name', key: 'last_name' },
      { label: 'Batch', key: 'batch_name' }, { label: 'Department', key: 'department_name' },
      { label: 'Email', key: 'email' }, { label: 'Phone', key: 'phone' },
      { label: 'Status', key: 'status_label' }, { label: 'Admission Date', key: 'admission_date' },
    ];
    const exportRows = filteredStudents.map((s) => ({
      ...s,
      batch_name: s.batches?.name || '',
      department_name: s.batches?.departments?.name || '',
      status_label: s.is_active ? 'Active' : 'Suspended',
    }));
    exportToCsv('unhimas_students_registry', headers, exportRows);
  };

  return (
    <AppLayout pageTitle="Students Registry">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Students Registry')}</h1>
          <p className="page-subtitle">{translateText('Enrolled students, matriculation records, and batch memberships')}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={handleExportCsv} disabled={filteredStudents.length === 0} title={translateText('Export students to CSV')}>
            <MdFileDownload /> {translateText('Export CSV')}
          </button>
          {canCreateAccounts && (
            <Link to="/admin/create-account" className="btn btn-outline btn-sm">
              <MdPersonAdd /> {translateText('Create Account')}
            </Link>
          )}
          {canManagePeople && (
            <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
              <MdAdd /> {translateText('Register New Student')}
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 200px' }}>
            <MdSearch style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '1.1rem' }} />
            <input type="text" className="form-input" style={{ paddingLeft: '2.25rem', paddingRight: search ? '2rem' : '0.875rem' }} placeholder={translateText('Search by matricule, name, or email...')} value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} />
            {search && (
              <button type="button" onClick={() => { setSearch(''); setCurrentPage(1); }} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} aria-label={translateText('Clear search')}>
                <MdClose size={16} />
              </button>
            )}
          </div>
          <div style={{ minWidth: '180px' }}>
            <select className="form-input" value={batchFilter} onChange={(e) => { setBatchFilter(e.target.value); setCurrentPage(1); }} aria-label={translateText('Filter by cohort / batch')}>
              <option value="">{translateText('All Cohorts / Batches')}</option>
              {batches.map((b) => (<option key={b.id} value={b.id}>{b.name} ({b.code})</option>))}
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{translateText('Matricule')}</th>
                <th>{translateText('Student Full Name')}</th>
                <th>{translateText('Assigned Batch')}</th>
                <th>{translateText('Department')}</th>
                <th>{translateText('Contact Details')}</th>
                <th>{translateText('Admission Date')}</th>
                <th>{translateText('Status')}</th>
                <th>{translateText('Account')}</th>
                <th style={{ textAlign: 'right' }}>{translateText('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '3rem' }}>{translateText('Loading students registry...')}</td></tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdSchool className="empty-state-icon" />
                      <div className="empty-state-title">{translateText(search ? 'No Matching Students' : 'No Students Registered')}</div>
                      <div className="empty-state-text">{translateText(search ? 'No student records match your filter criteria.' : 'Click "Register New Student" to enrol your first student into a batch.')}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((stu) => (
                  <tr key={stu.id}>
                    <td><code style={{ fontSize: '0.85rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, color: 'var(--color-primary)' }}>{stu.matricule}</code></td>
                    <td><strong>{stu.first_name} {stu.middle_name ? `${stu.middle_name} ` : ''}{stu.last_name}</strong></td>
                    <td><div>{stu.batches?.name}</div><code style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{stu.batches?.code}</code></td>
                    <td>{stu.batches?.departments?.name}</td>
                    <td>
                      {stu.email && (<div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}><MdEmail style={{ color: 'var(--color-text-muted)' }} /> {stu.email}</div>)}
                      {stu.phone && (<div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}><MdPhone /> {stu.phone}</div>)}
                    </td>
                    <td>{stu.admission_date ? new Date(stu.admission_date).toLocaleDateString() : '—'}</td>
                    <td><span className={`badge ${stu.is_active ? 'badge-green' : 'badge-gray'}`}>{stu.is_active ? translateText('Active') : translateText('Suspended')}</span></td>
                    <td>
                      {stu.profile_id ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#059669' }}><MdCheckCircle /> {translateText('Linked')}</span>
                      ) : canCreateAccounts ? (
                        <Link to="/admin/create-account" className="btn-icon" title={translateText('Create login account for this student')} style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)' }}>
                          <MdPersonAdd /> {translateText('Create Account')}
                        </Link>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                        {canManagePeople && (
                          <>
                            <button className="btn-icon" title={translateText('Edit student')} aria-label={`Edit student ${stu.matricule}`} onClick={() => handleOpenEdit(stu)}><MdEdit /></button>
                            <button className="btn-icon" title={stu.is_active ? translateText('Deactivate') : translateText('Activate')} onClick={() => handleToggleStatus(stu)}>
                              {stu.is_active ? <MdToggleOn style={{ color: '#059669', fontSize: '1.25rem' }} /> : <MdToggleOff style={{ color: 'var(--color-text-muted)', fontSize: '1.25rem' }} />}
                            </button>
                            <button className="btn-icon" title={translateText('Delete student and login account')} aria-label={`Delete student ${stu.matricule}`} onClick={() => setStudentToDelete(stu)} disabled={deleteMutation.isPending}>
                              <MdDelete style={{ color: 'var(--color-secondary)' }} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredStudents.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderTop: '1px solid var(--color-border)', fontSize: '0.8125rem', color: 'var(--color-text-muted)', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                {language === 'fr'
                  ? `Affichage de ${(currentPage - 1) * pageSize + 1} à ${Math.min(currentPage * pageSize, filteredStudents.length)} sur ${filteredStudents.length} étudiants`
                  : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, filteredStudents.length)} of ${filteredStudents.length} students`}
              </div>
              {filteredStudents.length > 10 && (
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

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingStudent ? translateText('Edit Student Record') : translateText('Register New Student')}>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label">{translateText('Matricule')} *</label><input className="form-input" value={formData.matricule} onChange={(e) => setFormData({ ...formData, matricule: e.target.value })} required /></div>
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
            <div className="form-group"><label className="form-label">{translateText('Batch / Cohort')} *</label><select className="form-input" value={formData.batch_id} onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })} required><option value="">{translateText('Select batch')}</option>{batches.map((b) => (<option key={b.id} value={b.id}>{b.name} ({b.code})</option>))}</select></div>
            <div className="form-group"><label className="form-label">{translateText('Admission Date')}</label><input type="date" className="form-input" value={formData.admission_date} onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-outline" onClick={handleCloseModal}>{translateText('Cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>{editingStudent ? translateText('Save Changes') : translateText('Register Student')}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(studentToDelete)}
        onClose={() => setStudentToDelete(null)}
        onConfirm={() => studentToDelete && deleteMutation.mutate(studentToDelete)}
        title={translateText('Delete Student')}
        message={studentToDelete ? translateText(`Permanently delete ${studentToDelete.first_name} ${studentToDelete.last_name} and any linked login account? This cannot be undone.`) : ''}
        isDestructive
        isLoading={deleteMutation.isPending}
      />
    </AppLayout>
  );
}
