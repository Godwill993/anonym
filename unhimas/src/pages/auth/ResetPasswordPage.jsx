import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MdArrowBack, MdErrorOutline, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import { supabase } from '../../lib/supabase';
import logo from '../../assets/unhimas_logo.jpg';

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
      setError('The password could not be updated. Please request a new reset link.');
      setLoading(false);
      return;
    }
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    let cancelled = false;

    const verifyResetSession = async () => {
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      if (!accessToken || !refreshToken) {
        setError('This reset link is missing or incomplete. Request another password reset link.');
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (sessionError) {
        setError('This reset link has expired or is invalid. Request another password reset link.');
        return;
      }
      if (!cancelled) setReady(true);
    };

    verifyResetSession();
    return () => { cancelled = true; };
  }, [searchParams]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <img src={logo} alt="UNHIMAS logo" className="auth-logo" />
          <div className="auth-school-name">UNHIMAS</div>
          <div className="auth-school-subtitle">Password Recovery</div>
        </div>
        <div className="auth-card-body">
          <h1 className="auth-title">Create a new password</h1>
          {error && <div className="auth-alert error" role="alert"><MdErrorOutline />{error}</div>}
          {!ready && !error && <div className="auth-alert" role="status">Verifying reset session…</div>}
          {ready && <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="password">New password</label>
              <div className="form-input-wrapper">
                <input id="password" type={showPassword ? 'text' : 'password'} className={`form-input with-icon-right ${errors.password ? 'error' : ''}`} autoComplete="new-password" {...register('password')} />
                <button type="button" className="input-icon-right" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <MdVisibilityOff /> : <MdVisibility />}</button>
              </div>
              {errors.password && <div className="form-error" role="alert"><MdErrorOutline />{errors.password.message}</div>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Confirm password</label>
              <input id="confirmPassword" type={showPassword ? 'text' : 'password'} className={`form-input ${errors.confirmPassword ? 'error' : ''}`} autoComplete="new-password" {...register('confirmPassword')} />
              {errors.confirmPassword && <div className="form-error" role="alert"><MdErrorOutline />{errors.confirmPassword.message}</div>}
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>{loading ? 'Updating…' : 'Update password'}</button>
          </form>}
          <div style={{ textAlign: 'center', marginTop: '1rem' }}><Link to="/login" className="auth-link"><MdArrowBack /> Back to login</Link></div>
        </div>
      </div>
    </div>
  );
}
