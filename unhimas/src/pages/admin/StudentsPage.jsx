import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdAdd, MdSchool, MdSearch, MdClose, MdEdit, MdDelete, MdToggleOn, MdToggleOff,
  MdEmail, MdPhone, MdPersonAdd, MdCheckCircle, MdFileDownload, MdChevronLeft, MdChevronRight,
  MdSwapHoriz, MdArchive,
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
import { getStudents, createStudent, updateStudent, deleteSchoolAccount, archiveStudent } from '../../services/peopleService';
import { getBatches, getDepartments } from '../../services/academicService';

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
  const [transferStudent, setTransferStudent] = useState(null);
  const [transferBatchId, setTransferBatchId] = useState('');
  const [formData, setFormData] = useState({
    matricule: '', first_name: '', middle_name: '', last_name: '', email: '', phone: '', batch_id: '', admission_date: '',
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
    onError: (err) => toast.error(err.message || translateText('Failed to create student')),
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
      toast.success(translateText('Student deleted successfully'));
      setStudentToDelete(null);
    },
    onError: (err) => toast.error(err.message || translateText('Failed to delete student')),
  });
  const archiveMutation = useMutation({
    mutationFn: (student) => archiveStudent(student.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      toast.success(translateText('Student archived'));
      setStudentToDelete(null);
    },
    onError: (err) => toast.error(err.message || translateText('Failed to archive student')),
  });
  const transferMutation = useMutation({
    mutationFn: ({ studentId, batchId }) => updateStudent(studentId, { batch_id: batchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      toast.success(translateText('Student transferred'));
      setTransferStudent(null);
      setTransferBatchId('');
    },
    onError: (err) => toast.error(err.message || translateText('Failed to transfer student')),
  });

  const handleOpenAdd = () => {
    setEditingStudent(null);
    setFormData({
      matricule: `STU-${Math.floor(1000 + Math.random() * 9000)}`,
      first_name: '', middle_name: '', last_name: '', email: '', phone: '',
      batch_id: batches[0]?.id || '', admission_date: new Date().toISOString().slice(0, 10),
    });
    setIsModalOpen(true);
  };
  const handleOpenEdit = (stu) => {
    setEditingStudent(stu);
    setFormData({
      matricule: stu.matricule, first_name: stu.first_name, middle_name: stu.middle_name || '',
      last_name: stu.last_name, email: stu.email || '', phone: stu.phone || '',
      batch_id: stu.batch_id || '', admission_date: stu.admission_date ? String(stu.admission_date).slice(0, 10) : '',
    });
    setIsModalOpen(true);
  };
  const handleCloseModal = () => { setIsModalOpen(false); setEditingStudent(null); };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.matricule.trim() || !formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error(translateText('Matricule, First Name, and Last Name are required'));
      return;
    }
    if (editingStudent) updateMutation.mutate({ id: editingStudent.id, updates: formData });
    else createMutation.mutate(formData);
  };
  const handleToggleStatus = (stu) => updateMutation.mutate({ id: stu.id, updates: { is_active: !stu.is_active } });
  const handleOpenTransfer = (stu) => { setTransferStudent(stu); setTransferBatchId(stu.batch_id || ''); };

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
      { label: 'Batch', key: 'batch_name' }, { label: 'Email', key: 'email' },
      { label: 'Phone', key: 'phone' }, { label: 'Status', key: 'status_label' },
    ];
    const exportRows = filteredStudents.map((s) => ({
      ...s,
      batch_name: s.batches?.name || '',
      status_label: s.is_active ? 'Active' : 'Suspended',
    }));
    exportToCsv('unhimas_students', headers, exportRows);
  };

  return (
    <AppLayout pageTitle={translateText('Students')}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Students')}</h1>
          <p className="page-subtitle">{translateText('Student records, batches, and account status')}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={handleExportCsv} disabled={filteredStudents.length === 0}>
            <MdFileDownload /> {translateText('Export CSV')}
          </button>
          {canCreateAccounts && (
            <Link to="/admin/create-account" className="btn btn-outline btn-sm"><MdPersonAdd /> {translateText('Create Account')}</Link>
          )}
          {canManagePeople && (
            <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}><MdAdd /> {translateText('Add Student')}</button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 200px' }}>
            <MdSearch style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '1.1rem' }} />
            <input type="text" className="form-input" style={{ paddingLeft: '2.25rem' }} placeholder={translateText('Search by matricule, name, or email...')} value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} />
          </div>
          <div style={{ minWidth: '180px' }}>
            <select className="form-input" value={batchFilter} onChange={(e) => { setBatchFilter(e.target.value); setCurrentPage(1); }}>
              <option value="">{translateText('All Batches')}</option>
              {batches.map((b) => (<option key={b.id} value={b.id}>{b.name} ({b.code})</option>))}
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{translateText('Matricule')}</th>
                <th>{translateText('Name')}</th>
                <th>{translateText('Batch')}</th>
                <th>{translateText('Contact')}</th>
                <th>{translateText('Admission')}</th>
                <th>{translateText('Status')}</th>
                <th>{translateText('Account')}</th>
                <th style={{ textAlign: 'right' }}>{translateText('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>{translateText('Loading students...')}</td></tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdSchool className="empty-state-icon" />
                      <div className="empty-state-title">{translateText(search ? 'No Matching Students' : 'No Students Found')}</div>
                      <div className="empty-state-text">{translateText(search ? 'No students match your filters.' : 'Add students to manage enrolment and results.')}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((stu) => (
                  <tr key={stu.id}>
                    <td><code style={{ fontSize: '0.85rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>{stu.matricule}</code></td>
                    <td><strong>{stu.first_name} {stu.middle_name ? `${stu.middle_name} ` : ''}{stu.last_name}</strong></td>
                    <td>{stu.batches?.name || '—'}</td>
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
                        <Link to="/admin/create-account" className="btn-icon" style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)' }}>
                          <MdPersonAdd /> {translateText('Create Account')}
                        </Link>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <RowActionsMenu
                        ariaLabel={translateText('Student actions')}
                        items={[
                          { id: 'edit', label: translateText('Edit'), icon: <MdEdit />, onClick: () => handleOpenEdit(stu), hidden: !canManagePeople },
                          { id: 'transfer', label: translateText('Transfer batch'), icon: <MdSwapHoriz />, onClick: () => handleOpenTransfer(stu), hidden: !canManagePeople },
                          { id: 'toggle', label: stu.is_active ? translateText('Deactivate') : translateText('Activate'), icon: stu.is_active ? <MdToggleOn /> : <MdToggleOff />, onClick: () => handleToggleStatus(stu), hidden: !canManagePeople },
                          { id: 'delete', label: translateText('Delete / archive'), icon: <MdDelete />, onClick: () => setStudentToDelete(stu), disabled: deleteMutation.isPending || archiveMutation.isPending, danger: true, hidden: !canManagePeople },
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredStudents.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderTop: '1px solid var(--color-border)', fontSize: '0.8125rem', color: 'var(--color-text-muted)', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              {language === 'fr'
                ? `Affichage de ${(currentPage - 1) * pageSize + 1} à ${Math.min(currentPage * pageSize, filteredStudents.length)} sur ${filteredStudents.length}`
                : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, filteredStudents.length)} of ${filteredStudents.length}`}
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button type="button" className="btn btn-outline btn-sm" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}><MdChevronLeft /> {translateText('Prev')}</button>
                <span>{currentPage} / {totalPages}</span>
                <button type="button" className="btn btn-outline btn-sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>{translateText('Next')} <MdChevronRight /></button>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingStudent ? translateText('Edit Student') : translateText('Add Student')}>
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
            <div className="form-group"><label className="form-label">{translateText('Batch')}</label><select className="form-input" value={formData.batch_id} onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}><option value="">{translateText('Select batch')}</option>{batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}</select></div>
            <div className="form-group"><label className="form-label">{translateText('Admission date')}</label><input type="date" className="form-input" value={formData.admission_date} onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-outline" onClick={handleCloseModal}>{translateText('Cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>{editingStudent ? translateText('Save Changes') : translateText('Add Student')}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(transferStudent)} onClose={() => setTransferStudent(null)} title={translateText('Transfer student')} footer={<><button type="button" className="btn btn-outline" onClick={() => setTransferStudent(null)}>{translateText('Cancel')}</button><button type="button" className="btn btn-primary" disabled={!transferBatchId || transferMutation.isPending} onClick={() => transferMutation.mutate({ studentId: transferStudent.id, batchId: transferBatchId })}><MdSwapHoriz /> {transferMutation.isPending ? translateText('Transferring…') : translateText('Confirm Transfer')}</button></>}>
        {transferStudent && (
          <>
            <p style={{ marginTop: 0 }}>{transferStudent.first_name} {transferStudent.last_name} ({transferStudent.matricule})</p>
            <div className="form-group">
              <label className="form-label">{translateText('New batch')}</label>
              <select className="form-input" value={transferBatchId} onChange={(e) => setTransferBatchId(e.target.value)}>
                <option value="">{translateText('Select batch')}</option>
                {batches.map((b) => (<option key={b.id} value={b.id}>{b.name} ({b.code})</option>))}
              </select>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(studentToDelete)}
        onClose={() => setStudentToDelete(null)}
        onConfirm={() => studentToDelete && deleteMutation.mutate(studentToDelete)}
        title={translateText('Delete student')}
        message={studentToDelete ? translateText(`Permanently delete ${studentToDelete.first_name} ${studentToDelete.last_name}? This cannot be undone.`) : ''}
        isDestructive
        isLoading={deleteMutation.isPending}
      />
    </AppLayout>
  );
}
