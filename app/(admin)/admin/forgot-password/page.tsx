'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase not configured');

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        setIsLoading(false);
        return;
      }

      setSent(true);
      setIsLoading(false);
    } catch {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <Image src="/luken-logo.svg" alt="Luken Lighting" width={160} height={41} className="h-8 w-auto" />
          </div>
          <p className="text-gray-600 text-sm uppercase tracking-wide">Reset Password</p>
        </div>

        <div className="bg-white py-8 px-6 shadow-sm border border-gray-200">
          {sent ? (
            <div className="space-y-6 text-center">
              <div className="p-4 bg-green-50 border border-green-200 text-green-800 text-sm">
                If an account exists for <span className="font-medium">{email}</span>, we sent a link to reset your
                password. Check your inbox.
              </div>
              <Link href="/admin/login" className="text-sm text-gray-600 hover:text-gray-900 underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <p className="text-sm text-gray-600">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>

              <Input
                label="Email"
                type="email"
                name="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@lukenlighting.com"
              />

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>
              )}

              <Button type="submit" variant="primary" size="lg" disabled={isLoading} className="w-full">
                {isLoading ? 'Sending...' : 'Send reset link'}
              </Button>

              <div className="text-center">
                <Link href="/admin/login" className="text-sm text-gray-500 hover:text-gray-900">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
