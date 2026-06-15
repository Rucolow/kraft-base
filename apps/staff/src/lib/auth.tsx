import type { Session } from '@supabase/supabase-js';
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from './supabase/client';

interface AuthValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  verifyCode: (email: string, code: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value: AuthValue = {
    configured: isSupabaseConfigured,
    loading,
    session,
    signInWithEmail: async (email) => {
      if (!supabase) {
        return { error: 'auth is not configured' };
      }
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      return { error: error?.message ?? null };
    },
    verifyCode: async (email, code) => {
      if (!supabase) {
        return { error: 'auth is not configured' };
      }
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      await supabase?.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
