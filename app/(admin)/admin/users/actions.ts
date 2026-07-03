'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { isCurrentUserAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { AppRole } from '@/lib/auth';

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  confirmed: boolean;
  last_sign_in_at: string | null;
  created_at: string;
}

const VALID_ROLES: AppRole[] = ['admin', 'editor', 'viewer'];
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function getUsers(): Promise<{ users: AdminUserRow[]; error?: string }> {
  if (!(await isCurrentUserAdmin())) return { users: [], error: 'Not authorized' };

  const admin = createAdminClient();
  if (!admin) return { users: [], error: 'Server not configured' };

  const { data: list, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) return { users: [], error: listError.message };

  const { data: profiles } = await admin.from('user_profiles').select('id, full_name, role');
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  const users: AdminUserRow[] = list.users.map((u) => {
    const profile = profileMap.get(u.id);
    return {
      id: u.id,
      email: u.email ?? '—',
      full_name: (profile?.full_name as string) || (u.user_metadata?.full_name as string) || '—',
      role: ((profile?.role as AppRole) || 'viewer') as AppRole,
      confirmed: !!u.email_confirmed_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      created_at: u.created_at,
    };
  });

  // Newest first
  users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return { users };
}

export async function inviteUser(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized' };

  const email = String(formData.get('email') || '').trim().toLowerCase();
  const fullName = String(formData.get('full_name') || '').trim();
  const role = String(formData.get('role') || 'viewer') as AppRole;

  if (!email) return { error: 'Email is required' };
  if (!fullName) return { error: 'Full name is required' };
  if (!VALID_ROLES.includes(role)) return { error: 'Invalid role' };

  const admin = createAdminClient();
  if (!admin) return { error: 'Server not configured' };

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${siteUrl()}/auth/confirm`,
  });

  if (error) return { error: error.message };

  const userId = data.user?.id;
  if (userId) {
    const { error: profileError } = await admin
      .from('user_profiles')
      .upsert({ id: userId, full_name: fullName, role }, { onConflict: 'id' });
    if (profileError) return { error: profileError.message };
  }

  revalidatePath('/admin/users');
  return { success: true };
}

export async function updateUserRole(userId: string, role: AppRole): Promise<{ error?: string; success?: boolean }> {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized' };
  if (!VALID_ROLES.includes(role)) return { error: 'Invalid role' };

  const admin = createAdminClient();
  if (!admin) return { error: 'Server not configured' };

  const { error } = await admin.from('user_profiles').update({ role }).eq('id', userId);
  if (error) return { error: error.message };

  revalidatePath('/admin/users');
  return { success: true };
}

export async function deleteUser(userId: string): Promise<{ error?: string; success?: boolean }> {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized' };

  const admin = createAdminClient();
  if (!admin) return { error: 'Server not configured' };

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath('/admin/users');
  return { success: true };
}
