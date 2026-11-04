import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useTranslation } from '../i18n';

/**
 * Protect a route. Optionally restrict to specific roles.
 * roles: e.g. ['admin'] or ['lecturer', 'student']
 *
 * Also intercepts student and lecturer users who still have
 * must_reset_password = true and sends them to /set-new-password.
 */
export default function ProtectedRoute({ children, roles }) {
  const { session, profile, loading, profileError } = useAuth();
  const { translateText } = useTranslation();
  const [resetCheck, setResetCheck] = useState({ key: null, status: 'checking' });

  const needsResetCheck = Boolean(
    session && profile && (profile.role === 'student' || profile.role === 'lecturer')
  );
  const resetCheckKey = `${session?.user?.id || ''}:${profile?.role || ''}`;

  useEffect(() => {
    if (!needsResetCheck) {
      return;
    }

    let isMounted = true;
    const table = profile.role === 'student' ? 'students' : 'lecturers';
    supabase
      .from(table)
      .select('must_reset_password')
      .eq('profile_id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error || !data) {
          console.error(
            'Unable to verify password reset requirement',
            error || new Error('No matching student or lecturer record'),
          );
        }
        setResetCheck({
          key: resetCheckKey,
          status: error || !data ? 'error' : data.must_reset_password === true ? 'required' : 'clear',
        });
      })
      .catch((error) => {
        console.error('Unable to verify password reset requirement', error);
        if (isMounted) {
          setResetCheck({ key: resetCheckKey, status: 'error' });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [needsResetCheck, resetCheckKey, session?.user?.id, profile?.role]);

  if (
    loading ||
    (needsResetCheck &&
      (resetCheck.key !== resetCheckKey || resetCheck.status === 'checking'))
  ) {
    return (
      <div className="route-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (profileError || !profile || !profile.is_active) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (needsResetCheck && resetCheck.key === resetCheckKey && resetCheck.status === 'error') {
    return (
      <div className="route-loading" role="alert">
        <p>{translateText('Unable to verify your account setup. Refresh the page or contact an administrator.')}</p>
        <button type="button" className="btn btn-outline" onClick={() => window.location.reload()}>
          {translateText('Retry')}
        </button>
      </div>
    );
  }

  // Force password change before allowing access to any role-specific page
  if (needsResetCheck && resetCheck.key === resetCheckKey && resetCheck.status === 'required') {
    return <Navigate to="/set-new-password" replace />;
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
