'use client';

import { usePathname } from 'next/navigation';
import { AdminHeader } from '@/components/AdminHeader';
import { AdminSidebar } from '@/components/AdminSidebar';
import { Toaster } from '@/components/ui/Toast';
import { Confirmer } from '@/components/ui/ConfirmDialog';
import type { AppRole } from '@/lib/auth';

// Auth pages render full-screen without the admin chrome (header/sidebar).
const BARE_ROUTES = ['/admin/login', '/admin/forgot-password', '/admin/reset-password'];

export function AdminLayoutClient({
  children,
  role,
}: {
  children: React.ReactNode;
  role: AppRole | null;
}) {
  const pathname = usePathname();
  const isBare = BARE_ROUTES.includes(pathname);

  if (isBare) {
    return (
      <>
        {children}
        <Toaster />
        <Confirmer />
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <AdminHeader />
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar role={role} />
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
      <Toaster />
      <Confirmer />
    </div>
  );
}
