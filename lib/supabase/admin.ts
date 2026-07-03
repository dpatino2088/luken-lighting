/**
 * Server-ONLY Supabase client using the service_role key.
 * Bypasses RLS. NEVER import this in Client Components or expose the key.
 * Use only inside server actions / route handlers for admin operations
 * (e.g. inviting users), and always after verifying the caller is an admin.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey || url.includes('placeholder')) {
    return null;
  }

  try {
    return createSupabaseClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  } catch {
    return null;
  }
}
