import { AdminLayoutClient } from '@/components/AdminLayoutClient';
import { getCurrentUserRole } from '@/lib/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getCurrentUserRole();
  return <AdminLayoutClient role={role}>{children}</AdminLayoutClient>;
}
