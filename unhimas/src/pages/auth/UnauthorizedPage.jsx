import { Link } from 'react-router-dom';
import { MdLock, MdArrowBack } from 'react-icons/md';
import { useTranslation } from '../../i18n';
import '../../styles/components.css';

export default function UnauthorizedPage() {
  const { language, toggleLanguage, translateText } = useTranslation();

  return (
    <div className="unauthorized-page" style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={toggleLanguage}
        className="btn btn-secondary btn-sm"
        style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
        title={language === 'en' ? 'Passer en Français' : 'Switch to English'}
      >
        <span>🌐</span>
        <span style={{ fontWeight: 600 }}>{language === 'en' ? 'FR' : 'EN'}</span>
      </button>

      <div>
        <MdLock style={{ fontSize: '4rem', color: 'var(--color-secondary)', marginBottom: '1rem' }} />
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
          {translateText('Access Denied')}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', maxWidth: '360px' }}>
          {translateText('You do not have permission to access this page. Please contact your administrator if you believe this is an error.')}
        </p>
        <Link to="/" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <MdArrowBack /> {translateText('Go to Dashboard')}
        </Link>
      </div>
    </div>
  );
}
