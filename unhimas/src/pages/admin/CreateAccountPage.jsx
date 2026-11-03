import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdPersonAdd,
  MdSchool,
  MdPersonPin,
  MdCheckCircle,
  MdErrorOutline,
  MdArrowBack,
  MdKey,
} from 'react-icons/md';
import { Link } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { createSchoolAccount } from '../../services/auth';
import { createStudent, createLecturer } from '../../services/peopleService';
import { getBatches, getDepartments } from '../../services/academicService';

export default function CreateAccountPage() {
  const queryClient = useQueryClient();
  const [role, setRole] = useState('student');
  const [step, setStep] = useState('form');
  const [lastResult, setLastResult] = useState(null);

  const [studentForm, setStudentForm] = useState({
    matricule: `UNH/${new Date().getFullYear()}/`,
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    phone: '',
    batch_id: '',
    admission_date: new Date().toISOString().split('T')[0],
  });

  const [lecturerForm, setLecturerForm] = useState(() => ({
    staff_id: `LEC-${Math.floor(1000 + Math.random() * 9000)}`,
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    phone: '',
    department_id: '',
    specialization: '',
  }));

  const [formError, setFormError] = useState('');

  const { data: batches = [] } = useQuery({
    queryKey: ['admin-batches'],
    queryFn: () => getBatches(),
  });
  const { data: departments = [] } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: getDepartments,
  });

  const createStudentMutation = useMutation({ mutationFn: createStudent });
  const createLecturerMutation = useMutation({ mutationFn: createLecturer });
  const createAccountMutation = useMutation({ mutationFn: createSchoolAccount });

  const isPending =
    createStudentMutation.isPending ||
    createLecturerMutation.isPending ||
    createAccountMutation.isPending;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    try {
      let record;

      if (role === 'student') {
        if (!studentForm.matricule.trim() || !studentForm.first_name.trim() ||
            !studentForm.last_name.trim() || !studentForm.batch_id) {
          setFormError('Matricule, First Name, Last Name, and Batch are required.');
          return;
        }
        if (!studentForm.email.trim()) {
          setFormError('An email address is required to create a login account.');
          return;
        }
        record = await createStudentMutation.mutateAsync(studentForm);
      } else {
        if (!lecturerForm.staff_id.trim() || !lecturerForm.first_name.trim() ||
            !lecturerForm.last_name.trim()) {
          setFormError('Staff ID, First Name, and Last Name are required.');
          return;
        }
        if (!lecturerForm.email.trim()) {
          setFormError('An email address is required to create a login account.');
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
              linked_record_id: record.id,
              login_id: studentForm.matricule.trim().toUpperCase(),
            }
          : {
              role: 'lecturer',
              email: lecturerForm.email.trim(),
              full_name: [lecturerForm.first_name, lecturerForm.middle_name, lecturerForm.last_name]
                .filter(Boolean)
                .join(' '),
              linked_record_id: record.id,
              login_id: lecturerForm.staff_id.trim().toUpperCase(),
            };

      const accountResult = await createAccountMutation.mutateAsync(accountPayload);

      setLastResult({
        role,
        record,
        account: accountResult,
        login_id: accountPayload.login_id,
        email: accountPayload.email,
      });
      setStep('done');
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      queryClient.invalidateQueries({ queryKey: ['admin-lecturers'] });
    } catch (err) {
      setFormError(err.message || 'Failed to create account');
    }
  };

  const resetForm = () => {
    setStep('form');
    setLastResult(null);
    setFormError('');
    setStudentForm({
      matricule: `UNH/${new Date().getFullYear()}/`,
      first_name: '',
      middle_name: '',
      last_name: '',
      email: '',
      phone: '',
      batch_id: '',
      admission_date: new Date().toISOString().split('T')[0],
    });
    setLecturerForm({
      staff_id: `LEC-${Math.floor(1000 + Math.random() * 9000)}`,
      first_name: '',
      middle_name: '',
      last_name: '',
      email: '',
      phone: '',
      department_id: '',
      specialization: '',
    });
  };

  if (step === 'done' && lastResult) {
    return (
      <AppLayout>
        <div className="page-header">
          <div>
            <h1 className="page-title">Account Created</h1>
            <p className="page-subtitle">Login credentials have been generated.</p>
          </div>
        </div>
        <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <MdCheckCircle size={48} color="var(--color-success)" />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <div className="form-input" style={{ background: 'var(--color-bg-muted)' }}>
              {lastResult.role === 'student' ? 'Student' : 'Lecturer'}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Login ID</label>
            <div className="form-input" style={{ background: 'var(--color-bg-muted)', fontFamily: 'monospace' }}>
              {lastResult.login_id}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <div className="form-input" style={{ background: 'var(--color-bg-muted)' }}>
              {lastResult.email}
            </div>
          </div>
          {lastResult.account?.temp_password && (
            <div className="form-group">
              <label className="form-label">Temporary Password</label>
              <div className="form-input" style={{ background: 'var(--color-bg-muted)', fontFamily: 'monospace' }}>
                {lastResult.account.temp_password}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                Share this securely. The user should change it on first login.
              </p>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-primary" onClick={resetForm}>
              Create another
            </button>
            <Link to="/admin/students" className="btn btn-secondary">
              Go to Students
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
          <h1 className="page-title">Create Account</h1>
          <p className="page-subtitle">
            Create a login account for a new student or lecturer. Programme is inherited from the selected batch.
          </p>
        </div>
        <Link to="/admin/students" className="btn btn-secondary">
          <MdArrowBack /> Back
        </Link>
      </div>

      <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
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

        {formError && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            <MdErrorOutline /> {formError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {role === 'student' ? (
            <StudentFields form={studentForm} setForm={setStudentForm} batches={batches} />
          ) : (
            <LecturerFields form={lecturerForm} setForm={setLecturerForm} departments={departments} />
          )}

          <div style={{ marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              {isPending ? 'Creating…' : (
                <>
                  <MdPersonAdd /> Create {role === 'student' ? 'Student' : 'Lecturer'} Account
                </>
              )}
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
        {selectedBatch?.programmes && (
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            Programme from batch: {selectedBatch.programmes.code} — {selectedBatch.programmes.name}
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label className="form-label">Email Address *</label>
          <input id="student-email" type="email" className="form-input" placeholder="student@unhimas.edu" value={form.email} onChange={f('email')} required />
        </div>
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input id="student-phone" type="text" className="form-input" value={form.phone} onChange={f('phone')} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Admission date</label>
        <input type="date" className="form-input" value={form.admission_date} onChange={f('admission_date')} />
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
        <input
          id="lecturer-staff-id"
          type="text"
          className="form-input"
          value={form.staff_id}
          onChange={(e) => setForm((p) => ({ ...p, staff_id: e.target.value.toUpperCase() }))}
          required
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group">
          <label className="form-label">First Name *</label>
          <input type="text" className="form-input" value={form.first_name} onChange={f('first_name')} required />
        </div>
        <div className="form-group">
          <label className="form-label">Middle Name</label>
          <input type="text" className="form-input" value={form.middle_name} onChange={f('middle_name')} />
        </div>
        <div className="form-group">
          <label className="form-label">Last Name *</label>
          <input type="text" className="form-input" value={form.last_name} onChange={f('last_name')} required />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
          <option value="">Select department…</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.abbreviation})
            </option>
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
