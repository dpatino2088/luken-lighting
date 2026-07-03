'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type Mode = 'password' | 'magic';

export default function AdminLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handlePasswordSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase not configured');
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(signInError.message);
        setIsLoading(false);
        return;
      }

      router.push('/admin/dashboard');
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  const handleMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase not configured');
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin/dashboard`,
        },
      });

      if (otpError) {
        setError(otpError.message);
        setIsLoading(false);
        return;
      }

      setMagicSent(true);
      setIsLoading(false);
    } catch {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setMagicSent(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <Image src="/luken-logo.svg" alt="Luken Lighting" width={160} height={41} className="h-8 w-auto" />
          </div>
          <p className="text-gray-600 text-sm uppercase tracking-wide">Admin Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white py-8 px-6 shadow-sm border border-gray-200">
          {mode === 'magic' && magicSent ? (
            <div className="space-y-6 text-center">
              <div className="p-4 bg-green-50 border border-green-200 text-green-800 text-sm">
                If an account exists for <span className="font-medium">{email}</span>, we sent a sign-in link. Check
                your inbox.
              </div>
              <button
                type="button"
                onClick={() => switchMode('password')}
                className="text-sm text-gray-600 hover:text-gray-900 underline"
              >
                Back to password sign in
              </button>
            </div>
          ) : (
            <form onSubmit={mode === 'password' ? handlePasswordSignIn : handleMagicLink} className="space-y-6">
              <Input
                label="Email"
                type="email"
                name="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@lukenlighting.com"
              />

              {mode === 'password' && (
                <div className="space-y-2">
                  <Input
                    label="Password"
                    type="password"
                    name="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                  <div className="text-right">
                    <Link
                      href="/admin/forgot-password"
                      className="text-xs text-gray-500 hover:text-gray-900"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>
              )}

              <Button type="submit" variant="primary" size="lg" disabled={isLoading} className="w-full">
                {isLoading
                  ? mode === 'password'
                    ? 'Signing in...'
                    : 'Sending link...'
                  : mode === 'password'
                    ? 'Sign In'
                    : 'Send magic link'}
              </Button>

              <div className="pt-2 border-t border-gray-100 text-center">
                {mode === 'password' ? (
                  <button
                    type="button"
                    onClick={() => switchMode('magic')}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Sign in with a magic link instead
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => switchMode('password')}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Sign in with password instead
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-500">This portal is for authorized personnel only.</p>
      </div>
    </div>
  );
}
