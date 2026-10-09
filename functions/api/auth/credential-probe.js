import { json } from '../../_lib/auth.js';
import { authingConfig } from '../../_lib/authing.js';

const allowedErrors = new Set([
  'invalid_request',
  'invalid_client',
  'invalid_grant',
  'unauthorized_client',
  'unsupported_grant_type',
  'invalid_scope'
]);

async function probe(cfg, method) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: `infinity-credential-probe-${crypto.randomUUID()}`,
    redirect_uri: cfg.redirect,
    code_verifier: 'probe-verifier-that-is-deliberately-not-a-real-login-code',
    client_id: cfg.clientId
  });
  const headers = new Headers({ 'Content-Type': 'application/x-www-form-urlencoded' });
  if (method === 'client_secret_post') body.set('client_secret', cfg.secret);
  else headers.set('Authorization', `Basic ${btoa(`${cfg.clientId}:${cfg.secret}`)}`);

  const response = await fetch(`${cfg.issuer}/token`, {
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
    headers,
    body
  });
  let error = 'unknown';
  try {
    const payload = await response.json();
    if (allowedErrors.has(payload?.error)) error = payload.error;
  } catch { /* 不返回供应商原文。 */ }
  return { status: response.status, error };
}

export async function onRequestPost(context) {
  try {
    const cfg = authingConfig(context.env);
    if (context.request.headers.get('Origin') !== cfg.origin || context.request.headers.get('X-Diagnostic-Intent') !== 'authing-client') {
      return json({ error: 'not_allowed' }, 403);
    }
    const [post, basic] = await Promise.all([
      probe(cfg, 'client_secret_post'),
      probe(cfg, 'client_secret_basic')
    ]);
    return json({ post, basic });
  } catch {
    return json({ error: 'diagnostic_unavailable' }, 503);
  }
}
