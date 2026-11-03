import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MdSearch, MdErrorOutline, MdCheckCircle } from 'react-icons/md';
import { useTranslation } from '../../i18n';
import { lookupApplication } from '../../services/admissionsService';
import {
  validateApplicationLookup,
  checkPublicLookupThrottle,
  recordPublicLookupAttempt,
} from '../../lib/publicFormGuard';
import logo from '../../assets/unhimas_logo.jpg';
import '../../styles/components.css';

const THROTTLE_KEY = 'unhimas:public-lookup:application-status';

function browserStore() {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

export default function ApplicationStatusPage() {
  const { translateText } = useTranslation();
  const [number, setNumber] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    const validated = validateApplicationLookup(number, email);
    if (!validated.ok) {
      setError(translateText(validated.message));
      return;
    }

    const store = browserStore();
    const gate = checkPublicLookupThrottle(store, THROTTLE_KEY);
    if (!gate.allowed) {
      const secs = Math.ceil((gate.retryAfterMs || 0) / 1000);
      setError(
        translateText('Please wait a few seconds before searching again.') +
          (secs > 0 ? ` (${secs}s)` : ''),
      );
      return;
    }

    recordPublicLookupAttempt(store, THROTTLE_KEY);
    setLoading(true);
    try {
      const row = await lookupApplication(validated.number, validated.email);
      if (!row) {
        setError(translateText('No application found for that number and email.'));
      } else {
        setResult(row);
      }
    } catch (err) {
      setError(err?.message || translateText('Lookup failed'));
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = result?.status
    ? String(result.status).replace(/_/g, ' ')
    : '';

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 440 }}>
        <div className="auth-card-header">
          <img src={logo} alt="UNHIMAS logo" className="auth-logo" />
          <div>
            <div className="auth-school-name">UNHIMAS</div>
            <div className="auth-school-subtitle">
              {translateText('Admissions')}
            </div>
          </div>
        </div>

        <div className="auth-card-body">
          <h1 className="auth-title">{translateText('Application status')}</h1>
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
            {translateText('Enter your application number and email to check status.')}
          </p>

          <form onSubmit={onSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="status-number">
                {translateText('Application number')} *
              </label>
              <input
                id="status-number"
                className="form-input"
                required
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="APP-2026-01000"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="status-email">
                {translateText('Email')} *
              </label>
              <input
                id="status-email"
                type="email"
                className="form-input"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            {error && (
              <div className="auth-alert error" role="alert" style={{ marginBottom: '1rem' }}>
                <MdErrorOutline style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? (
                translateText('Searching…')
              ) : (
                <>
                  <MdSearch style={{ marginRight: 6 }} />
                  {translateText('Check status')}
                </>
              )}
            </button>
          </form>

          {result && (
            <div
              style={{
                marginTop: '1.25rem',
                padding: '1rem 1.1rem',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <MdCheckCircle color="var(--color-success, #16a34a)" />
                <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                  {result.application_number}
                </span>
              </div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                {[result.first_name, result.last_name].filter(Boolean).join(' ')}
              </div>
              <div style={{ marginBottom: 8 }}>
                <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                  {statusLabel}
                </span>
              </div>
              {result.department_name && (
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  {result.department_name}
                </div>
              )}
              {result.submitted_at && (
                <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {translateText('Submitted')}: {new Date(result.submitted_at).toLocaleString()}
                </div>
              )}
            </div>
          )}

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
            <Link to="/apply" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
              {translateText('Submit a new application')}
            </Link>
            {' · '}
            <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
              {translateText('Back to login')}
            </Link>
          </div>
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
