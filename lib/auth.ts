/**
 * Server-side auth helpers (current user + role).
 * Role is read from public.user_profiles.
 */

import { createClient } from '@/lib/supabase/server';

export type AppRole = 'admin' | 'editor' | 'viewer';

export async function getCurrentUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export async function getCurrentUserRole(): Promise<AppRole | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  return (data?.role as AppRole) ?? null;
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  return (await getCurrentUserRole()) === 'admin';
}
