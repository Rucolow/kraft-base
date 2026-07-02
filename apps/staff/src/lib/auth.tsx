import type { Session } from '@supabase/supabase-js';
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { connectPowerSync, wipePowerSync } from './powersync';
import { isSupabaseConfigured, supabase } from './supabase/client';

interface AuthValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  // True when there is no live session but a persisted one exists on this
  // device — i.e. a cold launch while offline (token refresh needs the network).
  // The local-first data is already on disk; the router lets these launches
  // through instead of stranding staff at a login screen that also needs the
  // network. Sync resumes automatically once a connection is back.
  offlineGrace: boolean;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  verifyCode: (email: string, code: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

// A persisted Supabase session lives under `sb-<ref>-auth-token`. Its presence
// (with a refresh token) means this device was signed in; only an explicit
// SIGNED_OUT removes it.
function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (raw?.includes('refresh_token')) {
          return true;
        }
      }
    }
  } catch {
    /* storage unavailable */
  }
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [offlineGrace, setOfflineGrace] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        // No live session but a persisted one on disk: offline cold start.
        setOfflineGrace(!data.session && hasStoredSession());
        setLoading(false);
        // Staging only: if a test credential is configured (env present only on
        // the staging deployment), sign in automatically so the app can be
        // opened and verified without a magic-link email.
        if (!data.session) {
          const email = import.meta.env.VITE_AUTO_LOGIN_EMAIL as string | undefined;
          const password = import.meta.env.VITE_AUTO_LOGIN_PASSWORD as string | undefined;
          if (email && password) {
            supabase?.auth.signInWithPassword({ email, password });
          }
        }
      })
      .catch(() => {
        setOfflineGrace(hasStoredSession());
        setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (next) {
        setOfflineGrace(false);
      }
      // Reconnect sync only on a genuine sign-in. INITIAL_SESSION is already
      // handled by startPowerSync, and reconnecting on hourly TOKEN_REFRESHED
      // would tear down a live sync stream for nothing (PowerSync pulls fresh
      // tokens itself via fetchCredentials).
      if (event === 'SIGNED_IN' && next) {
        connectPowerSync().catch(() => undefined);
      } else if (event === 'SIGNED_OUT') {
        // Shared-device hygiene: leaving the guest register (passports) in the
        // local DB after sign-out would defeat the sign-out. Wipe; data
        // re-syncs on next sign-in.
        setOfflineGrace(false);
        wipePowerSync().catch(() => undefined);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value: AuthValue = {
    configured: isSupabaseConfigured,
    loading,
    session,
    offlineGrace,
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
