import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MdErrorOutline, MdLock, MdVisibility, MdVisibilityOff, MdCheckCircle } from 'react-icons/md';
import { supabase } from '../../lib/supabase';
import { clearMustResetPassword } from '../../services/auth';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/unhimas_logo.jpg';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const ROLE_HOME = {
  admin:     '/admin',
  frontdesk: '/frontdesk',
  lecturer:  '/lecturer',
  student:   '/student',
};

/**
 * SetNewPasswordPage
 *
 * Shown immediately after first login when must_reset_password === true.
 * The user cannot navigate anywhere else until they set a new password.
 */
export default function SetNewPasswordPage() {
  const navigate = useNavigate();
  const { profile, refetchProfile, signOut } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ password }) => {
    setLoading(true);
    setServerError('');

    // 1. Update the Supabase Auth password
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setServerError('Could not update your password. Please try again.');
      setLoading(false);
      return;
    }

    // 2. Clear the must_reset_password flag on the school record
    try {
      await clearMustResetPassword();
    } catch (err) {
      // Non-fatal — the password was changed; we still let the user in.
      console.error('[SetNewPassword] clearMustResetPassword failed:', err);
    }

    // 3. Re-fetch the profile so downstream components have fresh data
    const freshProfile = await refetchProfile();
    const destination = ROLE_HOME[freshProfile?.role] || '/unauthorized';
    navigate(destination, { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-card-header">
          <img src={logo} alt="UNHIMAS logo" className="auth-logo" />
          <div>
            <div className="auth-school-name">UNHIMAS</div>
            <div className="auth-school-subtitle">Set Your Password</div>
          </div>
        </div>

        {/* Body */}
        <div className="auth-card-body">
          <h1 className="auth-title">Create your password</h1>

          {/* Info banner */}
          <div
            className="auth-alert"
            role="note"
            style={{
              background: 'var(--color-primary-light, rgba(99,102,241,0.08))',
              border: '1px solid var(--color-primary)',
              marginBottom: '1.25rem',
              gap: '0.5rem',
              flexDirection: 'column',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              <MdLock style={{ flexShrink: 0 }} />
              Password change required
            </div>
            <div style={{ fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
              Your account was created by the administrator with a temporary password. You must set a
              personal password before you can access the system.
            </div>
            {profile?.role === 'student' && (
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                Signed in as: <strong style={{ color: 'var(--color-text)' }}>{profile.full_name}</strong>
                &nbsp;· Role: Student
              </div>
            )}
            {profile?.role === 'lecturer' && (
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                Signed in as: <strong style={{ color: 'var(--color-text)' }}>{profile.full_name}</strong>
                &nbsp;· Role: Lecturer
              </div>
            )}
          </div>

          {serverError && (
            <div className="auth-alert error" role="alert">
              <MdErrorOutline style={{ flexShrink: 0 }} />
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* New password */}
            <div className="form-group">
              <label htmlFor="snp-password" className="form-label">
                New password
              </label>
              <div className="form-input-wrapper">
                <input
                  id="snp-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input with-icon-right ${errors.password ? 'error' : ''}`}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  {...register('password')}
                />
                <button
                  type="button"
                  className="input-icon-right"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
              {errors.password && (
                <div className="form-error" role="alert">
                  <MdErrorOutline /> {errors.password.message}
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="form-group">
              <label htmlFor="snp-confirm" className="form-label">
                Confirm new password
              </label>
              <input
                id="snp-confirm"
                type={showPassword ? 'text' : 'password'}
                className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <div className="form-error" role="alert">
                  <MdErrorOutline /> {errors.confirmPassword.message}
                </div>
              )}
            </div>

            {/* Password hints */}
            <ul
              style={{
                fontSize: '0.78rem',
                color: 'var(--color-text-muted)',
                paddingLeft: '1.25rem',
                marginBottom: '1.25rem',
                lineHeight: 1.8,
              }}
            >
              <li>At least 8 characters</li>
              <li>At least one uppercase letter (A–Z)</li>
              <li>At least one number (0–9)</li>
            </ul>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Saving…
                </>
              ) : (
                <>
                  <MdCheckCircle style={{ fontSize: '1.1rem' }} />
                  Set password &amp; continue
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                fontSize: '0.8rem',
                textDecoration: 'underline',
              }}
              onClick={signOut}
            >
              Sign out instead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
