import { type SupabaseClient, createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Null until provisioned (see .env.example). Auth and sync degrade to local-only
// when absent, which is the local verification path.
// Implicit flow (tokens returned in the URL) rather than PKCE: magic links are
// often opened in a different browser context on iOS (Mail in-app browser, a
// non-default browser), where the PKCE verifier is missing and login silently
// bounces back. Implicit lets whichever context opens the link establish the
// session.
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'implicit',
        },
      })
    : null;

export const isSupabaseConfigured = supabase !== null;
