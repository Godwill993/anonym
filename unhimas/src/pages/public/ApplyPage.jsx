import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MdSchool, MdCheckCircle } from 'react-icons/md';
import { useTranslation } from '../../i18n';
import { getDepartments, getAcademicYears } from '../../services/academicService';
import { submitApplication } from '../../services/admissionsService';

const empty = {
  first_name: '',
  middle_name: '',
  last_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  gender: '',
  nationality: 'Cameroonian',
  department_id: '',
  preferred_level: 'Level 1',
  academic_year_id: '',
  previous_school: '',
  previous_qualification: '',
  website: '', // honeypot — must stay empty
};

export default function ApplyPage() {
  const { translateText } = useTranslation();
  const [form, setForm] = useState(empty);
  const [result, setResult] = useState(null);

  const { data: departments = [] } = useQuery({
    queryKey: ['public-departments'],
    queryFn: getDepartments,
  });

  const { data: years = [] } = useQuery({
    queryKey: ['public-years'],
    queryFn: getAcademicYears,
  });

  const mutation = useMutation({
    mutationFn: submitApplication,
    onSuccess: (data) => {
      if (data?._spam) return;
      setResult(data);
      setForm(empty);
    },
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({
      ...form,
      department_id: form.department_id || null,
      academic_year_id: form.academic_year_id || null,
    });
  };

  return (
    <div className="auth-page" style={{ minHeight: '100vh', padding: '2rem 1rem' }}>
      <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <MdSchool size={40} color="var(--color-primary)" />
          <h1 className="page-title" style={{ marginTop: 12 }}>
            {translateText('Online Application')}
          </h1>
          <p className="page-subtitle">
            {translateText('Apply for admission. You will receive an application number to track your status.')}
          </p>
        </div>

        {result ? (
          <div className="empty-state" role="status">
            <div className="empty-state-icon"><MdCheckCircle color="var(--color-success, #16a34a)" /></div>
            <div className="empty-state-title">{translateText('Application submitted')}</div>
            <p className="empty-state-text">
              {translateText('Your application number is')}:{' '}
              <strong style={{ fontSize: '1.1rem' }}>{result.application_number}</strong>
            </p>
            <p className="empty-state-text">
              {translateText('Keep this number. The admissions office will contact you by email.')}
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setResult(null)}>
              {translateText('Submit another')}
            </button>
            <div style={{ marginTop: 16 }}>
              <Link to="/login">{translateText('Back to login')}</Link>
            </div>
          </div>
        ) : (
          <form className="form-stack" onSubmit={onSubmit}>
            {/* Honeypot — hidden from humans */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }}>
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={set('website')}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>{translateText('First Name')} *</label>
                <input className="form-control" required value={form.first_name} onChange={set('first_name')} />
              </div>
              <div className="form-group">
                <label>{translateText('Last Name')} *</label>
                <input className="form-control" required value={form.last_name} onChange={set('last_name')} />
              </div>
            </div>
            <div className="form-group">
              <label>{translateText('Middle name')}</label>
              <input className="form-control" value={form.middle_name} onChange={set('middle_name')} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Email *</label>
                <input type="email" className="form-control" required value={form.email} onChange={set('email')} />
              </div>
              <div className="form-group">
                <label>{translateText('Phone')}</label>
                <input type="tel" className="form-control" value={form.phone} onChange={set('phone')} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>{translateText('Date of birth')}</label>
                <input type="date" className="form-control" value={form.date_of_birth} onChange={set('date_of_birth')} />
              </div>
              <div className="form-group">
                <label>{translateText('Gender')}</label>
                <select className="form-control" value={form.gender} onChange={set('gender')}>
                  <option value="">{translateText('Select…')}</option>
                  <option value="female">{translateText('Female')}</option>
                  <option value="male">{translateText('Male')}</option>
                  <option value="other">{translateText('Other')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{translateText('Nationality')}</label>
                <input className="form-control" value={form.nationality} onChange={set('nationality')} />
              </div>
            </div>
            <div className="form-group">
              <label>{translateText('Preferred programme / department')} *</label>
              <select className="form-control" required value={form.department_id} onChange={set('department_id')}>
                <option value="">{translateText('Select…')}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>{translateText('Preferred level')}</label>
                <input className="form-control" value={form.preferred_level} onChange={set('preferred_level')} />
              </div>
              <div className="form-group">
                <label>{translateText('Academic Year')}</label>
                <select className="form-control" value={form.academic_year_id} onChange={set('academic_year_id')}>
                  <option value="">{translateText('Select…')}</option>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>{translateText('Previous school')}</label>
              <input className="form-control" value={form.previous_school} onChange={set('previous_school')} />
            </div>
            <div className="form-group">
              <label>{translateText('Previous qualification')}</label>
              <input className="form-control" value={form.previous_qualification} onChange={set('previous_qualification')} placeholder="GCE A-Level, Baccalauréat…" />
            </div>
            {mutation.isError && (
              <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>
                {mutation.error?.message || translateText('Submission failed')}
              </p>
            )}
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={mutation.isPending}>
              {mutation.isPending ? translateText('Submitting…') : translateText('Submit application')}
            </button>
            <p style={{ textAlign: 'center', marginTop: 12 }}>
              <Link to="/login">{translateText('Already have an account? Sign in')}</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
