import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MdCheckCircle, MdErrorOutline } from 'react-icons/md';
import { useTranslation } from '../../i18n';
import { getDepartments } from '../../services/academicService';
import { submitApplication } from '../../services/admissionsService';
import {
  isSubmitTooFast,
  validateAdmissionPayload,
} from '../../lib/publicFormGuard';
import { requireTurnstileToken, verifyTurnstileWithServer } from '../../lib/turnstile';
import TurnstileWidget from '../../components/common/TurnstileWidget';
import logo from '../../assets/unhimas_logo.jpg';
import '../../styles/components.css';

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
  previous_school: '',
  previous_qualification: '',
  website: '', // honeypot — must stay empty
};

export default function ApplyPage() {
  const { translateText } = useTranslation();
  const [form, setForm] = useState(empty);
  const [result, setResult] = useState(null);
  const [localError, setLocalError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [verifyingCaptcha, setVerifyingCaptcha] = useState(false);
  const openedAt = useMemo(() => Date.now(), []);

  const { data: departments = [] } = useQuery({
    queryKey: ['public-departments'],
    queryFn: getDepartments,
  });

  const mutation = useMutation({
    mutationFn: submitApplication,
    onSuccess: (data) => {
      setResult(data?._spam ? { application_number: data.application_number } : data);
      setForm(empty);
      setTurnstileToken('');
    },
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onTurnstileToken = useCallback((token) => {
    setTurnstileToken(token || '');
  }, []);

  const onTurnstileExpire = useCallback(() => {
    setTurnstileToken('');
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (isSubmitTooFast(openedAt)) {
      setLocalError(
        translateText('Please take a moment to review your details before submitting.'),
      );
      return;
    }

    const validation = validateAdmissionPayload(form);
    if (!validation.ok) {
      setLocalError(translateText(validation.message));
      return;
    }

    const captchaLocal = requireTurnstileToken(turnstileToken);
    if (!captchaLocal.ok) {
      setLocalError(translateText(captchaLocal.message));
      return;
    }

    setVerifyingCaptcha(true);
    try {
      const captchaServer = await verifyTurnstileWithServer(turnstileToken);
      if (!captchaServer.ok) {
        setLocalError(translateText(captchaServer.message));
        return;
      }
    } finally {
      setVerifyingCaptcha(false);
    }

    mutation.mutate({
      ...form,
      department_id: form.department_id || null,
      academic_year_id: null,
    });
  };

  const busy = mutation.isPending || verifyingCaptcha;

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <div className="auth-card-header">
          <img src={logo} alt="UNHIMAS logo" className="auth-logo" />
          <div>
            <div className="auth-school-name">UNHIMAS</div>
            <div className="auth-school-subtitle">
              {translateText('University of Higher Institute of Management & Applied Sciences')}
            </div>
          </div>
        </div>

        <div className="auth-card-body">
          {result ? (
            <div style={{ textAlign: 'center' }}>
              <MdCheckCircle size={48} color="var(--color-success, #16a34a)" style={{ marginBottom: 12 }} />
              <h1 className="auth-title" style={{ marginBottom: 8 }}>
                {translateText('Application submitted')}
              </h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: 12 }}>
                {translateText('Your application number is')}
              </p>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  padding: '0.75rem 1rem',
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 12,
                }}
              >
                {result.application_number}
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: 20 }}>
                {translateText('Keep this number. The admissions office will contact you by email.')}
              </p>
              <button type="button" className="btn btn-primary btn-full" onClick={() => setResult(null)}>
                {translateText('Submit another')}
              </button>
              <div style={{ marginTop: 16, fontSize: '0.85rem' }}>
                <Link to="/apply/status" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                  {translateText('Check application status')}
                </Link>
                {' · '}
                <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                  {translateText('Back to login')}
                </Link>
              </div>
            </div>
          ) : (
            <>
              <h1 className="auth-title">{translateText('Online Application')}</h1>
              <p
                style={{
                  textAlign: 'center',
                  fontSize: '0.85rem',
                  color: 'var(--color-text-muted)',
                  marginTop: -8,
                  marginBottom: 20,
                  lineHeight: 1.5,
                }}
              >
                {translateText(
                  'Apply for admission. You will receive an application number to track your status.',
                )}
              </p>

              <form onSubmit={onSubmit} noValidate>
                <div
                  aria-hidden="true"
                  style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }}
                >
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

                <div className="form-group">
                  <label className="form-label" htmlFor="apply-first">
                    {translateText('First Name')} *
                  </label>
                  <input
                    id="apply-first"
                    className="form-input"
                    required
                    value={form.first_name}
                    onChange={set('first_name')}
                    autoComplete="given-name"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="apply-middle">
                      {translateText('Middle name')}
                    </label>
                    <input
                      id="apply-middle"
                      className="form-input"
                      value={form.middle_name}
                      onChange={set('middle_name')}
                      autoComplete="additional-name"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="apply-last">
                      {translateText('Last Name')} *
                    </label>
                    <input
                      id="apply-last"
                      className="form-input"
                      required
                      value={form.last_name}
                      onChange={set('last_name')}
                      autoComplete="family-name"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="apply-email">
                      Email *
                    </label>
                    <input
                      id="apply-email"
                      type="email"
                      className="form-input"
                      required
                      value={form.email}
                      onChange={set('email')}
                      autoComplete="email"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="apply-phone">
                      {translateText('Phone')}
                    </label>
                    <input
                      id="apply-phone"
                      type="tel"
                      className="form-input"
                      value={form.phone}
                      onChange={set('phone')}
                      autoComplete="tel"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="apply-dob">
                      {translateText('Date of birth')}
                    </label>
                    <input
                      id="apply-dob"
                      type="date"
                      className="form-input"
                      value={form.date_of_birth}
                      onChange={set('date_of_birth')}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="apply-gender">
                      {translateText('Gender')}
                    </label>
                    <select
                      id="apply-gender"
                      className="form-input"
                      value={form.gender}
                      onChange={set('gender')}
                    >
                      <option value="">{translateText('Select…')}</option>
                      <option value="female">{translateText('Female')}</option>
                      <option value="male">{translateText('Male')}</option>
                      <option value="other">{translateText('Other')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="apply-nationality">
                      {translateText('Nationality')}
                    </label>
                    <input
                      id="apply-nationality"
                      className="form-input"
                      value={form.nationality}
                      onChange={set('nationality')}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="apply-dept">
                    {translateText('Preferred programme / department')} *
                  </label>
                  <select
                    id="apply-dept"
                    className="form-input"
                    required
                    value={form.department_id}
                    onChange={set('department_id')}
                  >
                    <option value="">{translateText('Select…')}</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                        {d.abbreviation ? ` (${d.abbreviation})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="apply-level">
                    {translateText('Preferred level')}
                  </label>
                  <input
                    id="apply-level"
                    className="form-input"
                    value={form.preferred_level}
                    onChange={set('preferred_level')}
                    placeholder="Level 1, HND Year 1…"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="apply-school">
                    {translateText('Previous school')}
                  </label>
                  <input
                    id="apply-school"
                    className="form-input"
                    value={form.previous_school}
                    onChange={set('previous_school')}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="apply-qual">
                    {translateText('Previous qualification')}
                  </label>
                  <input
                    id="apply-qual"
                    className="form-input"
                    value={form.previous_qualification}
                    onChange={set('previous_qualification')}
                    placeholder="GCE A-Level, Baccalauréat…"
                  />
                </div>

                <div style={{ margin: '1rem 0' }}>
                  <TurnstileWidget
                    onToken={onTurnstileToken}
                    onExpire={onTurnstileExpire}
                    onError={onTurnstileExpire}
                  />
                </div>

                {(localError || mutation.isError) && (
                  <div className="auth-alert error" role="alert" style={{ marginBottom: '1rem' }}>
                    <MdErrorOutline style={{ flexShrink: 0 }} />
                    {localError || mutation.error?.message || translateText('Submission failed')}
                  </div>
                )}

                <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
                  {busy ? translateText('Submitting…') : translateText('Submit application')}
                </button>
              </form>

              <div
                style={{
                  marginTop: '1.25rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--color-border)',
                  textAlign: 'center',
                  fontSize: '0.85rem',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.7,
                }}
              >
                <Link to="/apply/status" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                  {translateText('Check application status')}
                </Link>
                {' · '}
                <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                  {translateText('Already have an account? Sign in')}
                </Link>
              </div>
            </>
          )}
        </div>

        <div
          style={{
            padding: '0.875rem 1.5rem',
            borderTop: '1px solid var(--color-border)',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
          }}
        >
          © {new Date().getFullYear()} UNHIMAS
        </div>
      </div>
    </div>
  );
}
