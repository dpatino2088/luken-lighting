import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Email-link landing route. Supabase sends three different shapes:
 *   (a) Custom templates: ?token_hash=&type=  → verifyOtp
 *   (b) PKCE (same browser): ?code=            → exchangeCodeForSession
 *   (c) Default templates: no query tokens; #access_token is invisible to the
 *       server. Redirect and let the browser client consume the fragment
 *       (it survives the redirect). /admin/reset-password shows an invalid-link
 *       message when no session is created.
 *
 * Invite / recovery templates:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=/admin/reset-password
 */
function resolveNext(next: string | null, fallback: string): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return fallback;
}

function loginError(origin: string) {
  return NextResponse.redirect(`${origin}/admin/login?error=auth_link_invalid`);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');

  if (token_hash && type) {
    const supabase = await createClient();
    if (!supabase) return loginError(origin);

    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (error) return loginError(origin);

    const next = resolveNext(
      nextParam,
      type === 'recovery' || type === 'invite' ? '/admin/reset-password' : '/admin/dashboard'
    );
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (code) {
    const supabase = await createClient();
    if (!supabase) return loginError(origin);

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return loginError(origin);

    return NextResponse.redirect(`${origin}${resolveNext(nextParam, '/admin/reset-password')}`);
  }

  // No auth query params. Default email templates put the session in the
  // fragment, which this redirect preserves for the client.
  if (!token_hash && !type && !code) {
    return NextResponse.redirect(`${origin}${resolveNext(nextParam, '/admin/reset-password')}`);
  }

  return loginError(origin);
}
