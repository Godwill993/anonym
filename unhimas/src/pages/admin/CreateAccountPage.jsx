import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MdPersonAdd, MdSchool, MdPersonPin, MdCheckCircle } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { toast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';
import { getBatches } from '../../services/academicService';
import { getDepartments } from '../../services/academicService';
import { createStudent, createLecturer } from '../../services/peopleService';
import { createSchoolAccount } from '../../services/authService';

export default function CreateAccountPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [role, setRole] = useState('student');
  const [formError, setFormError] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [studentForm, setStudentForm] = useState({
    matricule: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    phone: '',
    batch_id: '',
  });
  const [lecturerForm, setLecturerForm] = useState({
    staff_id: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department_id: '',
    specialization: '',
  });

  const { data: batches = [] } = useQuery({ queryKey: ['admin-batches'], queryFn: () => getBatches() });
  const { data: departments = [] } = useQuery({ queryKey: ['admin-departments'], queryFn: getDepartments });

  const createStudentMutation = useMutation({ mutationFn: createStudent });
  const createLecturerMutation = useMutation({ mutationFn: createLecturer });

  const isPending =
    createStudentMutation.isPending || createLecturerMutation.isPending;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setLastResult(null);
    try {
      let record;
      if (role === 'student') {
        if (!studentForm.matricule.trim() || !studentForm.first_name.trim() || !studentForm.last_name.trim()) {
          setFormError('Matricule, first name and last name are required');
          return;
        }
        if (!studentForm.batch_id) {
          setFormError('Batch is required');
          return;
        }
        if (!studentForm.email.trim()) {
          setFormError('Email is required for login');
          return;
        }
        record = await createStudentMutation.mutateAsync(studentForm);
      } else {
        if (!lecturerForm.staff_id.trim() || !lecturerForm.first_name.trim() || !lecturerForm.last_name.trim()) {
          setFormError('Staff ID, first name and last name are required');
          return;
        }
        if (!lecturerForm.email.trim()) {
          setFormError('Email is required for login');
          return;
        }
        record = await createLecturerMutation.mutateAsync(lecturerForm);
      }

      const accountPayload =
        role === 'student'
          ? {
              role: 'student',
              email: studentForm.email.trim(),
              full_name: [studentForm.first_name, studentForm.middle_name, studentForm.last_name]
                .filter(Boolean)
                .join(' '),
              login_id: studentForm.matricule.trim().toUpperCase(),
              linked_record_id: record.id,
              created_by: profile?.id,
            }
          : {
              role: 'lecturer',
              email: lecturerForm.email.trim(),
              full_name: [lecturerForm.first_name, lecturerForm.last_name].filter(Boolean).join(' '),
              login_id: lecturerForm.staff_id.trim().toUpperCase(),
              linked_record_id: record.id,
              created_by: profile?.id,
            };

      const account = await createSchoolAccount(accountPayload);
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      queryClient.invalidateQueries({ queryKey: ['admin-lecturers'] });
      setLastResult({
        role,
        login_id: account.login_id || accountPayload.login_id,
        email: accountPayload.email,
        temp_password: account.temp_password || account.temporary_password,
      });
      toast.success(`${role === 'student' ? 'Student' : 'Lecturer'} account created`);
      if (role === 'student') {
        setStudentForm({
          matricule: '',
          first_name: '',
          middle_name: '',
          last_name: '',
          email: '',
          phone: '',
          batch_id: '',
        });
      } else {
        setLecturerForm({
          staff_id: '',
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          department_id: '',
          specialization: '',
        });
      }
    } catch (err) {
      setFormError(err.message || 'Failed to create account');
      toast.error(err.message || 'Failed to create account');
    }
  };

  if (lastResult) {
    return (
      <AppLayout>
        <div className="page-header">
          <div>
            <h1 className="page-title">Account created</h1>
            <p className="page-subtitle">Share these credentials securely with the user</p>
          </div>
        </div>
        <div className="card" style={{ maxWidth: 520, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <MdCheckCircle style={{ color: 'var(--color-success)' }} />
            <strong>
              {lastResult.role === 'student' ? 'Student' : 'Lecturer'} account ready
            </strong>
          </div>
          <p><strong>Login ID:</strong> <code>{lastResult.login_id}</code></p>
          <p><strong>Email:</strong> {lastResult.email}</p>
          {lastResult.temp_password && (
            <p><strong>Temporary password:</strong> <code>{lastResult.temp_password}</code></p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn btn-primary" onClick={() => setLastResult(null)}>
              Create another
            </button>
            <Link to="/admin/students" className="btn btn-secondary">
              Back to students
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Create account</h1>
          <p className="page-subtitle">
            Create a login account for a new student or lecturer. Programme is inherited from the selected batch.
          </p>
        </div>
        <Link to="/admin/students" className="btn btn-secondary">
          Students list
        </Link>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, padding: '1rem 1rem 0' }}>
          <button
            type="button"
            className={`btn ${role === 'student' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRole('student')}
          >
            <MdSchool /> Student
          </button>
          <button
            type="button"
            className={`btn ${role === 'lecturer' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRole('lecturer')}
          >
            <MdPersonPin /> Lecturer
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '0 1rem 1.25rem' }}>
          {formError && (
            <div className="alert-banner alert-banner-danger" style={{ marginBottom: 12 }} role="alert">
              {formError}
            </div>
          )}
          {role === 'student' ? (
            <StudentFields form={studentForm} setForm={setStudentForm} batches={batches} />
          ) : (
            <LecturerFields form={lecturerForm} setForm={setLecturerForm} departments={departments} />
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              <MdPersonAdd /> Create {role === 'student' ? 'Student' : 'Lecturer'} Account
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

function StudentFields({ form, setForm, batches }) {
  const f = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const selectedBatch = batches.find((x) => x.id === form.batch_id);
  return (
    <>
      <div className="form-group">
        <label className="form-label">Matricule *</label>
        <input
          id="student-matricule"
          type="text"
          className="form-input"
          placeholder="e.g. UNH/2026/SWE/001"
          value={form.matricule}
          onChange={(e) => setForm((p) => ({ ...p, matricule: e.target.value.toUpperCase() }))}
          required
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group">
          <label className="form-label">First Name *</label>
          <input id="student-first-name" type="text" className="form-input" value={form.first_name} onChange={f('first_name')} required />
        </div>
        <div className="form-group">
          <label className="form-label">Middle Name</label>
          <input id="student-middle-name" type="text" className="form-input" value={form.middle_name} onChange={f('middle_name')} />
        </div>
        <div className="form-group">
          <label className="form-label">Last Name *</label>
          <input id="student-last-name" type="text" className="form-input" value={form.last_name} onChange={f('last_name')} required />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Assign Batch / Cohort *</label>
        <select
          id="student-batch"
          className="form-input"
          value={form.batch_id}
          onChange={(e) => setForm((prev) => ({ ...prev, batch_id: e.target.value }))}
          required
        >
          <option value="">Select cohort…</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.code})
              {b.programmes?.code ? ` · ${b.programmes.code}` : ''}
              {b.year_of_study != null ? ` · Y${b.year_of_study}` : ''}
              {b.departments?.abbreviation ? ` — ${b.departments.abbreviation}` : ''}
            </option>
          ))}
        </select>
        <p className="form-hint" style={{ marginTop: 4 }}>
          Programme comes from the batch. Set programme on the batch first.
        </p>
        {form.batch_id && (
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
            {selectedBatch?.programmes ? (
              <>
                <div>
                  <strong>Programme</strong>:{' '}
                  <code>{selectedBatch.programmes.code}</code> — {selectedBatch.programmes.name}
                </div>
                {selectedBatch.year_of_study != null && (
                  <div style={{ marginTop: 4, color: 'var(--color-text-muted)' }}>
                    Year of study: {selectedBatch.year_of_study}
                    {selectedBatch.programmes.duration_years != null
                      ? ` of ${selectedBatch.programmes.duration_years}`
                      : ''}
                  </div>
                )}
              </>
            ) : (
              <span style={{ color: 'var(--color-danger)' }}>
                This batch has no programme. Edit the batch and set HND, B.Tech, or M.Tech first.
              </span>
            )}
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group">
          <label className="form-label">Email *</label>
          <input id="student-email" type="email" className="form-input" placeholder="student@unhimas.edu" value={form.email} onChange={f('email')} required />
        </div>
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input id="student-phone" type="text" className="form-input" value={form.phone} onChange={f('phone')} />
        </div>
      </div>
    </>
  );
}

function LecturerFields({ form, setForm, departments }) {
  const f = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  return (
    <>
      <div className="form-group">
        <label className="form-label">Staff ID *</label>
        <input type="text" className="form-input" value={form.staff_id} onChange={(e) => setForm((p) => ({ ...p, staff_id: e.target.value.toUpperCase() }))} required />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group">
          <label className="form-label">First Name *</label>
          <input type="text" className="form-input" value={form.first_name} onChange={f('first_name')} required />
        </div>
        <div className="form-group">
          <label className="form-label">Last Name *</label>
          <input type="text" className="form-input" value={form.last_name} onChange={f('last_name')} required />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group">
          <label className="form-label">Email *</label>
          <input type="email" className="form-input" value={form.email} onChange={f('email')} required />
        </div>
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input type="text" className="form-input" value={form.phone} onChange={f('phone')} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Department</label>
        <select className="form-input" value={form.department_id} onChange={f('department_id')}>
          <option value="">Select…</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Specialization</label>
        <input type="text" className="form-input" value={form.specialization} onChange={f('specialization')} />
      </div>
    </>
  );
}
