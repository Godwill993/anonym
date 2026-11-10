import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MdErrorOutline, MdCheckCircleOutline, MdArrowBack } from 'react-icons/md';
import { supabase } from '../../lib/supabase';
import { useTranslation } from '../../i18n';
import logo from '../../assets/unhimas_logo.jpg';
import '../../styles/components.css';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
});

export default function ForgotPasswordPage() {
  const { language, toggleLanguage, translateText } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ email }) => {
    setLoading(true);
    setServerError('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setServerError(translateText('Failed to send reset email. Please try again.'));
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header" style={{ position: 'relative' }}>
          <img src={logo} alt="UNHIMAS logo" className="auth-logo" />
          <div>
            <div className="auth-school-name">UNHIMAS</div>
            <div className="auth-school-subtitle">{translateText('Password Recovery')}</div>
          </div>
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
          <h1 className="auth-title">{translateText('Reset your password')}</h1>

          {success ? (
            <div className="auth-alert success" role="status">
              <MdCheckCircleOutline style={{ flexShrink: 0, fontSize: '1.2rem' }} />
              <div>
                <strong>{translateText('Email sent!')}</strong>{' '}
                {translateText('Check your inbox for a password reset link.')}
              </div>
            </div>
          ) : (
            <>
              {serverError && (
                <div className="auth-alert error" role="alert">
                  <MdErrorOutline />
                  {serverError}
                </div>
              )}

              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                {translateText("Enter your email address and we'll send you a link to reset your password.")}
              </p>

              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <div className="form-group">
                  <label htmlFor="email" className="form-label">{translateText('Email address')}</label>
                  <input
                    id="email"
                    type="email"
                    className={`form-input ${errors.email ? 'error' : ''}`}
                    autoComplete="email"
                    {...register('email')}
                  />
                  {errors.email && (
                    <div className="form-error" role="alert">
                      <MdErrorOutline />{translateText(errors.email.message)}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={loading}
                  style={{ marginBottom: '1rem' }}
                >
                  {loading ? (
                    <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> {translateText('Sending…')}</>
                  ) : translateText('Send reset link')}
                </button>
              </form>
            </>
          )}

          <div style={{ textAlign: 'center' }}>
            <Link to="/login" className="auth-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <MdArrowBack /> {translateText('Back to login')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
