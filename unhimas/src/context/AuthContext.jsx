import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  const fetchProfile = useCallback(async (userId) => {
    setProfileError(null);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      setProfile(null);
      setProfileError(error);
      return null;
    }
    setProfile(data);
    return data;
  }, []);

  const refetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        setProfile(null);
        setProfileError(error || new Error('No authenticated user'));
        return null;
      }
      return await fetchProfile(user.id);
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { data: { session: current } } = await supabase.auth.getSession();
        if (cancelled) return;
        setSession(current);
        if (current?.user) {
          await fetchProfile(current.user.id);
        } else {
          setProfile(null);
          setProfileError(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        setLoading(true);
        Promise.resolve()
          .then(() => fetchProfile(nextSession.user.id))
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      } else {
        setProfile(null);
        setProfileError(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setProfileError(null);
  };

  return (
    <AuthContext.Provider value={{
      session,
      profile,
      loading,
      profileError,
      signOut,
      refetchProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
