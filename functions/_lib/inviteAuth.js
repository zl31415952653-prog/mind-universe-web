import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { json, random, sessionHash, cookie, userFrom } from './auth.js';
const encoder = new TextEncoder();
const hex = value => Array.from(new Uint8Array(value), b => b.toString(16).padStart(2, '0')).join('');
export async function digest(value) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
export async function passwordDigest(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  let value;
  try { value = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 600000, hash: 'SHA-256' }, key, 256); }
  catch (error) {
    if (!/iteration.*(?:100000|100,000|not supported|limit)|(?:100000|100,000).*iteration/i.test(String(error?.message || ''))) throw error;
    value = await pbkdf2Async(sha256, encoder.encode(password), encoder.encode(salt), { c: 600000, dkLen: 32, asyncTick: 10 });
  }
  return 'pbkdf2-sha256-600000:' + hex(value);
}
function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
class Rejected extends Error { constructor(message, status) { super(message); this.status = status; } }
const reject = (message, status = 400) => { throw new Rejected(message, status); };
async function limit(db, key, maximum) {
  const now = Date.now();
  const row = await db.prepare(`INSERT INTO account_attempts(key,count,expires_at) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,
    expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count`)
    .bind(await digest(key), now + 900000, now, now).first();
  if (!row || row.count > maximum) reject('尝试次数过多，请等待 15 分钟后重试。', 429);
}
async function readBody(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) reject('请求格式不正确。', 415);
  const reader = request.body?.getReader(); if (!reader) reject('缺少请求内容。');
  let size = 0; const chunks = [];
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
    if (size > 4096) { await reader.cancel(); reject('请求内容过长。', 413); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { const body = JSON.parse(new TextDecoder().decode(bytes)); if (!body || typeof body !== 'object' || Array.isArray(body)) reject('请求格式不正确。'); return body; }
  catch { reject('请求格式不正确。'); }
}
export async function inviteAction(context, action) {
  let stage = 'preflight';
  try {
    const { request, env } = context; const db = env.DB;
    if (env.AUTH_PROVIDER !== 'invite') reject('邀请制账号尚未启用；仍可使用本地记录。', 409);
    if (!db) reject('内测账户服务尚未配置。', 503);
    if (request.headers.get('Origin') !== new URL(request.url).origin) reject('请从本站发起操作。', 403);
    stage = 'rate_limit';
    await limit(db, 'global', 300);
    await limit(db, 'ip:' + (request.headers.get('CF-Connecting-IP') || 'local'), 30);
    stage = 'input';
    const body = await readBody(request);
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    if (action !== 'recovery-code' && !/^[a-z0-9_]{3,32}$/.test(username)) reject('用户名需为 3–32 位英文字母、数字或下划线。');
    await limit(db, 'account:' + (action === 'recovery-code' ? 'rotate' : username), 8);
    if (typeof body.password !== 'string' || body.password.length < 15 || body.password.length > 128) reject('密码需为 15–128 个字符，可使用长句；不要使用已泄露或重复使用的密码。');
    if (['register','recover'].includes(action) && (/^(.)\1+$/.test(body.password) || ['passwordpassword','password123456789','123456789012345','12345678901234567890'].includes(body.password.toLowerCase()))) reject('这个密码过于常见，请换成独有的长密码。');
    stage = 'database';
    await db.prepare('DELETE FROM account_attempts WHERE expires_at<?').bind(Date.now()).run();
    await db.prepare('DELETE FROM invite_sessions WHERE expires_at<?').bind(Date.now()).run();
    if (action === 'register') {
      if (!/^[a-f0-9]{64}$/.test(body.invitation || '')) reject('邀请凭证无效、已使用或已过期。', 403);
      const inviteHash = await digest(body.invitation);
      const invite = await db.prepare('SELECT code_hash FROM account_invites WHERE code_hash=? AND used_at IS NULL AND expires_at>?').bind(inviteHash, Date.now()).first();
      if (!invite) reject('邀请凭证无效、已使用或已过期。', 403);
      const id = crypto.randomUUID(), salt = random(), recoveryCode = random(), now = Date.now();
      stage = 'password';
      const encoded = await passwordDigest(body.password, salt);
      stage = 'create_account';
      try {
        await db.batch([
          db.prepare('INSERT INTO users(id,email,password_hash,password_salt,created_at) VALUES(?,?,?,?,?)').bind(id, id + '@invite.invalid', 'disabled:invite', '', now),
          db.prepare('INSERT INTO invite_accounts(user_id,username,password_hash,salt,recovery_hash,invite_hash) VALUES(?,?,?,?,?,?)').bind(id, username, encoded, salt, await digest(recoveryCode), inviteHash),
          db.prepare('INSERT INTO entitlements(user_id,plan,ai_record_credits,ai_reflection_credits,period_started_at,period_ends_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id, 'beta', 3, 1, now, now + 2592000000, now)
        ]);
      } catch (error) {
        if (/UNIQUE|invite_unavailable/i.test(String(error?.message))) reject('未能创建账号：用户名不可用或邀请已被使用，请核对后重试。', 409);
        throw error;
      }
      return json({ recoveryCode, message: '账号已创建。请单独保存恢复码，然后登录。' }, 201);
    }
    let account;
    if (action === 'recovery-code') {
      const user = await userFrom(context); if (!user) reject('请先登录。', 401);
      account = await db.prepare('SELECT * FROM invite_accounts WHERE user_id=?').bind(user.id).first();
    } else account = await db.prepare('SELECT * FROM invite_accounts WHERE username=?').bind(username).first();
    if (action === 'recover') {
      if (!/^[a-f0-9]{64}$/.test(body.recoveryCode || '')) reject('用户名或恢复码不正确。', 401);
      const oldRecovery = await digest(body.recoveryCode);
      if (!account || !equal(account.recovery_hash, oldRecovery)) reject('用户名或恢复码不正确。', 401);
      const salt = random(), recoveryCode = random();
      stage = 'password';
      const newHash = await passwordDigest(body.password, salt);
      stage = 'recover_account';
      const row = await db.prepare('UPDATE invite_accounts SET password_hash=?,salt=?,recovery_hash=? WHERE user_id=? AND recovery_hash=? RETURNING user_id')
        .bind(newHash, salt, await digest(recoveryCode), account.user_id, oldRecovery).first();
      if (!row) reject('恢复码已失效，请勿重复提交。', 409);
      return json({ recoveryCode, message: '密码已重置，所有旧登录已失效。请保存新的恢复码，再登录。' });
    }
    stage = 'password';
    const encoded = await passwordDigest(body.password, account?.salt || 'unknown-account-dummy-salt');
    if (!account || !equal(encoded, account.password_hash)) reject('用户名或密码不正确。', 401);
    if (action === 'recovery-code') {
      stage = 'rotate_recovery';
      const recoveryCode = random();
      const row = await db.prepare('UPDATE invite_accounts SET recovery_hash=? WHERE user_id=? AND password_hash=? AND recovery_hash=? RETURNING user_id')
        .bind(await digest(recoveryCode), account.user_id, encoded, account.recovery_hash).first();
      if (!row) reject('账号状态已变化，请重新登录。', 409);
      return json({ recoveryCode, message: '新恢复码已生成，旧码立即失效。请单独保存。' });
    }
    stage = 'session';
    const token = 'v2_' + random();
    const row = await db.prepare(`INSERT INTO invite_sessions(token_hash,user_id,expires_at)
      SELECT ?,user_id,? FROM invite_accounts WHERE user_id=? AND password_hash=? RETURNING user_id`)
      .bind(await sessionHash(token), Date.now() + 604800000, account.user_id, encoded).first();
    if (!row) reject('账号状态已变化，请重新登录。', 401);
    const response = json({ user: { id: account.user_id, username: account.username } });
    response.headers.set('Set-Cookie', cookie(token).replace('2592000', '604800'));
    return response;
  } catch (error) {
    if (error instanceof Rejected) { const response = json({ error: error.message }, error.status); if (error.status === 429) response.headers.set('Retry-After', '900'); return response; }
    const ref = crypto.randomUUID().replaceAll('-', '').slice(0,12);
    const category = /no such table|no such column/i.test(String(error?.message)) ? 'SCHEMA_INCOMPLETE' : stage === 'password' ? 'PASSWORD_RUNTIME_FAILED' : 'ACCOUNT_OPERATION_FAILED';
    console.error(JSON.stringify({event:'invite_auth_failed',action,stage,category,ref}));
    return json({ error: `内测账户服务暂不可用。本地记录不受影响；请维护者核对迁移和运行资源。排查编号：${ref}。` }, 503);
  }
}
