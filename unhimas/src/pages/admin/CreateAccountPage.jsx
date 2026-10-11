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

/**
 * CreateAccountPage
 *
 * Unified admin panel for creating a student or lecturer account in one flow:
 *  1. Admin selects the role (student | lecturer).
 *  2. Admin fills in the required profile fields.
 *  3. On submit: the school record (student/lecturer row) is created first,
 *     then frontend sign-up creates the Supabase Auth account and an admin-only
 *     RPC links it to the school record.
 */
export default function CreateAccountPage() {
  const queryClient = useQueryClient();
  const [role, setRole] = useState('student');
  const [step, setStep] = useState('form'); // 'form' | 'success'
  const [lastResult, setLastResult] = useState(null);

  // ── Student form state ────────────────────────────────────────────────────
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

  // ── Lecturer form state ───────────────────────────────────────────────────
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

  // ── Reference data ────────────────────────────────────────────────────────
  const { data: batches = [] } = useQuery({
    queryKey: ['admin-batches'],
    queryFn: () => getBatches(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: getDepartments,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createStudentMutation = useMutation({ mutationFn: createStudent });
  const createLecturerMutation = useMutation({ mutationFn: createLecturer });
  const createAccountMutation = useMutation({ mutationFn: createSchoolAccount });

  const isPending =
    createStudentMutation.isPending ||
    createLecturerMutation.isPending ||
    createAccountMutation.isPending;

  // ── Submit handler ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    try {
      let record;

      if (role === 'student') {
        // Validate
        if (!studentForm.matricule.trim() || !studentForm.first_name.trim() ||
            !studentForm.last_name.trim() || !studentForm.batch_id) {
          setFormError('Matricule, First Name, Last Name, and Batch are required.');
          return;
        }
        if (!studentForm.email.trim()) {
          setFormError('An email address is required to create a login account.');
          return;
        }

        // 1. Create the student record
        record = await createStudentMutation.mutateAsync(studentForm);

      } else {
        // Validate
        if (!lecturerForm.staff_id.trim() || !lecturerForm.first_name.trim() ||
            !lecturerForm.last_name.trim()) {
          setFormError('Staff ID, First Name, and Last Name are required.');
          return;
        }
        if (!lecturerForm.email.trim()) {
          setFormError('An email address is required to create a login account.');
          return;
        }

        // 1. Create the lecturer record
        record = await createLecturerMutation.mutateAsync(lecturerForm);
      }

      // 2. Create the Supabase Auth account and link it through the admin RPC
      const result = await createAccountMutation.mutateAsync({
        recordType: role,
        record,
      });

      // 3. Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      queryClient.invalidateQueries({ queryKey: ['admin-lecturers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview-stats'] });

      setLastResult({ ...result, role, record });
      setStep('success');

    } catch (err) {
      setFormError(err.message || 'Account creation failed. Please try again.');
    }
  };

  const handleCreateAnother = () => {
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
      batch_id: batches[0]?.id || '',
      admission_date: new Date().toISOString().split('T')[0],
    });
    setLecturerForm({
      staff_id: `LEC-${Math.floor(1000 + Math.random() * 9000)}`,
      first_name: '',
      middle_name: '',
      last_name: '',
      email: '',
      phone: '',
      department_id: departments[0]?.id || '',
      specialization: '',
    });
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (step === 'success' && lastResult) {
    const defaultPassword = lastResult.role === 'student'
      ? lastResult.record?.matricule
      : lastResult.record?.staff_id;

    return (
      <AppLayout pageTitle="Create Account — Success">
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">Account Created</h1>
            <p className="page-subtitle">The login account was set up successfully</p>
          </div>
        </div>

        <div className="card" style={{ maxWidth: '600px' }}>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <MdCheckCircle
              style={{ fontSize: '3.5rem', color: '#059669', marginBottom: '1rem' }}
            />
            <h2 style={{ marginBottom: '0.5rem' }}>
              {lastResult.record?.first_name} {lastResult.record?.last_name}
            </h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.75rem' }}>
              {lastResult.message}
            </p>

            <div
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: '1.25rem',
                textAlign: 'left',
                marginBottom: '1.75rem',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <MdKey /> Login credentials for this user
              </div>
              <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.3rem 0', color: 'var(--color-text-muted)', width: '130px' }}>Email</td>
                    <td><code>{lastResult.email}</code></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.3rem 0', color: 'var(--color-text-muted)' }}>
                      Temp. password
                    </td>
                    <td>
                      <code
                        style={{
                          background: 'rgba(220,38,38,0.08)',
                          color: '#b91c1c',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontWeight: 700,
                        }}
                      >
                        {defaultPassword}
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.3rem 0', color: 'var(--color-text-muted)' }}>Role</td>
                    <td style={{ textTransform: 'capitalize' }}>{lastResult.role}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.3rem 0', color: 'var(--color-text-muted)' }}>Email status</td>
                    <td>{lastResult.emailConfirmationRequired ? 'Email confirmation required' : 'Ready to sign in'}</td>
                  </tr>
                </tbody>
              </table>
              <div
                style={{
                  marginTop: '0.875rem',
                  fontSize: '0.78rem',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.5,
                }}
              >
                ⚠ Share these credentials securely. {lastResult.emailConfirmationRequired
                  ? 'The user must confirm their email before signing in. They will then be required to set a new password before they can access the system.'
                  : 'The user will be required to set a new password on their first login before they can access the system.'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCreateAnother}
              >
                <MdPersonAdd /> Create Another Account
              </button>
              <Link
                to={lastResult.role === 'student' ? '/admin/students' : '/admin/lecturers'}
                className="btn btn-primary"
              >
                View {lastResult.role === 'student' ? 'Students' : 'Lecturers'} Registry
              </Link>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Form screen ────────────────────────────────────────────────────────────
  return (
    <AppLayout pageTitle="Create Account">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Create Account</h1>
          <p className="page-subtitle">
            Create a login account for a new student or lecturer. The unique code is set as
            the temporary password; the user must change it on first login. No Edge Function is required.
          </p>
        </div>
        <div className="page-header-actions">
          <Link to="/admin" className="btn btn-outline" style={{ gap: '0.35rem' }}>
            <MdArrowBack /> Back to Dashboard
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: '720px' }}>
        {/* Role selector */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ padding: '1.25rem 1.5rem' }}>
            <div className="form-label" style={{ marginBottom: '0.75rem', fontWeight: 700 }}>
              Account type
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setRole('student')}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  borderRadius: 'var(--radius)',
                  border: `2px solid ${role === 'student' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: role === 'student' ? 'var(--color-primary-light, rgba(99,102,241,0.08))' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  fontWeight: role === 'student' ? 700 : 400,
                  color: role === 'student' ? 'var(--color-primary)' : 'var(--color-text)',
                  transition: 'all 0.15s ease',
                }}
              >
                <MdSchool style={{ fontSize: '1.3rem' }} />
                Student
              </button>
              <button
                type="button"
                onClick={() => setRole('lecturer')}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  borderRadius: 'var(--radius)',
                  border: `2px solid ${role === 'lecturer' ? 'var(--color-secondary)' : 'var(--color-border)'}`,
                  background: role === 'lecturer' ? 'rgba(139,92,246,0.08)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  fontWeight: role === 'lecturer' ? 700 : 400,
                  color: role === 'lecturer' ? 'var(--color-secondary)' : 'var(--color-text)',
                  transition: 'all 0.15s ease',
                }}
              >
                <MdPersonPin style={{ fontSize: '1.3rem' }} />
                Lecturer
              </button>
            </div>
          </div>
        </div>

        {/* Form card */}
        <div className="card">
          <div style={{ padding: '1.5rem' }}>
            {formError && (
              <div className="auth-alert error" role="alert" style={{ marginBottom: '1.25rem' }}>
                <MdErrorOutline style={{ flexShrink: 0 }} />
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {role === 'student' ? (
                <StudentFields
                  form={studentForm}
                  setForm={setStudentForm}
                  batches={batches}
                />
              ) : (
                <LecturerFields
                  form={lecturerForm}
                  setForm={setLecturerForm}
                  departments={departments}
                />
              )}

              <div
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: '0.875rem 1rem',
                  fontSize: '0.8rem',
                  color: 'var(--color-text-muted)',
                  marginBottom: '1.25rem',
                  lineHeight: 1.6,
                }}
              >
                <strong style={{ color: 'var(--color-text)' }}>Temporary password:</strong>{' '}
                {role === 'student'
                  ? 'The student\'s matricule will be used as the temporary password.'
                  : 'The lecturer\'s staff ID will be used as the temporary password.'}{' '}
                The user will be required to set a new password before they can access the system.
                If email confirmation is enabled in Supabase Auth, the user must confirm their email first.
              </div>

              <button
                type="submit"
                id="create-account-submit"
                className="btn btn-primary btn-full"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    Creating account…
                  </>
                ) : (
                  <>
                    <MdPersonAdd />
                    Create {role === 'student' ? 'Student' : 'Lecturer'} Account
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ── Student sub-form ──────────────────────────────────────────────────────────
function StudentFields({ form, setForm, batches }) {
  const f = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
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
          onChange={f('batch_id')}
          required
        >
          <option value="">Select cohort…</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.code}){b.departments?.abbreviation ? ` — ${b.departments.abbreviation}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label className="form-label">Email Address *</label>
          <input
            id="student-email"
            type="email"
            className="form-input"
            placeholder="student@unhimas.edu"
            value={form.email}
            onChange={f('email')}
            required
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            Required for account creation
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Phone Number</label>
          <input id="student-phone" type="tel" className="form-input" placeholder="+237 6…" value={form.phone} onChange={f('phone')} />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Admission Date</label>
        <input id="student-admission-date" type="date" className="form-input" value={form.admission_date} onChange={f('admission_date')} />
      </div>
    </>
  );
}

// ── Lecturer sub-form ─────────────────────────────────────────────────────────
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
          placeholder="e.g. LEC-1042"
          value={form.staff_id}
          onChange={(e) => setForm((p) => ({ ...p, staff_id: e.target.value.toUpperCase() }))}
          required
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group">
          <label className="form-label">First Name *</label>
          <input id="lecturer-first-name" type="text" className="form-input" value={form.first_name} onChange={f('first_name')} required />
        </div>
        <div className="form-group">
          <label className="form-label">Middle Name</label>
          <input id="lecturer-middle-name" type="text" className="form-input" value={form.middle_name} onChange={f('middle_name')} />
        </div>
        <div className="form-group">
          <label className="form-label">Last Name *</label>
          <input id="lecturer-last-name" type="text" className="form-input" value={form.last_name} onChange={f('last_name')} required />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Primary Department</label>
        <select id="lecturer-department" className="form-input" value={form.department_id} onChange={f('department_id')}>
          <option value="">None / Cross-Faculty</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name} ({d.abbreviation})</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Specialization / Academic Area</label>
        <input
          id="lecturer-specialization"
          type="text"
          className="form-input"
          placeholder="e.g. Software Architecture, Database Systems"
          value={form.specialization}
          onChange={f('specialization')}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label className="form-label">Email Address *</label>
          <input
            id="lecturer-email"
            type="email"
            className="form-input"
            placeholder="lecturer@unhimas.edu"
            value={form.email}
            onChange={f('email')}
            required
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            Required for account creation
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Phone Number</label>
          <input id="lecturer-phone" type="tel" className="form-input" placeholder="+237 6…" value={form.phone} onChange={f('phone')} />
        </div>
      </div>
    </>
  );
}
