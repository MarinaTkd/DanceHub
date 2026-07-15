import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | undefined;
let _supabaseAdmin: SupabaseClient | undefined;

/** Public client — respects RLS. Use for frontend reads. */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    _supabase = createClient(url, key);
  }
  return _supabase;
}

/** Admin client — bypasses RLS. Use only in server-side API routes. */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}
