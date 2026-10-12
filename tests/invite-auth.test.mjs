import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { pbkdf2Sync } from 'node:crypto';
import { inviteAction, digest, passwordDigest } from '../functions/_lib/inviteAuth.js';
import { userFrom } from '../functions/_lib/auth.js';
import { onRequestPost as logout } from '../functions/api/auth/logout.js';
import { onRequestGet as config } from '../functions/api/auth/config.js';
import { onRequestGet as getAtlas, onRequestPut as putAtlas } from '../functions/api/atlas.js';
import { consume } from '../functions/_lib/quota.js';
const origin = 'https://test.example';
const password = 'synthetic-test-password-not-real';
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  for (const name of ['0001_cloud_sync.sql','0002_entitlements.sql','0003_authing.sql','0004_invite_accounts.sql']) sqlite.exec(readFileSync(new URL('../migrations/'+name, import.meta.url), 'utf8'));
  const db = { prepare(sql) {
    const make = args => ({ sql, args, bind: (...args) => make(args),
      first: async () => sqlite.prepare(sql).get(...args) || null,
      run: async () => ({ meta: sqlite.prepare(sql).run(...args) }) }); return make([]);
  }, async batch(statements) { sqlite.exec('BEGIN'); try { const results=[]; for(const s of statements) results.push(await s.run()); sqlite.exec('COMMIT'); return results; } catch(error) { sqlite.exec('ROLLBACK'); throw error; } } };
  const env = { AUTH_PROVIDER: 'invite', DB: db };
  const context = (body, cookie = '', extras = {}) => ({ env, request: new Request(origin + '/api/auth/login', { method:'POST', headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,...extras}, body:JSON.stringify(body) }) });
  const act = (action, body, cookie = '') => inviteAction(context(body, cookie), action);
  const clear = () => sqlite.exec('DELETE FROM account_attempts');
  const invite = async (code = 'a'.repeat(64), expires = Date.now()+60000) => { sqlite.prepare('INSERT INTO account_invites(code_hash,expires_at) VALUES(?,?)').run(await digest(code),expires); return code; };
  const register = async (username='learner',code='a'.repeat(64)) => { await invite(code); return act('register',{username,password,invitation:code}); };
  const login = async (username='learner',pw=password) => { const response=await act('login',{username,password:pw}); return {response,cookie:response.headers.get('Set-Cookie')?.split(';')[0]||''}; };
  return {sqlite,db,env,context,act,clear,invite,register,login};
}
test('new hash matches PBKDF2 SHA256 600000 and is salted', async()=>{
  assert.equal(await passwordDigest(password,'fixture-salt'), 'pbkdf2-sha256-600000:'+pbkdf2Sync(password,'fixture-salt',600000,32,'sha256').toString('hex'));
});
test('native iteration-limit fallback keeps exactly the same new hash; other failures are not hidden',async()=>{
  const original=crypto.subtle.deriveBits;
  try {
    crypto.subtle.deriveBits=async()=>{throw new Error('PBKDF2 iteration counts above 100000 are not supported');};
    assert.equal(await passwordDigest(password,'fixture-salt'),'pbkdf2-sha256-600000:'+pbkdf2Sync(password,'fixture-salt',600000,32,'sha256').toString('hex'));
    crypto.subtle.deriveBits=async()=>{throw new Error('unrelated crypto failure');};
    await assert.rejects(passwordDigest(password,'fixture-salt'),/unrelated crypto failure/);
  }finally{crypto.subtle.deriveBits=original;}
});
test('invite account creation is atomic, private, single-use and cannot register without invitation',async()=>{
  const f=fixture();
  assert.equal((await f.act('register',{username:'learner',password})).status,403);
  const created=await f.register(); assert.equal(created.status,201);
  const body=await created.json(); assert.match(body.recoveryCode,/^[a-f0-9]{64}$/);
  assert.equal(created.headers.get('Set-Cookie'),null);
  const row=f.sqlite.prepare('SELECT * FROM invite_accounts').get();
  assert.notEqual(row.recovery_hash,body.recoveryCode); assert.notEqual(row.password_hash,password);
  assert.equal((await f.act('register',{username:'second',password,invitation:'a'.repeat(64)})).status,403);
  await f.invite('b'.repeat(64));
  assert.equal((await f.act('register',{username:'learner',password,invitation:'b'.repeat(64)})).status,409);
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM users').get().n,1);
  assert.equal(f.sqlite.prepare('SELECT used_at FROM account_invites WHERE code_hash=?').get(await digest('b'.repeat(64))).used_at,null);
  assert.equal(f.sqlite.prepare('SELECT ai_record_credits FROM entitlements').get().ai_record_credits,3);
  f.sqlite.close();
});
test('a downstream database failure rolls back user, invite consumption and credentials',async()=>{
  const f=fixture(); await f.invite();
  f.sqlite.exec("CREATE TRIGGER fail_quota BEFORE INSERT ON entitlements BEGIN SELECT RAISE(ABORT,'fixture_failure'); END;");
  const response=await f.act('register',{username:'learner',password,invitation:'a'.repeat(64)});
  assert.equal(response.status,503); assert.equal(response.headers.get('Set-Cookie'),null);
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM users').get().n,0);
  assert.equal(f.sqlite.prepare('SELECT used_at FROM account_invites').get().used_at,null);
  assert.doesNotMatch(await response.text(),/fixture_failure/); f.sqlite.close();
});
test('login, recovery replay prevention, old-session revocation, rotation and logout',async()=>{
  const f=fixture(); const created=await (await f.register()).json();
  const signed=await f.login('LEARNER'); assert.equal(signed.response.status,200);
  assert.match(signed.response.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Lax/);
  assert.equal((await userFrom(f.context({},signed.cookie))).username,'learner');
  assert.equal((await f.login('learner','incorrect-password-long')).response.status,401);
  const newPassword='new-synthetic-password-for-tests';
  const recovered=await f.act('recover',{username:'learner',password:newPassword,recoveryCode:created.recoveryCode}); assert.equal(recovered.status,200);
  const newCode=(await recovered.json()).recoveryCode;
  assert.equal(await userFrom(f.context({},signed.cookie)),null);
  assert.equal((await f.act('recover',{username:'learner',password,recoveryCode:created.recoveryCode})).status,401);
  f.clear(); assert.equal((await f.login()).response.status,401);
  const fresh=await f.login('learner',newPassword); assert.equal(fresh.response.status,200);
  const rotated=await f.act('recovery-code',{password:newPassword},fresh.cookie); assert.equal(rotated.status,200);
  assert.notEqual((await rotated.json()).recoveryCode,newCode);
  assert.equal((await f.act('recover',{username:'learner',password,recoveryCode:newCode})).status,401);
  assert.equal((await logout(f.context({},fresh.cookie))).status,200);
  assert.equal(await userFrom(f.context({},fresh.cookie)),null); f.sqlite.close();
});
test('origin, disabled modes, missing schema, expiry, size and rate limits fail closed',async()=>{
  const f=fixture();
  assert.equal((await inviteAction(f.context({},'',{Origin:'https://other.example'}),'login')).status,403);
  for(const mode of [undefined,'legacy','authing']) assert.equal((await inviteAction({...f.context({}),env:{...f.env,AUTH_PROVIDER:mode}},'register')).status,409);
  await f.invite('c'.repeat(64),Date.now()-1000);
  assert.equal((await f.act('register',{username:'learner',password,invitation:'c'.repeat(64)})).status,403);
  assert.equal((await f.act('login',{huge:'x'.repeat(5000)})).status,413);
  for(let i=0;i<8;i++) await f.act('login',{username:'blocked',password:'short'});
  assert.equal((await f.act('login',{username:'blocked',password})).status,429);
  assert.equal((await (await config({env:f.env})).json()).ready,true);
  f.sqlite.exec('DROP TABLE account_attempts');
  assert.equal((await (await config({env:f.env})).json()).ready,false);
  assert.equal((await f.login()).response.status,503);f.sqlite.close();
});
test('snapshots stay isolated, login does not upload, AI has independent finite quota',async()=>{
  const f=fixture();await f.register();await f.register('second','b'.repeat(64));
  const first=await f.login(),second=await f.login('second');
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM atlas_snapshots').get().n,0);
  const data={entries:[],knowledge:[],relations:[],transitions:[],fixture:'first-private'};
  assert.equal((await putAtlas(f.context(data,first.cookie))).status,200);
  assert.equal((await (await getAtlas(f.context({},second.cookie))).json()).snapshot,null);
  assert.equal((await (await getAtlas(f.context({},first.cookie))).json()).snapshot.payload.fixture,'first-private');
  assert.equal((await putAtlas(f.context(data,first.cookie,{Origin:'https://other.example'}))).status,403);
  assert.equal((await consume(f.context({}),'record')).error.status,401);
  for(let i=0;i<3;i++) assert.ok((await consume(f.context({},first.cookie),'record')).user);
  assert.equal((await consume(f.context({},first.cookie),'record')).error.status,429);
  assert.ok((await consume(f.context({},second.cookie),'record')).user);
  f.sqlite.close();
});
test('concurrent recovery consumes the code only once and a consumed invitation is blocked by the database',async()=>{
  const f=fixture(); const created=await(await f.register()).json();
  const results=await Promise.all([f.act('recover',{username:'learner',password:'synthetic-new-password-one',recoveryCode:created.recoveryCode}),f.act('recover',{username:'learner',password:'synthetic-new-password-two',recoveryCode:created.recoveryCode})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.throws(()=>f.sqlite.prepare('INSERT INTO invite_accounts(user_id,username,password_hash,salt,recovery_hash,invite_hash) VALUES(?,?,?,?,?,?)').run('invalid','duplicate','hash','salt','code',f.sqlite.prepare('SELECT invite_hash FROM invite_accounts').get().invite_hash),/invite_unavailable/);
  f.sqlite.close();
});
test('existing Authing and legacy rows are preserved and cannot be used as invite sessions',async()=>{
  const f=fixture();
  f.sqlite.prepare('INSERT INTO users(id,email,password_hash,password_salt,created_at) VALUES(?,?,?,?,?)').run('old-user','historical@example.test','external:authing','',1);
  f.sqlite.prepare('INSERT INTO atlas_snapshots(user_id,payload,updated_at) VALUES(?,?,?)').run('old-user','{"historical":true}',1);
  await f.register('historical');
  assert.equal(f.sqlite.prepare('SELECT payload FROM atlas_snapshots WHERE user_id=?').get('old-user').payload,'{"historical":true}');
  const signed=await f.login('historical');
  assert.equal((await(await getAtlas(f.context({},signed.cookie))).json()).snapshot,null);
  f.sqlite.close();
});
