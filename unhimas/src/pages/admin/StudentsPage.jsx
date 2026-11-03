import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdAdd, MdSchool, MdSearch, MdEdit, MdDelete, MdToggleOn, MdToggleOff,
  MdEmail, MdPhone, MdPersonAdd, MdCheckCircle, MdFileDownload, MdChevronLeft, MdChevronRight,
  MdMoreVert,
} from 'react-icons/md';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import DataTable from '../../components/common/DataTable';
import RowActions from '../../components/common/RowActions';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
import { translateText } from '../../i18n';
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
  const canManagePeople = profile?.role === 'admin' || profile?.role === 'registrar';
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [page, setPage] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    matricule: '', first_name: '', middle_name: '', last_name: '', email: '', phone: '', batch_id: '', admission_date: '',
  });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['admin-students', batchFilter, search],
    queryFn: () => getStudents({ batchId: batchFilter || null, search }),
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['admin-batches'],
    queryFn: () => getBatches(),
  });

  const createMutation = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      toast.success(translateText('Student created'));
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      closeModal();
    },
    onError: (err) => toast.error(err.message || translateText('Failed to create student')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => updateStudent(id, updates),
    onSuccess: () => {
      toast.success(translateText('Student updated'));
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      closeModal();
    },
    onError: (err) => toast.error(err.message || translateText('Failed to update student')),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ recordId }) => deleteSchoolAccount({ recordType: 'student', recordId }),
    onSuccess: () => {
      toast.success(translateText('Student account deleted'));
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(err.message || translateText('Failed to delete')),
  });

  const archiveMutation = useMutation({
    mutationFn: (studentId) => archiveStudent(studentId),
    onSuccess: () => {
      toast.success(translateText('Student archived'));
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      setConfirmArchive(null);
    },
    onError: (err) => toast.error(err.message || translateText('Failed to archive')),
  });

  const completeMutation = useMutation({
    mutationFn: ({ studentId, result }) => markStudentProgrammeCompleted(studentId, result),
    onSuccess: () => {
      toast.success(translateText('Programme marked completed for student'));
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
    },
    onError: (err) => toast.error(err.message || translateText('Failed to mark programme completed')),
  });

  const openCreate = () => {
    setEditing(null);
    setFormData({
      matricule: `UNH/${new Date().getFullYear()}/`,
      first_name: '',
      middle_name: '',
      last_name: '',
      email: '',
      phone: '',
      batch_id: batches[0]?.id || '',
      admission_date: new Date().toISOString().split('T')[0],
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
      admission_date: stu.admission_date || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.matricule.trim() || !formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error(translateText('Matricule, first name and last name are required'));
      return;
    }
    if (!formData.batch_id) {
      toast.error(translateText('Batch / cohort is required'));
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, updates: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filtered = useMemo(() => {
    let list = students;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(
        (stu) =>
          (stu.matricule || '').toLowerCase().includes(s) ||
          (stu.first_name || '').toLowerCase().includes(s) ||
          (stu.last_name || '').toLowerCase().includes(s) ||
          (stu.email || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [students, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const exportCsv = () => {
    const headers = [
      { label: 'Matricule', key: 'matricule' },
      { label: 'First Name', key: 'first_name' },
      { label: 'Last Name', key: 'last_name' },
      { label: 'Batch', key: 'batch_name' },
      { label: 'Programme', key: 'programme_code' },
      { label: 'Email', key: 'email' },
    ];
    const rows = filtered.map((s) => ({
      matricule: s.matricule,
      first_name: s.first_name,
      last_name: s.last_name,
      batch_name: s.batches?.name || '',
      programme_code: s.programmes?.code || s.batches?.programmes?.code || '',
      email: s.email || '',
    }));
    const csv = [
      headers.map((h) => h.label).join(','),
      ...rows.map((r) => headers.map((h) => `"${(r[h.key] || '').toString().replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <MdSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
            <input
              className="form-input"
              style={{ paddingLeft: 36 }}
              placeholder={translateText('Search matricule, name, email…')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          <select
            className="form-input"
            style={{ flex: '0 0 200px' }}
            value={batchFilter}
            onChange={(e) => { setBatchFilter(e.target.value); setPage(0); }}
          >
            <option value="">{translateText('All batches')}</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {b.programmes?.code ? `· ${b.programmes.code}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
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
                  const prog = stu.programmes || stu.batches?.programmes;
                  const status = stu.programme_status || 'active';
                  return (
                    <tr key={stu.id}>
                      <td><code>{stu.matricule}</code></td>
                      <td>{[stu.first_name, stu.middle_name, stu.last_name].filter(Boolean).join(' ')}</td>
                      <td>{stu.batches?.name || '—'}</td>
                      <td>{prog ? `${prog.code}` : '—'}</td>
                      <td>
                        <span className={`badge badge-${status === 'completed' ? 'success' : status === 'withdrawn' ? 'warning' : 'info'}`}>
                          {status === 'completed'
                            ? (stu.programme_completion_result === 'fail_or_exit' ? 'Completed (fail/exit)' : 'Completed')
                            : status === 'withdrawn' ? 'Withdrawn' : 'In programme'}
                        </span>
                      </td>
                      <td>{stu.email || '—'}</td>
                      {canManagePeople && (
                        <td>
                          <RowActions
                            actions={[
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
                <label className="form-label">{translateText('Middle Name')}</label>
                <input className="form-input" value={formData.middle_name} onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{translateText('Last Name')} *</label>
                <input className="form-input" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{translateText('Batch / Cohort')} *</label>
              <select
                className="form-input"
                value={formData.batch_id}
                onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}
                required
              >
                <option value="">{translateText('Select batch')}</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                    {b.programmes?.code ? ` · ${b.programmes.code}` : ''}
                    {b.year_of_study != null ? ` · Y${b.year_of_study}` : ''}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                {translateText('Programme is inherited from the selected batch')}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
              <label className="form-label">{translateText('Admission date')}</label>
              <input type="date" className="form-input" value={formData.admission_date} onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? translateText('Save changes') : translateText('Create student')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={closeModal}>
                {translateText('Cancel')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={translateText('Delete student account?')}
        message={translateText('This permanently removes the student record and linked login. Prefer Archive if marks exist.')}
        onConfirm={() => deleteMutation.mutate({ recordId: confirmDelete.id })}
        onCancel={() => setConfirmDelete(null)}
        danger
      />
      <ConfirmDialog
        open={!!confirmArchive}
        title={translateText('Archive student?')}
        message={translateText('Student will be deactivated but marks and transcripts are kept.')}
        onConfirm={() => archiveMutation.mutate(confirmArchive.id)}
        onCancel={() => setConfirmArchive(null)}
        danger
      />
    </AppLayout>
  );
}
