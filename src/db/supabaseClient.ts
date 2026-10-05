import { createClient } from '@supabase/supabase-js';

// Retrieve credentials from Vite env or fallback to empty strings
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '')
  .trim()
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  !SUPABASE_URL.includes('your-project-url')
);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
