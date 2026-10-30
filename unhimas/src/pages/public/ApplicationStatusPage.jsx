import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MdSearch, MdSchool } from 'react-icons/md';
import { useTranslation } from '../../i18n';
import { lookupApplication } from '../../services/admissionsService';

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
    setLoading(true);
    try {
      const row = await lookupApplication(number.trim(), email.trim());
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

  return (
    <div className="auth-page" style={{ minHeight: '100vh', padding: '2rem 1rem' }}>
      <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <MdSchool size={36} color="var(--color-primary)" />
          <h1 className="page-title" style={{ marginTop: 10 }}>
            {translateText('Application status')}
          </h1>
          <p className="page-subtitle">
            {translateText('Enter your application number and email to check status.')}
          </p>
        </div>

        <form className="form-stack" onSubmit={onSubmit}>
          <div className="form-group">
            <label>{translateText('Application number')}</label>
            <input
              className="form-control"
              required
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="APP-2026-01000"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              className="form-control"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            <MdSearch /> {loading ? translateText('Searching…') : translateText('Check status')}
          </button>
        </form>

        {result && (
          <div className="card" style={{ marginTop: '1.25rem', padding: '1rem' }}>
            <div style={{ fontWeight: 700 }}>{result.application_number}</div>
            <div style={{ marginTop: 8 }}>
              {result.first_name} {result.last_name}
            </div>
            <div style={{ marginTop: 8 }}>
              <span className="badge badge-info">{String(result.status).replace('_', ' ')}</span>
            </div>
            {result.department_name && (
              <div style={{ marginTop: 8, fontSize: '0.875rem' }}>{result.department_name}</div>
            )}
            {result.submitted_at && (
              <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {translateText('Submitted')}: {new Date(result.submitted_at).toLocaleString()}
              </div>
            )}
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/apply">{translateText('Submit a new application')}</Link>
          {' · '}
          <Link to="/login">{translateText('Back to login')}</Link>
        </p>
      </div>
    </div>
  );
}
