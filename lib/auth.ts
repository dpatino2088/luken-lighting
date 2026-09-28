/**
 * Server-side auth helpers (current user + role).
 * Role is read from public.user_profiles.
 * React cache() dedupes getUser + profile within one request (layout + page + actions).
 */

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type AppRole = 'admin' | 'editor' | 'viewer';

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
});

export const getCurrentUserRole = cache(async (): Promise<AppRole | null> => {
  const supabase = await createClient();
  if (!supabase) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  const { data } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  return (data?.role as AppRole) ?? null;
});

export async function isCurrentUserAdmin(): Promise<boolean> {
  return (await getCurrentUserRole()) === 'admin';
}
