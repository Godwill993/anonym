import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MdArrowBack, MdErrorOutline, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import { supabase } from '../../lib/supabase';
import { useTranslation } from '../../i18n';
import logo from '../../assets/unhimas_logo.jpg';
import '../../styles/components-auth.css';

const schema = z.object({
  password: z.string().min(8, 'Password must contain at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language, toggleLanguage, translateText } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ password }) => {
    setLoading(true);
    setError('');
    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) {
      setError(translateText('The password could not be updated. Please request a new reset link.'));
      setLoading(false);
      return;
    }
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    let authUnsubscribe = null;

    const verifyResetSession = async () => {
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession && !cancelled) {
        setReady(true);
        return;
      }

      const code = searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (!cancelled) setError(translateText('This reset link has expired or is invalid. Request another password reset link.'));
          return;
        }
        if (!cancelled) setReady(true);
        return;
      }

      let accessToken = searchParams.get('access_token');
      let refreshToken = searchParams.get('refresh_token');

      if ((!accessToken || !refreshToken) && typeof window !== 'undefined' && window.location.hash) {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        accessToken = accessToken || hash.get('access_token');
        refreshToken = refreshToken || hash.get('refresh_token');
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          if (!cancelled) setError(translateText('This reset link has expired or is invalid. Request another password reset link.'));
          return;
        }
        if (!cancelled) setReady(true);
        return;
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (cancelled) return;
        if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          setReady(true);
        }
      });
      authUnsubscribe = () => subscription.unsubscribe();

      setTimeout(async () => {
        if (cancelled) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (session) setReady(true);
        else setError(translateText('This reset link has expired or is invalid. Request another password reset link.'));
      }, 2500);
    };

    verifyResetSession();
    return () => {
      cancelled = true;
      if (authUnsubscribe) authUnsubscribe();
    };
  }, [searchParams, translateText]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header" style={{ position: 'relative' }}>
          <img src={logo} alt="UNHIMAS logo" className="auth-logo" />
          <div className="auth-school-name">UNHIMAS</div>
          <div className="auth-school-subtitle">{translateText('Password Recovery')}</div>
          <button
            type="button"
            className="lang-btn"
            style={{ position: 'absolute', top: 12, right: 12 }}
            onClick={toggleLanguage}
            title={translateText('Toggle Language')}
          >
            {language === 'en' ? 'FR' : 'EN'}
          </button>
        </div>
        <div className="auth-card-body">
          <h1 className="auth-title">{translateText('Create a new password')}</h1>
          {error && <div className="auth-alert error" role="alert"><MdErrorOutline />{error}</div>}
          {!ready && !error && <div className="auth-alert" role="status">{translateText('Verifying reset session…')}</div>}
          {ready && (
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="password">{translateText('New password')}</label>
                <div className="form-input-wrapper">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className={`form-input with-icon-right ${errors.password ? 'error' : ''}`}
                    autoComplete="new-password"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    className="input-icon-right"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? translateText('Hide password') : translateText('Show password')}
                  >
                    {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                  </button>
                </div>
                {errors.password && <div className="form-error" role="alert"><MdErrorOutline />{translateText(errors.password.message)}</div>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="confirmPassword">{translateText('Confirm password')}</label>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && <div className="form-error" role="alert"><MdErrorOutline />{translateText(errors.confirmPassword.message)}</div>}
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? translateText('Updating…') : translateText('Update password')}
              </button>
            </form>
          )}
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <Link to="/login" className="auth-link">
              <MdArrowBack /> {translateText('Back to login')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
