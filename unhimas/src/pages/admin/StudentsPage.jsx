import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdd, MdSchool, MdSearch, MdEdit, MdDelete, MdToggleOn, MdToggleOff, MdPhone, MdEmail, MdPersonAdd, MdCheckCircle } from 'react-icons/md';
import { Link } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { toast } from '../../components/common/Toast';
import {
  getStudents,
  createStudent,
  updateStudent,
  deleteSchoolAccount,
} from '../../services/peopleService';
import { getBatches } from '../../services/academicService';

export default function StudentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentToDelete, setStudentToDelete] = useState(null);

  const [formData, setFormData] = useState({
    matricule: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    phone: '',
    batch_id: '',
    admission_date: new Date().toISOString().split('T')[0],
  });

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['admin-students', batchFilter],
    queryFn: () => getStudents({ batchId: batchFilter || null }),
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['admin-batches'],
    queryFn: () => getBatches(),
  });

  const createMutation = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview-stats'] });
      toast.success('Student record created. Use "Create Account" to provision their login.');
      handleCloseModal();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to register student');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => updateStudent(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      toast.success('Student updated successfully');
      handleCloseModal();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update student');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (student) => deleteSchoolAccount({ recordType: 'student', recordId: student.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview-stats'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard-stats'] });
      toast.success('Student deleted successfully');
      setStudentToDelete(null);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete student');
    },
  });


  const handleOpenAdd = () => {

    setEditingStudent(null);
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
    setIsModalOpen(true);
  };

  const handleOpenEdit = (stu) => {
    setEditingStudent(stu);
    setFormData({
      matricule: stu.matricule,
      first_name: stu.first_name,
      middle_name: stu.middle_name || '',
      last_name: stu.last_name,
      email: stu.email || '',
      phone: stu.phone || '',
      batch_id: stu.batch_id,
      admission_date: stu.admission_date || '',
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingStudent(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.matricule.trim() || !formData.first_name.trim() || !formData.last_name.trim() || !formData.batch_id) {
      toast.error('Matricule, First Name, Last Name, and Batch are required');
      return;
    }

    if (editingStudent) {
      updateMutation.mutate({
        id: editingStudent.id,
        updates: formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleToggleStatus = (stu) => {
    updateMutation.mutate({
      id: stu.id,
      updates: { is_active: !stu.is_active },
    });
  };

  const filteredStudents = students.filter((s) => {
    const term = search.toLowerCase();
    return (
      s.matricule.toLowerCase().includes(term) ||
      s.first_name.toLowerCase().includes(term) ||
      s.last_name.toLowerCase().includes(term) ||
      (s.email && s.email.toLowerCase().includes(term))
    );
  });

  return (
    <AppLayout pageTitle="Students Registry">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Students Registry</h1>
          <p className="page-subtitle">Enrolled students, matriculation records, and batch memberships</p>
        </div>
        <div className="page-header-actions">
          <Link to="/admin/create-account" className="btn btn-outline" style={{ marginRight: '0.5rem' }}>
            <MdPersonAdd /> Create Account
          </Link>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <MdAdd /> Register New Student
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 200px' }}>
            <MdSearch
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
                fontSize: '1.1rem',
              }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.25rem' }}
              placeholder="Search by matricule, name, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ minWidth: '180px' }}>
            <select
              className="form-input"
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
            >
              <option value="">All Cohorts / Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Matricule</th>
                <th>Student Full Name</th>
                <th>Assigned Batch</th>
                <th>Department</th>
                <th>Contact Details</th>
                <th>Admission Date</th>
                <th>Status</th>
                <th>Account</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                    Loading students registry...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdSchool className="empty-state-icon" />
                      <div className="empty-state-title">No Students Registered</div>
                      <div className="empty-state-text">
                        Click "Register New Student" to enrol your first student into a batch.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((stu) => (
                  <tr key={stu.id}>
                    <td>
                      <code style={{ fontSize: '0.85rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {stu.matricule}
                      </code>
                    </td>
                    <td>
                      <strong>{stu.first_name} {stu.middle_name ? `${stu.middle_name} ` : ''}{stu.last_name}</strong>
                    </td>
                    <td>
                      <div>{stu.batches?.name}</div>
                      <code style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                        {stu.batches?.code}
                      </code>
                    </td>
                    <td>{stu.batches?.departments?.name}</td>
                    <td>
                      {stu.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
                          <MdEmail style={{ color: 'var(--color-text-muted)' }} /> {stu.email}
                        </div>
                      )}
                      {stu.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                          <MdPhone /> {stu.phone}
                        </div>
                      )}
                    </td>
                    <td>{stu.admission_date ? new Date(stu.admission_date).toLocaleDateString() : '—'}</td>
                    <td>
                      <span className={`badge ${stu.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {stu.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td>
                      {stu.profile_id ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#059669' }}>
                          <MdCheckCircle /> Linked
                        </span>
                      ) : (
                        <Link
                          to="/admin/create-account"
                          className="btn-icon"
                          title="Create login account for this student"
                          style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)' }}
                        >
                          <MdPersonAdd /> Create Account
                        </Link>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                        <button
                          className="btn-icon"
                          title="Edit student"
                          aria-label={`Edit student ${stu.matricule}`}
                          onClick={() => handleOpenEdit(stu)}
                        >
                          <MdEdit />
                        </button>
                        <button
                          className="btn-icon"
                          title={stu.is_active ? 'Deactivate' : 'Activate'}
                          onClick={() => handleToggleStatus(stu)}
                        >
                          {stu.is_active ? <MdToggleOn style={{ color: '#059669', fontSize: '1.25rem' }} /> : <MdToggleOff style={{ color: 'var(--color-text-muted)', fontSize: '1.25rem' }} />}
                        </button>
                        <button
                          className="btn-icon"
                          title="Delete student and login account"
                          aria-label={`Delete student ${stu.matricule}`}
                          onClick={() => setStudentToDelete(stu)}
                          disabled={deleteMutation.isPending}
                        >
                          <MdDelete style={{ color: 'var(--color-secondary)' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingStudent ? 'Edit Student Record' : 'Register New Student'}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={handleCloseModal}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingStudent ? 'Save Changes' : 'Register Student'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Matricule *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. UNH/2026/SWE/001"
              value={formData.matricule}
              onChange={(e) => setFormData({ ...formData, matricule: e.target.value.toUpperCase() })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Middle Name</label>
              <input
                type="text"
                className="form-input"
                value={formData.middle_name}
                onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Assign Batch / Cohort *</label>
            <select
              className="form-input"
              value={formData.batch_id}
              onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}
              required
            >
              <option value="">Select cohort...</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code}) — {b.departments?.abbreviation}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="student@unhimas.edu"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                className="form-input"
                placeholder="+237 6..."
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Admission Date</label>
            <input
              type="date"
              className="form-input"
              value={formData.admission_date}
              onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
            />
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(studentToDelete)}
        onClose={() => {
          if (!deleteMutation.isPending) setStudentToDelete(null);
        }}
        onConfirm={() => studentToDelete && deleteMutation.mutate(studentToDelete)}
        title="Delete student and login?"
        message={studentToDelete
          ? `Permanently delete ${studentToDelete.first_name} ${studentToDelete.last_name} (${studentToDelete.matricule}) and their linked login, if any? This also deletes their attendance, marks, and transfer history.`
          : ''}
        confirmLabel="Delete Student"
        isDestructive
        isLoading={deleteMutation.isPending}
      />
    </AppLayout>
  );
}
