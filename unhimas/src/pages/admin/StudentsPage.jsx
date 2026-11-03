import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdAdd, MdSchool, MdSearch, MdEdit, MdDelete, MdToggleOn, MdToggleOff,
  MdEmail, MdPhone, MdPersonAdd, MdCheckCircle, MdFileDownload, MdChevronLeft, MdChevronRight,
  MdMoreVert,
} from 'react-icons/md';
import { Link } from 'react-router-dom';
import { toast } from '../../components/common/Toast';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import DataTable from '../../components/common/DataTable';
import RowActionsMenu from '../../components/common/RowActionsMenu';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import {
  getStudents,
  createStudent,
  updateStudent,
  deleteSchoolAccount,
  archiveStudent,
  studentHasMarks,
} from '../../services/peopleService';
import { getBatches, markStudentProgrammeCompleted, computeIsFinalYear } from '../../services/academicService';

const PAGE_SIZE = 20;

export default function StudentsPage() {
  const { profile } = useAuth();
  const { language, translateText } = useTranslation();
  const queryClient = useQueryClient();
  const canManagePeople = profile?.role === 'admin';
  const canCreateAccounts = profile?.role === 'admin';

  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [formData, setFormData] = useState({
    matricule: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    phone: '',
    batch_id: '',
    gender: '',
    date_of_birth: '',
    admission_date: '',
  });

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['admin-students'],
    queryFn: () => getStudents({}),
  });
  const { data: batches = [] } = useQuery({
    queryKey: ['admin-batches'],
    queryFn: () => getBatches(),
  });

  const createMutation = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      toast.success(translateText('Student created'));
      handleCloseModal();
    },
    onError: (err) => toast.error(err.message || translateText('Failed to create student')),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => updateStudent(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      toast.success(translateText('Student updated'));
      handleCloseModal();
    },
    onError: (err) => toast.error(err.message || translateText('Failed to update student')),
  });
  const deleteMutation = useMutation({
    mutationFn: (stu) => deleteSchoolAccount({ recordType: 'student', recordId: stu.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      toast.success(translateText('Student deleted'));
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(err.message || translateText('Failed to delete student')),
  });
  const archiveMutation = useMutation({
    mutationFn: (stu) => archiveStudent(stu.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      toast.success(translateText('Student archived'));
      setConfirmArchive(null);
    },
    onError: (err) => toast.error(err.message || translateText('Failed to archive student')),
  });
  const completeMutation = useMutation({
    mutationFn: ({ studentId, result }) => markStudentProgrammeCompleted(studentId, result),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      toast.success(translateText('Programme marked completed for student'));
    },
    onError: (err) => toast.error(err.message || translateText('Failed to mark programme completed')),
  });

  const filteredStudents = useMemo(() => {
    const term = search.toLowerCase();
    return (students || []).filter((s) => {
      if (batchFilter && s.batch_id !== batchFilter) return false;
      if (!term) return true;
      return (
        s.matricule?.toLowerCase().includes(term) ||
        s.first_name?.toLowerCase().includes(term) ||
        s.last_name?.toLowerCase().includes(term) ||
        (s.email && s.email.toLowerCase().includes(term))
      );
    });
  }, [students, search, batchFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const pageRows = filteredStudents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleOpenAdd = () => {
    setEditingStudent(null);
    setFormData({
      matricule: `STU-${Math.floor(1000 + Math.random() * 9000)}`,
      first_name: '',
      middle_name: '',
      last_name: '',
      email: '',
      phone: '',
      batch_id: batches[0]?.id || '',
      gender: '',
      date_of_birth: '',
      admission_date: new Date().toISOString().slice(0, 10),
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (stu) => {
    setEditingStudent(stu);
    setFormData({
      matricule: stu.matricule || '',
      first_name: stu.first_name || '',
      middle_name: stu.middle_name || '',
      last_name: stu.last_name || '',
      email: stu.email || '',
      phone: stu.phone || '',
      batch_id: stu.batch_id || '',
      gender: stu.gender || '',
      date_of_birth: stu.date_of_birth ? String(stu.date_of_birth).slice(0, 10) : '',
      admission_date: stu.admission_date ? String(stu.admission_date).slice(0, 10) : '',
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingStudent(null);
  };

  const selectedBatch = batches.find((b) => b.id === formData.batch_id) || null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.matricule?.trim() || !formData.first_name?.trim() || !formData.last_name?.trim()) {
      toast.error(translateText('Matricule, first name and last name are required'));
      return;
    }
    if (!formData.batch_id) {
      toast.error(translateText('Batch is required'));
      return;
    }
    const payload = {
      ...formData,
      batch_id: formData.batch_id || null,
      email: formData.email || null,
      phone: formData.phone || null,
      middle_name: formData.middle_name || null,
      gender: formData.gender || null,
      date_of_birth: formData.date_of_birth || null,
    };
    if (editingStudent) updateMutation.mutate({ id: editingStudent.id, updates: payload });
    else createMutation.mutate(payload);
  };

  const handleExport = () => {
    const rows = filteredStudents.map((s) => [
      s.matricule,
      s.first_name,
      s.last_name,
      s.email || '',
      s.phone || '',
      s.batches?.name || '',
      s.programmes?.name || s.batches?.programmes?.name || '',
      s.is_active === false ? 'Inactive' : (s.programme_status || 'Active'),
    ]);
    const header = ['Matricule', 'First Name', 'Last Name', 'Email', 'Phone', 'Batch', 'Programme', 'Status'];
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout pageTitle={translateText('Students')}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Students')}</h1>
          <p className="page-subtitle">{translateText('Student records, batches, programmes, and account status')}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={handleExport}>
            <MdFileDownload /> {translateText('Export CSV')}
          </button>
          {canCreateAccounts && (
            <Link to="/admin/create-account" className="btn btn-outline btn-sm">
              <MdPersonAdd /> {translateText('Create Account')}
            </Link>
          )}
          {canManagePeople && (
            <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
              <MdAdd /> {translateText('Add Student')}
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ position: 'relative', minWidth: 220, flex: '1 1 200px' }}>
            <MdSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: '2.25rem' }}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder={translateText('Search matricule, name, email…')}
            />
          </div>
          <select
            className="form-input"
            style={{ minWidth: 180 }}
            value={batchFilter}
            onChange={(e) => { setBatchFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="">{translateText('All batches')}</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{translateText('Matricule')}</th>
                <th>{translateText('Name')}</th>
                <th>{translateText('Batch')}</th>
                <th>{translateText('Programme')}</th>
                <th>{translateText('Contact')}</th>
                <th>{translateText('Status')}</th>
                <th style={{ textAlign: 'right' }}>{translateText('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>{translateText('Loading…')}</td></tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                    <div className="empty-state">
                      <MdSchool className="empty-state-icon" />
                      <div className="empty-state-title">{translateText('No students found')}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((stu) => {
                  const prog = stu.programmes || stu.batches?.programmes;
                  const status = stu.programme_status || 'active';
                  const isFinal = computeIsFinalYear({
                    year_of_study: stu.batches?.year_of_study,
                    duration_years: prog?.duration_years ?? stu.batches?.programmes?.duration_years,
                  });
                  return (
                    <tr key={stu.id}>
                      <td><code>{stu.matricule}</code></td>
                      <td><strong>{stu.first_name} {stu.middle_name ? `${stu.middle_name} ` : ''}{stu.last_name}</strong></td>
                      <td>{stu.batches?.name || '—'}</td>
                      <td>
                        {prog ? (
                          <div>
                            <code>{prog.code}</code>
                            <div style={{ fontSize: '0.72rem', marginTop: 2 }}>
                              <span className={`badge ${
                                status === 'completed' ? 'badge-green' :
                                status === 'withdrawn' ? 'badge-gray' : 'badge-blue'
                              }`}>
                                {status === 'completed'
                                  ? (stu.programme_completion_result === 'fail_or_exit'
                                    ? translateText('Completed (fail/exit)')
                                    : translateText('Completed'))
                                  : status === 'withdrawn'
                                    ? translateText('Withdrawn')
                                    : translateText('In programme')}
                              </span>
                            </div>
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        {stu.email && (
                          <div style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MdEmail /> {stu.email}
                          </div>
                        )}
                        {stu.phone && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                            <MdPhone /> {stu.phone}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${stu.is_active !== false ? 'badge-green' : 'badge-gray'}`}>
                          {stu.is_active !== false ? translateText('Active') : translateText('Inactive')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <RowActionsMenu
                          ariaLabel={translateText('Student actions')}
                          items={[
                            {
                              id: 'edit',
                              label: translateText('Edit'),
                              icon: <MdEdit />,
                              onClick: () => handleOpenEdit(stu),
                              hidden: !canManagePeople,
                            },
                            {
                              id: 'complete-pass',
                              label: translateText('Mark programme completed (Pass)'),
                              icon: <MdCheckCircle />,
                              onClick: () => completeMutation.mutate({ studentId: stu.id, result: 'pass' }),
                              hidden:
                                !canManagePeople ||
                                stu.programme_status === 'completed' ||
                                !prog ||
                                !isFinal,
                            },
                            {
                              id: 'complete-fail',
                              label: translateText('Mark programme completed (Fail / exit)'),
                              icon: <MdCheckCircle />,
                              onClick: () => completeMutation.mutate({ studentId: stu.id, result: 'fail_or_exit' }),
                              hidden:
                                !canManagePeople ||
                                stu.programme_status === 'completed' ||
                                !prog ||
                                !isFinal,
                            },
                            {
                              id: 'archive',
                              label: translateText('Archive'),
                              icon: <MdToggleOff />,
                              onClick: () => setConfirmArchive(stu),
                              hidden: !canManagePeople,
                            },
                            {
                              id: 'delete',
                              label: translateText('Delete'),
                              icon: <MdDelete />,
                              danger: true,
                              onClick: () => setConfirmDelete(stu),
                              hidden: !canManagePeople,
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredStudents.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', borderTop: '1px solid var(--color-border)', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            <span>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredStudents.length)} / {filteredStudents.length}
            </span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                  <MdChevronLeft /> {translateText('Prev')}
                </button>
                <span>{page} / {totalPages}</span>
                <button type="button" className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                  {translateText('Next')} <MdChevronRight />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingStudent ? translateText('Edit Student') : translateText('Add Student')}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{translateText('Matricule')} *</label>
            <input className="form-input" value={formData.matricule} onChange={(e) => setFormData({ ...formData, matricule: e.target.value.toUpperCase() })} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">{translateText('First Name')} *</label>
              <input className="form-input" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">{translateText('Middle Name')}</label>
              <input className="form-input" value={formData.middle_name} onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">{translateText('Last Name')} *</label>
              <input className="form-input" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} required />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">{translateText('Email')}</label>
              <input type="email" className="form-input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">{translateText('Phone')}</label>
              <input className="form-input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{translateText('Batch')} *</label>
            <select className="form-input" value={formData.batch_id} onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })} required>
              <option value="">{translateText('Select batch')}</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.programmes?.name ? ` — ${b.programmes.name}` : ''}
                  {b.year_of_study != null ? ` · Y${b.year_of_study}` : ''}
                </option>
              ))}
            </select>
            <p className="form-hint">{translateText('Programme comes from the batch. Set programme on the batch first.')}</p>
            {formData.batch_id && selectedBatch && (
              <div
                style={{
                  marginTop: 8,
                  padding: '0.65rem 0.75rem',
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-muted, rgba(0,0,0,0.03))',
                  fontSize: '0.85rem',
                }}
              >
                {selectedBatch.programmes ? (
                  <>
                    <div>
                      <strong>{translateText('Programme')}</strong>:{' '}
                      <code>{selectedBatch.programmes.code}</code> — {selectedBatch.programmes.name}
                    </div>
                    {selectedBatch.year_of_study != null && (
                      <div style={{ marginTop: 4, color: 'var(--color-text-muted)' }}>
                        {translateText('Year of study')}: {selectedBatch.year_of_study}
                        {selectedBatch.programmes.duration_years != null
                          ? ` of ${selectedBatch.programmes.duration_years}`
                          : ''}
                      </div>
                    )}
                  </>
                ) : (
                  <span style={{ color: 'var(--color-danger)' }}>
                    {translateText('This batch has no programme. Edit the batch and set HND, B.Tech, or M.Tech first.')}
                  </span>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">{translateText('Gender')}</label>
              <select className="form-input" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}>
                <option value="">—</option>
                <option value="male">{translateText('Male')}</option>
                <option value="female">{translateText('Female')}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{translateText('Admission date')}</label>
              <input type="date" className="form-input" value={formData.admission_date} onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn btn-outline" onClick={handleCloseModal}>{translateText('Cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {editingStudent ? translateText('Save') : translateText('Add Student')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={translateText('Delete student?')}
        message={confirmDelete ? `${confirmDelete.first_name} ${confirmDelete.last_name}` : ''}
        onConfirm={() => deleteMutation.mutate(confirmDelete)}
        confirmLabel={translateText('Delete')}
        danger
      />
      <ConfirmDialog
        isOpen={Boolean(confirmArchive)}
        onClose={() => setConfirmArchive(null)}
        title={translateText('Archive student?')}
        message={confirmArchive ? `${confirmArchive.first_name} ${confirmArchive.last_name}` : ''}
        onConfirm={() => archiveMutation.mutate(confirmArchive)}
        confirmLabel={translateText('Archive')}
      />
    </AppLayout>
  );
}
