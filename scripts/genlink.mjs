import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const siteOrigin = process.env.SITE_ORIGIN || 'http://localhost:3000';

const type = process.argv[2] || 'recovery'; // recovery | magiclink | invite
const email = process.argv[3];

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!email) {
  console.error('Usage: node --env-file=.env.local scripts/genlink.mjs <recovery|magiclink|invite> <email>');
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.generateLink({ type, email });
if (error) {
  console.error('ERROR:', error.message);
  process.exit(1);
}

const tokenHash = data?.properties?.hashed_token;
console.log('TYPE       =', type);
console.log('TOKEN_HASH =', tokenHash);
console.log('LOCAL_URL  =', `${siteOrigin}/auth/confirm?token_hash=${tokenHash}&type=${type}`);
console.log('ACTION_LINK=', data?.properties?.action_link);
