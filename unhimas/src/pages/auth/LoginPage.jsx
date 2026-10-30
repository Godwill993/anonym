import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MdVisibility, MdVisibilityOff, MdErrorOutline, MdWarning, MdOpenInNew } from 'react-icons/md';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import logo from '../../assets/unhimas_logo.jpg';
import '../../styles/components.css';

async function checkMustResetPassword(role) {
  if (role !== 'student' && role !== 'lecturer') return false;
  const table = role === 'student' ? 'students' : 'lecturers';
  const { data } = await supabase
    .from(table)
    .select('must_reset_password')
    .eq('profile_id', (await supabase.auth.getUser()).data?.user?.id)
    .maybeSingle();
  return data?.must_reset_password === true;
}

const ROLE_HOME = {
  admin: '/admin',
  lecturer: '/lecturer',
  student: '/student',
};

export default function LoginPage() {
  const { language, toggleLanguage, t, translateText } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const navigate = useNavigate();
  const { refetchProfile } = useAuth();

  const schema = z.object({
    email: z.string().min(1, t('auth.email_required')).email(t('auth.email_invalid')),
    password: z.string().min(1, t('auth.password_required')),
  });

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const getLoginErrorMessage = (error) => {
    if (error?.code === 'email_not_confirmed' || /email not confirmed/i.test(error?.message || '')) {
      return t('auth.email_not_confirmed');
    }
    if (error?.message === 'Invalid login credentials') {
      return t('auth.incorrect_credentials');
    }
    return error?.message || t('auth.unable_to_sign_in');
  };

  const onSubmit = async ({ email, password }) => {
    if (!isSupabaseConfigured) {
      setServerError(t('auth.supabase_not_configured'));
      return;
    }

    setLoading(true);
    setServerError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setServerError(getLoginErrorMessage(error));
        return;
      }

      const profile = await refetchProfile();
      if (!profile?.role || !profile.is_active) {
        await supabase.auth.signOut();
        setServerError(t('auth.account_inactive'));
        return;
      }

      const mustReset = await checkMustResetPassword(profile.role);
      if (mustReset) {
        navigate('/set-new-password', { replace: true });
        return;
      }

      navigate(ROLE_HOME[profile.role] || '/unauthorized', { replace: true });
    } catch (error) {
      setServerError(getLoginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header" style={{ position: 'relative' }}>
          <button
            type="button"
            className="lang-btn"
            onClick={toggleLanguage}
            style={{
              position: 'absolute',
              top: '0.75rem',
              right: '0.75rem',
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#fff',
              border: 'none',
              padding: '0.2rem 0.6rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
            title={t('auth.toggle_language')}
          >
            {language === 'en' ? 'FR' : 'EN'}
          </button>
          <img src={logo} alt="UNHIMAS logo" className="auth-logo" />
          <div>
            <div className="auth-school-name">UNHIMAS</div>
            <div className="auth-school-subtitle">{t('auth.school_subtitle')}</div>
          </div>
        </div>

        <div className="auth-card-body">
          <h1 className="auth-title">{t('auth.login_title')}</h1>

          {!isSupabaseConfigured && (
            <div className="auth-alert error" role="alert" style={{ marginBottom: '1rem', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                <MdWarning style={{ flexShrink: 0 }} /> {t('auth.supabase_credentials_missing')}
              </div>
              <div style={{ fontSize: '0.78rem', lineHeight: 1.5 }}>
                {translateText('Create a .env file in the project root with your Supabase project URL and anon key.')}
              </div>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#9a002a' }}
              >
                {translateText('Open Supabase Dashboard')} <MdOpenInNew style={{ fontSize: '0.9rem' }} />
              </a>
              <div style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.05)', padding: '0.5rem 0.75rem', borderRadius: 4, fontFamily: 'monospace', lineHeight: 1.6 }}>
                VITE_SUPABASE_URL=https://xxx.supabase.co<br />
                VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
              </div>
            </div>
          )}

          {serverError && (
            <div className="auth-alert error" role="alert">
              <MdErrorOutline style={{ flexShrink: 0 }} />
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-group">
              <label htmlFor="email" className="form-label">{t('auth.email')}</label>
              <input
                id="email"
                type="email"
                className={`form-input ${errors.email ? 'error' : ''}`}
                autoComplete="email"
                disabled={!isSupabaseConfigured}
                {...register('email')}
              />
              {errors.email && (
                <div className="form-error" role="alert"><MdErrorOutline />{errors.email.message}</div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">{t('auth.password')}</label>
              <div className="form-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input with-icon-right ${errors.password ? 'error' : ''}`}
                  autoComplete="current-password"
                  disabled={!isSupabaseConfigured}
                  {...register('password')}
                />
                <button
                  type="button"
                  className="input-icon-right"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? t('auth.hide_password') : t('auth.show_password')}
                >
                  {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
              {errors.password && (
                <div className="form-error" role="alert"><MdErrorOutline />{errors.password.message}</div>
              )}
            </div>

            <div className="auth-links" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
              <Link to="/results" className="auth-link" style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                {t('auth.verify_result')}
              </Link>
              <Link to="/forgot-password" className="auth-link">{t('auth.forgot_password')}</Link>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading || !isSupabaseConfigured}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  {t('auth.signing_in')}
                </>
              ) : (
                t('auth.sign_in')
              )}
            </button>
          </form>

          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              {t('auth.official_portal')}{' '}
              <Link to="/results" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                {t('auth.results_verification')}
              </Link>
              <br />
              <Link to="/apply" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                {translateText('Apply for admission')}
              </Link>
              {' · '}
              <Link to="/apply/status" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                {translateText('Check application status')}
              </Link>
            </div>
          </div>
        </div>

        <div style={{
          padding: '0.875rem 2rem',
          borderTop: '1px solid var(--color-border)',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>© {new Date().getFullYear()} UNHIMAS</span>
          <Link to="/results" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            {t('auth.verification_portal')}
          </Link>
        </div>
      </div>
    </div>
  );
}
