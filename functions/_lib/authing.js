import { createRemoteJWKSet, jwtVerify } from 'jose';
import { cookie, json, random, sessionHash } from './auth.js';

const keys = new Map();
export const flowCookieName = '__Host-infinity_oidc';
export function authingConfig(env) {
  if (env.AUTH_PROVIDER !== 'authing') throw new Error('AUTH_NOT_CONFIGURED');
  const issuer = new URL(env.AUTHING_ISSUER);
  const origin = new URL(env.AUTH_APP_ORIGIN);
  if (issuer.protocol !== 'https:' || !issuer.hostname.endsWith('.authing.cn') || issuer.pathname !== '/oidc' || issuer.search || issuer.hash || issuer.port || issuer.username || issuer.password) throw new Error('AUTH_NOT_CONFIGURED');
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw new Error('AUTH_NOT_CONFIGURED');
  if (!env.DB || !env.AUTHING_CLIENT_ID || !env.AUTHING_CLIENT_SECRET) throw new Error('AUTH_NOT_CONFIGURED');
  return { issuer: issuer.href, origin: origin.origin, clientId: env.AUTHING_CLIENT_ID, secret: env.AUTHING_CLIENT_SECRET, redirect: `${origin.origin}/api/auth/callback` };
}
export function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  for (const value of cookies) headers.append('Set-Cookie', value);
  return new Response(null, { status: 303, headers });
}
export const flowCookie = (value, age = 600) => `${flowCookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export async function sha256(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
function base64url(bytes) { return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
export async function pkceChallenge(value) {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}
export function verifiedClaims(payload, nonce) {
  if (payload.nonce !== nonce || typeof payload.sub !== 'string' || !payload.sub || typeof payload.exp !== 'number' || typeof payload.iat !== 'number') throw new Error('AUTH_IDENTITY_INVALID');
  return payload;
}
export async function startAuth(context) {
  try {
    const cfg = authingConfig(context.env);
    if (new URL(context.request.url).origin !== cfg.origin) return json({ error: '请从配置的网站地址发起登录。' }, 400);
    const state = random(), browser = random(), verifier = random(), nonce = random(), now = Date.now();
    await context.env.DB.prepare('DELETE FROM auth_login_flows WHERE expires_at<=?').bind(now).run();
    await context.env.DB.prepare('INSERT INTO auth_login_flows(state_hash,browser_hash,verifier,nonce,expires_at) VALUES(?,?,?,?,?)')
      .bind(await sha256(state), await sha256(browser), verifier, nonce, now + 600000).run();
    const url = new URL(`${cfg.issuer}/auth`);
    url.search = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: cfg.redirect, response_type: 'code', scope: 'openid email', state, nonce, code_challenge: await pkceChallenge(verifier), code_challenge_method: 'S256', prompt: 'login' }).toString();
    return redirect(url.href, [flowCookie(browser)]);
  } catch {
    return json({ error: 'Authing 登录尚未配置完成，请核对生产变量和 D1 第三份迁移。本地资料仍可使用。' }, 503);
  }
}
export async function callbackAuth(context) {
  let cfg;
  try { cfg = authingConfig(context.env); } catch { return json({ error: '账户认证配置尚未完成。' }, 503); }
  const fail = code => redirect(`${cfg.origin}/?account_result=${code}`, [flowCookie('', 0)]);
  let stage = 'flow';
  const providerFail = status => {
    const ref = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
    console.error(JSON.stringify({ event: 'authing_provider_rejected', stage, status, ref }));
    return redirect(`${cfg.origin}/?account_result=provider&account_stage=${stage}&account_ref=${ref}`, [flowCookie('', 0)]);
  };
  try {
    if (new URL(context.request.url).origin !== cfg.origin) return fail('invalid');
    const url = new URL(context.request.url);
    const state = url.searchParams.get('state');
    const browser = (context.request.headers.get('Cookie') || '').match(/(?:^|;\s*)__Host-infinity_oidc=([a-f0-9]{64})(?:;|$)/)?.[1];
    if (!state || !/^[a-f0-9]{64}$/.test(state) || !browser) return fail('invalid');
    // 单次消费且绑定发起登录的浏览器；重放、跨浏览器、过期回调均拒绝。
    const flow = await context.env.DB.prepare('DELETE FROM auth_login_flows WHERE state_hash=? AND browser_hash=? AND expires_at>? RETURNING verifier,nonce')
      .bind(await sha256(state), await sha256(browser), Date.now()).first();
    if (!flow) return fail('invalid');
    if (url.searchParams.has('error')) return fail('cancelled');
    const code = url.searchParams.get('code');
    if (!code || code.length > 4096) return fail('invalid');
    stage = 'token';
    const tokenResponse = await fetch(`${cfg.issuer}/token`, {
      // workerd 不支持 redirect:error；manual 不跟随跳转，非 2xx 在下方拒绝。
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000),
      // Authing 控制台配置为 client_secret_post；客户端凭证必须与授权码一起放入表单。
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: cfg.redirect, code_verifier: flow.verifier, client_id: cfg.clientId, client_secret: cfg.secret })
    });
    if (!tokenResponse.ok) return providerFail(tokenResponse.status);
    const token = await tokenResponse.json();
    if (typeof token.id_token !== 'string' || token.id_token.length > 32768) return fail('invalid');
    stage = 'verify';
    if (!keys.has(cfg.issuer)) keys.set(cfg.issuer, createRemoteJWKSet(new URL(`${cfg.issuer}/.well-known/jwks.json`), { timeoutDuration: 10000 }));
    const { payload } = await jwtVerify(token.id_token, keys.get(cfg.issuer), { issuer: cfg.issuer, audience: cfg.clientId, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub', 'nonce'], maxTokenAge: '10m', clockTolerance: 5 });
    verifiedClaims(payload, flow.nonce);
    if (payload.azp !== undefined && payload.azp !== cfg.clientId) return fail('invalid');
    if (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== cfg.clientId) return fail('invalid');
    stage = 'profile';
    let profile = payload;
    if (typeof profile.email !== 'string' || profile.email_verified !== true) {
      if (typeof token.access_token !== 'string') return fail('verify_email');
      const response = await fetch(`${cfg.issuer}/me`, { headers: { Authorization: `Bearer ${token.access_token}` }, redirect: 'manual', signal: AbortSignal.timeout(10000) });
      if (!response.ok) return providerFail(response.status);
      profile = await response.json();
      if (profile.sub !== payload.sub) return fail('invalid');
    }
    if (profile.email_verified !== true || typeof profile.email !== 'string' || !/^\S+@\S+\.\S+$/.test(profile.email) || profile.email.length > 254) return fail('verify_email');
    const db = context.env.DB;
    stage = 'identity';
    let user = await db.prepare('SELECT user_id FROM auth_identities WHERE issuer=? AND subject=?').bind(cfg.issuer, payload.sub).first();
    const now = Date.now();
    if (!user) {
      const email = profile.email.trim().toLowerCase();
      // 不以邮箱认领旧账户/快照；冲突必须走独立的迁移审核。
      if (await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first()) return fail('existing_account');
      const id = crypto.randomUUID();
      stage = 'account';
      await db.batch([
        db.prepare('INSERT INTO users(id,email,password_hash,password_salt,created_at) VALUES(?,?,?,?,?)').bind(id, email, 'external:authing', random(), now),
        db.prepare('INSERT INTO auth_identities(issuer,subject,user_id,created_at) VALUES(?,?,?,?)').bind(cfg.issuer, payload.sub, id, now),
        db.prepare('INSERT INTO entitlements(user_id,plan,ai_record_credits,ai_reflection_credits,period_started_at,period_ends_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id, 'free', 3, 1, now, now + 2592000000, now)
      ]);
      user = { user_id: id };
    }
    stage = 'session';
    const session = `v2_${random()}`;
    await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(await sessionHash(session), user.user_id, now + 2592000000, now).run();
    return redirect(`${cfg.origin}/?account_result=success`, [flowCookie('', 0), cookie(session)]);
  } catch (error) {
    // 仅输出白名单类别和随机排查编号；绝不输出错误原文或请求数据。
    const ref = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
    const allowed = new Set(['ERR_JWT_CLAIM_VALIDATION_FAILED', 'ERR_JWT_EXPIRED', 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED', 'ERR_JOSE_ALG_NOT_ALLOWED', 'ERR_JWKS_NO_MATCHING_KEY', 'ERR_JWKS_TIMEOUT', 'ERR_JWKS_INVALID']);
    const category = allowed.has(error?.code) ? error.code : error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'NETWORK_TIMEOUT' : error?.message === 'AUTH_IDENTITY_INVALID' ? 'IDENTITY_CLAIMS_INVALID' : ['flow', 'identity', 'account', 'session'].includes(stage) ? 'DATABASE_OPERATION_FAILED' : 'AUTH_OPERATION_FAILED';
    console.error(JSON.stringify({ event: 'authing_callback_failed', stage, category, ref }));
    return redirect(`${cfg.origin}/?account_result=service&account_stage=${stage}&account_ref=${ref}`, [flowCookie('', 0)]);
  }
}
