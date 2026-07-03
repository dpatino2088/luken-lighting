import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.argv[2];

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
const gen = await admin.auth.admin.generateLink({ type: 'recovery', email });
if (gen.error) { console.error('generateLink error:', gen.error.message); process.exit(1); }
const tokenHash = gen.data.properties.hashed_token;
console.log('hashed_token =', tokenHash);

const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const ver = await client.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
console.log('verify error =', ver.error ? `${ver.error.status} ${ver.error.message}` : null);
console.log('has session  =', !!ver.data?.session);
console.log('user email   =', ver.data?.user?.email ?? null);
