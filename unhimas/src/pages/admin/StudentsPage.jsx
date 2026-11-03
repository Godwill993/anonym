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
import { getBatches, markStudentProgrammeCompleted } from '../../services/academicService';

const PAGE_SIZE = 20;

export default function StudentsPage() {
  const { profile } = useAuth();
  const { translateText } = useTranslation();
  const canManagePeople = profile?.role === 'admin' || profile?.role === 'registrar';
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [page, setPage] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
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
    nationality: 'Cameroonian',
  });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: getStudents,
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches'],
    queryFn: getBatches,
  });

  const createMutation = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(translateText('Student created'));
      closeModal();
    },
    onError: (err) => toast.error(err.message || translateText('Failed to create student')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateStudent(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(translateText('Student updated'));
      closeModal();
    },
    onError: (err) => toast.error(err.message || translateText('Failed to update student')),
  });

  const deleteMutation = useMutation({
    mutationFn: (stu) => deleteSchoolAccount({ role: 'student', id: stu.id, profileId: stu.profile_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(translateText('Student deleted'));
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(err.message || translateText('Failed to delete student')),
  });

  const archiveMutation = useMutation({
    mutationFn: (stu) => archiveStudent(stu.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(translateText('Student archived'));
      setConfirmArchive(null);
    },
    onError: (err) => toast.error(err.message || translateText('Failed to archive student')),
  });

  const completeMutation = useMutation({
    mutationFn: ({ studentId, result }) => markStudentProgrammeCompleted(studentId, result),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(translateText('Programme marked completed for student'));
    },
    onError: (err) => toast.error(err.message || translateText('Failed to mark programme completed')),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (students || []).filter((s) => {
      if (batchFilter && s.batch_id !== batchFilter) return false;
      if (!q) return true;
      const blob = [s.matricule, s.first_name, s.last_name, s.email, s.middle_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [students, search, batchFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const openCreate = () => {
    setEditing(null);
    setFormData({
      matricule: '',
      first_name: '',
      middle_name: '',
      last_name: '',
      email: '',
      phone: '',
      batch_id: '',
      gender: '',
      date_of_birth: '',
      nationality: 'Cameroonian',
    });
    setModalOpen(true);
  };

  const openEdit = (stu) => {
    setEditing(stu);
    setFormData({
      matricule: stu.matricule || '',
      first_name: stu.first_name || '',
      middle_name: stu.middle_name || '',
      last_name: stu.last_name || '',
      email: stu.email || '',
      phone: stu.phone || '',
      batch_id: stu.batch_id || '',
      gender: stu.gender || '',
      date_of_birth: stu.date_of_birth || '',
      nationality: stu.nationality || 'Cameroonian',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.matricule?.trim() || !formData.first_name?.trim() || !formData.last_name?.trim()) {
      toast.error(translateText('Matricule, first name and last name are required'));
      return;
    }
    if (!formData.batch_id) {
      toast.error(translateText('Batch / cohort is required'));
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
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['Matricule', 'First Name', 'Last Name', 'Email', 'Phone', 'Batch', 'Programme', 'Status'],
      ...filtered.map((s) => [
        s.matricule || '',
        s.first_name || '',
        s.last_name || '',
        s.email || '',
        s.phone || '',
        s.batches?.name || '',
        s.programmes?.name || s.batches?.programmes?.name || '',
        s.is_active === false ? 'Inactive' : (s.programme_status || 'Active'),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">{translateText('Students')}</h1>
          <p className="page-subtitle">{translateText('Student records, batches, programmes, and account status')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={exportCsv}>
            <MdFileDownload /> {translateText('Export CSV')}
          </button>
          {canManagePeople && (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <MdAdd /> {translateText('Add Student')}
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
            <label className="form-label">{translateText('Search')}</label>
            <input
              className="form-input"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder={translateText('Search matricule, name, email…')}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
            <label className="form-label">{translateText('Batch')}</label>
            <select
              className="form-input"
              value={batchFilter}
              onChange={(e) => {
                setBatchFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="">{translateText('All batches')}</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
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
                <th>{translateText('Matricule')}</th>
                <th>{translateText('Name')}</th>
                <th>{translateText('Batch')}</th>
                <th>{translateText('Programme')}</th>
                <th>{translateText('Status')}</th>
                <th>{translateText('Email')}</th>
                {canManagePeople && <th>{translateText('Actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7}>{translateText('Loading…')}</td></tr>
              ) : pageItems.length === 0 ? (
                <tr><td colSpan={7}>{translateText('No students found')}</td></tr>
              ) : (
                pageItems.map((stu) => {
                  const progName = stu.programmes?.name || stu.batches?.programmes?.name || '—';
                  return (
                    <tr key={stu.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{stu.matricule}</td>
                      <td>{[stu.first_name, stu.last_name].filter(Boolean).join(' ')}</td>
                      <td>{stu.batches?.name || '—'}</td>
                      <td>{progName}</td>
                      <td>
                        <span className={`badge ${stu.is_active === false ? 'badge-danger' : 'badge-success'}`}>
                          {stu.is_active === false
                            ? translateText('Inactive')
                            : (stu.programme_status === 'completed'
                              ? translateText('Completed')
                              : translateText('Active'))}
                        </span>
                      </td>
                      <td>{stu.email || '—'}</td>
                      {canManagePeople && (
                        <td>
                          <RowActionsMenu
                            items={[
                              {
                                label: translateText('Edit'),
                                icon: <MdEdit />,
                                onClick: () => openEdit(stu),
                              },
                              {
                                label: translateText('Mark programme completed (Pass)'),
                                icon: <MdCheckCircle />,
                                onClick: () => completeMutation.mutate({ studentId: stu.id, result: 'pass' }),
                                hidden: !canManagePeople || stu.programme_status === 'completed' || !(stu.programmes || stu.batches?.programmes),
                              },
                              {
                                label: translateText('Mark programme completed (Fail / exit)'),
                                icon: <MdCheckCircle />,
                                onClick: () => completeMutation.mutate({ studentId: stu.id, result: 'fail_or_exit' }),
                                hidden: !canManagePeople || stu.programme_status === 'completed' || !(stu.programmes || stu.batches?.programmes),
                              },
                              {
                                label: translateText('Archive'),
                                icon: <MdToggleOff />,
                                onClick: () => setConfirmArchive(stu),
                                hidden: !canManagePeople,
                              },
                              {
                                label: translateText('Delete'),
                                icon: <MdDelete />,
                                danger: true,
                                onClick: () => setConfirmDelete(stu),
                                hidden: !canManagePeople,
                              },
                            ]}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <MdChevronLeft />
            </button>
            <span style={{ alignSelf: 'center' }}>
              {page + 1} / {pageCount}
            </span>
            <button type="button" className="btn btn-secondary" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
              <MdChevronRight />
            </button>
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal title={editing ? translateText('Edit Student') : translateText('Add Student')} onClose={closeModal}>
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
                <label className="form-label">{translateText('Middle name')}</label>
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
              <label className="form-label">{translateText('Batch / cohort')} *</label>
              <select className="form-input" value={formData.batch_id} onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })} required>
                <option value="">{translateText('Select…')}</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.programmes?.name ? ` — ${b.programmes.name}` : ''}
                  </option>
                ))}
              </select>
              <p className="form-hint">{translateText('Programme is inherited from the selected batch.')}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">{translateText('Gender')}</label>
                <select className="form-input" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}>
                  <option value="">{translateText('Select…')}</option>
                  <option value="female">{translateText('Female')}</option>
                  <option value="male">{translateText('Male')}</option>
                  <option value="other">{translateText('Other')}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{translateText('Date of birth')}</label>
                <input type="date" className="form-input" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{translateText('Nationality')}</label>
                <input className="form-input" value={formData.nationality} onChange={(e) => setFormData({ ...formData, nationality: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={closeModal}>{translateText('Cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? translateText('Save changes') : translateText('Create student')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={translateText('Delete student')}
          message={translateText('This will permanently remove the student record and linked account if any.')}
          confirmLabel={translateText('Delete')}
          onConfirm={() => deleteMutation.mutate(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
          danger
        />
      )}

      {confirmArchive && (
        <ConfirmDialog
          title={translateText('Archive student')}
          message={translateText('The student will be marked inactive.')}
          confirmLabel={translateText('Archive')}
          onConfirm={() => archiveMutation.mutate(confirmArchive)}
          onCancel={() => setConfirmArchive(null)}
        />
      )}
    </AppLayout>
  );
}
