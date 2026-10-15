import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

/**
 * Protect a route. Optionally restrict to specific roles.
 * roles: e.g. ['admin', 'frontdesk']
 *
 * Also intercepts student and lecturer users who still have
 * must_reset_password = true and sends them to /set-new-password.
 */
export default function ProtectedRoute({ children, roles }) {
  const { session, profile, loading, profileError, signOut } = useAuth();
  const [resetCheckResult, setResetCheckResult] = useState(null);
  const [resetCheckAttempt, setResetCheckAttempt] = useState(0);

  const needsResetCheck = Boolean(
    session && profile && (profile.role === 'student' || profile.role === 'lecturer')
  );
  const hasCurrentResetCheck = resetCheckResult?.userId === session?.user?.id
    && resetCheckResult?.role === profile?.role
    && resetCheckResult?.attempt === resetCheckAttempt;
  const mustReset = hasCurrentResetCheck ? resetCheckResult.mustReset : null;
  const resetCheckError = hasCurrentResetCheck ? resetCheckResult.error : null;

  useEffect(() => {
    if (!needsResetCheck) return;

    let isMounted = true;
    const table = profile.role === 'student' ? 'students' : 'lecturers';
    const checkKey = {
      userId: session.user.id,
      role: profile.role,
      attempt: resetCheckAttempt,
    };
    supabase
      .from(table)
      .select('must_reset_password')
      .eq('profile_id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error || !data) {
          setResetCheckResult({
            ...checkKey,
            error: error || new Error('The account password status could not be verified.'),
          });
          return;
        }
        setResetCheckResult({
          ...checkKey,
          mustReset: data.must_reset_password === true,
          error: null,
        });
      })
      .catch((error) => {
        if (!isMounted) return;
        setResetCheckResult({ ...checkKey, error });
      });

    return () => {
      isMounted = false;
    };
  }, [needsResetCheck, session?.user?.id, profile?.role, resetCheckAttempt]);

  if (loading || (needsResetCheck && mustReset === null && !resetCheckError)) {
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

  if (needsResetCheck && resetCheckError) {
    return (
      <div className="unauthorized-page">
        <div role="alert">
          <h1>Account status could not be verified</h1>
          <p>For your security, access is paused until your password status can be checked.</p>
          <button className="btn btn-primary" onClick={() => setResetCheckAttempt((attempt) => attempt + 1)}>
            Try again
          </button>
          <button className="btn btn-outline" onClick={signOut} style={{ marginLeft: '0.5rem' }}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // Force password change before allowing access to any role-specific page
  if (needsResetCheck && mustReset) {
    return <Navigate to="/set-new-password" replace />;
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
