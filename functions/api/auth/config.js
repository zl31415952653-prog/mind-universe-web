import { json } from '../../_lib/auth.js';
import { authingConfig } from '../../_lib/authing.js';
export function onRequestGet({ env }) {
  if (env.AUTH_PROVIDER !== 'authing') return json({ provider: 'legacy', ready: Boolean(env.DB) });
  try { authingConfig(env); return json({ provider: 'authing', ready: true }); }
  catch { return json({ provider: 'authing', ready: false }); }
}
