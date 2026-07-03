'use client';

import { useState, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  // The user lands here with a session created from the email link (recovery/invite).
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setChecking(false);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
      setChecking(false);
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase not configured');

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/dashboard');
        router.refresh();
      }, 1500);
    } catch {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <Image src="/luken-logo.svg" alt="Luken Lighting" width={160} height={41} className="h-8 w-auto" />
          </div>
          <p className="text-gray-600 text-sm uppercase tracking-wide">Set New Password</p>
        </div>

        <div className="bg-white py-8 px-6 shadow-sm border border-gray-200">
          {checking ? (
            <p className="text-sm text-gray-500 text-center">Loading...</p>
          ) : !hasSession ? (
            <div className="space-y-6 text-center">
              <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm">
                This link is invalid or has expired. Request a new password reset.
              </div>
              <Link href="/admin/forgot-password" className="text-sm text-gray-600 hover:text-gray-900 underline">
                Request a new link
              </Link>
            </div>
          ) : success ? (
            <div className="p-4 bg-green-50 border border-green-200 text-green-800 text-sm text-center">
              Password updated. Redirecting...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="New password"
                type="password"
                name="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
              <Input
                label="Confirm password"
                type="password"
                name="confirm"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
              />

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>
              )}

              <Button type="submit" variant="primary" size="lg" disabled={isLoading} className="w-full">
                {isLoading ? 'Saving...' : 'Update password'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
