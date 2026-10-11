import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[UNHIMAS] Supabase credentials are not configured.\n' +
    'Create a file called .env in the project root with:\n\n' +
    '  VITE_SUPABASE_URL=https://your-project.supabase.co\n' +
    '  VITE_SUPABASE_ANON_KEY=your-anon-key\n\n' +
    'Get these from: Supabase Dashboard → Settings → API'
  );
}

// Provide placeholder values so the app renders (login page) even without .env.
// All Supabase calls will fail gracefully until real credentials are supplied.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

export const supabaseSignup = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  }
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
