import { redirect } from 'next/navigation';
import { getCurrentUser, getCurrentUserRole } from '@/lib/auth';
import { getUsers } from './actions';
import { UsersManager } from '@/components/admin/UsersManager';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const role = await getCurrentUserRole();
  if (role !== 'admin') {
    redirect('/admin/dashboard');
  }

  const currentUser = await getCurrentUser();
  const { users, error } = await getUsers();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-light tracking-widest uppercase mb-2">Users</h1>
        <p className="text-gray-600">Invite team members and manage their access.</p>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>
      ) : (
        <UsersManager initialUsers={users} currentUserId={currentUser?.id ?? null} />
      )}
    </div>
  );
}
