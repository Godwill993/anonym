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
  const { session, profile, loading, profileError } = useAuth();
  const [mustReset, setMustReset] = useState(null); // null = checking, true/false = resolved

  useEffect(() => {
    if (!session || !profile) {
      setMustReset(false);
      return;
    }
    if (profile.role !== 'student' && profile.role !== 'lecturer') {
      setMustReset(false);
      return;
    }

    const table = profile.role === 'student' ? 'students' : 'lecturers';
    supabase
      .from(table)
      .select('must_reset_password')
      .eq('profile_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setMustReset(data?.must_reset_password === true);
      })
      .catch(() => setMustReset(false));
  }, [session, profile]);

  if (loading || mustReset === null) {
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

  // Force password change before allowing access to any role-specific page
  if (mustReset) {
    return <Navigate to="/set-new-password" replace />;
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
