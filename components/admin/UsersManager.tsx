'use client';

import { useState, useTransition, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UserPlus, Trash2, Mail } from 'lucide-react';
import { inviteUser, updateUserRole, deleteUser, type AdminUserRow } from '@/app/(admin)/admin/users/actions';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import type { AppRole } from '@/lib/auth';

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

const selectClass =
  'px-3 py-2 border border-gray-300 rounded-none bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent';

function formatDate(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function UsersManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: AdminUserRow[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('viewer');
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();

    const formData = new FormData();
    formData.set('full_name', fullName);
    formData.set('email', email);
    formData.set('role', role);

    const result = await inviteUser(formData);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Invitation sent to ${email}.`);
    setFullName('');
    setEmail('');
    setRole('viewer');
    startTransition(() => router.refresh());
  };

  const handleRoleChange = async (userId: string, nextRole: AppRole) => {
    setBusyId(userId);
    const result = await updateUserRole(userId, nextRole);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Role updated.');
    startTransition(() => router.refresh());
  };

  const handleDelete = async (userId: string, userEmail: string) => {
    const ok = await confirmDialog({
      title: 'Delete user',
      message: `Delete user ${userEmail}? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setBusyId(userId);
    const result = await deleteUser(userId);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`User ${userEmail} deleted.`);
    startTransition(() => router.refresh());
  };

  return (
    <div className="space-y-8">
      {/* Invite form */}
      <section className="bg-white border border-gray-200 p-6 space-y-5">
        <h2 className="text-lg font-medium uppercase tracking-wide border-b border-gray-200 pb-3">
          Invite User
        </h2>
        <form onSubmit={handleInvite} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Full name"
              name="full_name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
            />
            <Input
              label="Email"
              type="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@lukenlighting.com"
            />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AppRole)}
                className={`${selectClass} w-full`}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button type="submit" variant="primary" disabled={isPending}>
            <UserPlus className="w-4 h-4 mr-2" />
            {isPending ? 'Sending...' : 'Send invitation'}
          </Button>
        </form>
        <p className="text-xs text-gray-500 flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5" />
          The user receives an email to set their password and confirm their account.
        </p>
      </section>

      {/* Users table */}
      <section className="bg-white border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium uppercase tracking-wide">
            Team ({initialUsers.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last sign in</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {initialUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No users yet.
                  </td>
                </tr>
              ) : (
                initialUsers.map((u) => {
                  const isSelf = u.id === currentUserId;
                  return (
                    <tr key={u.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                        {u.full_name}
                        {isSelf && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">{u.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={u.role}
                          disabled={busyId === u.id}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as AppRole)}
                          className={selectClass}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {u.confirmed ? (
                          <span className="inline-flex px-2 py-0.5 text-xs bg-green-50 text-green-700 border border-green-200">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 text-xs bg-amber-50 text-amber-700 border border-amber-200">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{formatDate(u.last_sign_in_at)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(u.id, u.email)}
                          disabled={isSelf || busyId === u.id}
                          title={isSelf ? 'You cannot delete your own account' : 'Delete user'}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
