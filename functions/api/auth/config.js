import { json } from '../../_lib/auth.js';
import { authingConfig } from '../../_lib/authing.js';
export async function onRequestGet({ env }) {
  if (env.AUTH_PROVIDER === 'invite') {
    try {
      await env.DB.prepare('SELECT user_id FROM invite_accounts LIMIT 1').first();
      await env.DB.prepare('SELECT token_hash FROM invite_sessions LIMIT 1').first();
      await env.DB.prepare('SELECT key FROM account_attempts LIMIT 1').first();
      await env.DB.prepare('SELECT code_hash FROM account_invites LIMIT 1').first();
      return json({ provider: 'invite', ready: true });
    } catch { return json({ provider: 'invite', ready: false }); }
  }
  if (env.AUTH_PROVIDER !== 'authing') return json({ provider: 'disabled', ready: false });
  try { authingConfig(env); return json({ provider: 'authing', ready: true }); }
  catch { return json({ provider: 'authing', ready: false }); }
}
