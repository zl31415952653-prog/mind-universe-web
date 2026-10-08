import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { authingConfig, startAuth, callbackAuth, sha256, pkceChallenge, flowCookie } from '../functions/_lib/authing.js';
import { sessionHash, userFrom } from '../functions/_lib/auth.js';
import { onRequestPost as legacyLogin } from '../functions/api/auth/login.js';
import { onRequestPost as legacyRegister } from '../functions/api/auth/register.js';
import { onRequestPost as logout } from '../functions/api/auth/logout.js';
import { onRequestGet as configResponse } from '../functions/api/auth/config.js';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequestGet as readAtlas, onRequestPut as writeAtlas } from '../functions/api/atlas.js';

const issuer = 'https://test-fixture.authing.cn/oidc';
const origin = 'https://fixture.example';
const state = 'a'.repeat(64), browser = 'b'.repeat(64);
const envFor = DB => ({ AUTH_PROVIDER: 'authing', AUTHING_ISSUER: issuer, AUTH_APP_ORIGIN: origin, AUTHING_CLIENT_ID: 'synthetic-client', AUTHING_CLIENT_SECRET: 'synthetic-secret', DB });
function fakeDb(options = {}) {
  const writes = [];
  let used = false;
  return { writes,
    prepare(sql) { return { bind(...args) { return {
      async first() {
        if (sql.startsWith('DELETE FROM auth_login_flows')) {
          if (used || options.expired || args[0] !== await sha256(state) || args[1] !== await sha256(browser)) return null;
          used = true; return { verifier: 'v'.repeat(64), nonce: 'synthetic-nonce' };
        }
        if (sql.includes('FROM auth_identities')) return options.existingIdentity ? { user_id: 'original-user-id' } : null;
        if (sql.includes('FROM users WHERE email')) return options.emailConflict ? { id: 'old-user-id' } : null;
        return null;
      }, async run() { writes.push({ sql, args }); return { success: true }; }, sql, args
    }; } }; },
    async batch(items) { for (const item of items) await item.run(); }
  };
}
function context(DB, query = `state=${state}&code=synthetic-code`, cookie = browser) {
  return { env: envFor(DB), request: new Request(`${origin}/api/auth/callback?${query}`, { headers: { Cookie: `__Host-infinity_oidc=${cookie}` } }) };
}
test('configuration fails closed; public endpoint contains no secrets', async () => {
  const env = envFor(fakeDb());
  assert.equal(authingConfig(env).redirect, `${origin}/api/auth/callback`);
  for (const change of [{AUTHING_ISSUER:'https://evil.example/oidc'}, {AUTH_APP_ORIGIN:'http://fixture.example'}, {AUTHING_CLIENT_SECRET:''}, {DB:null}]) assert.throws(() => authingConfig({...env,...change}));
  const body = await (await configResponse({env})).text();
  assert.ok(!body.includes('synthetic-secret'));
  assert.match(body, /"ready":true/);
});
test('PKCE RFC vector; flow cookie secure and session hashes deterministic', async () => {
  assert.equal(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  assert.match(flowCookie(browser), /HttpOnly; Secure; SameSite=None; Max-Age=600/);
  assert.equal(await sessionHash(`v2_${state}`), `v2:${await sha256(`v2_${state}`)}`);
});
test('start creates short-lived flow and redirects only to configured provider', async () => {
  const db = fakeDb();
  const response = await startAuth({env:envFor(db),request:new Request(`${origin}/api/auth/start`)});
  assert.equal(response.status,303);
  const url = new URL(response.headers.get('Location'));
  assert.equal(url.origin,'https://test-fixture.authing.cn');
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.equal(url.searchParams.get('redirect_uri'),`${origin}/api/auth/callback`);
  assert.equal(url.searchParams.get('prompt'),'login');
  assert.ok(!url.href.includes('synthetic-secret'));
  assert.equal(db.writes.length,2);
  const other = await startAuth({env:envFor(db),request:new Request('https://other.example/api/auth/start')});
  assert.equal(other.status,400);
});
test('callback rejects absent, cross-browser, expired state before contacting provider', async () => {
  for (const ctx of [context(fakeDb(),'code=synthetic-code'),context(fakeDb(),undefined,'c'.repeat(64)),context(fakeDb({expired:true}))]) {
    const response = await callbackAuth(ctx);
    assert.match(response.headers.get('Location'),/account_result=invalid/);
    assert.ok(!response.headers.get('Set-Cookie').includes('infinity_session='));
  }
});
test('signed token callback: success, replay, nonce, signature, audience, verification, old email conflict', async () => {
  const {publicKey,privateKey} = await generateKeyPair('RS256');
  const {privateKey: wrongKey} = await generateKeyPair('RS256');
  const jwk = {...await exportJWK(publicKey), kid:'fixture-key', alg:'RS256', use:'sig'};
  const oldFetch = globalThis.fetch;
  let claims = {}, tokenStatus = 200, profileStatus = 200, badSignature = false;
  let tokenCalls = 0;
  globalThis.fetch = async (input, init) => {
    // 对齐 workerd：error 模式在请求发送前就会失败，不能只依赖 Node 行为。
    if (init?.redirect === 'error') throw new TypeError('Invalid redirect value');
    const url = String(input);
    if (url.endsWith('/jwks.json')) return Response.json({keys:[jwk]});
    if (url.endsWith('/token')) {
      tokenCalls++;
      assert.equal(init.redirect,'manual');
      assert.equal(init.headers.Authorization,undefined);
      assert.equal(init.body.get('code_verifier'),'v'.repeat(64));
      assert.equal(init.body.get('client_id'),'synthetic-client');
      assert.equal(init.body.get('client_secret'),'synthetic-secret');
      if (tokenStatus !== 200) return Response.json({error:'private provider message'}, {status:tokenStatus});
      const jwt = await new SignJWT({nonce:'synthetic-nonce',email:'fixture@example.test',email_verified:true,...claims})
        .setProtectedHeader({alg:'RS256',kid:'fixture-key'}).setIssuer(issuer).setAudience(claims.aud || 'synthetic-client').setSubject('fixture-subject').setIssuedAt().setExpirationTime('5m').sign(badSignature ? wrongKey : privateKey);
      return Response.json({id_token:jwt,access_token:'synthetic-token'});
    }
    if (url.endsWith('/me')) {
      assert.equal(init.redirect,'manual');
      return Response.json({sub:'fixture-subject',email:'fixture@example.test',email_verified:false}, {status:profileStatus});
    }
    throw new Error('Unexpected URL');
  };
  try {
    const db = fakeDb();
    const success = await callbackAuth(context(db));
    assert.match(success.headers.get('Location'),/account_result=success/);
    assert.match(success.headers.get('Set-Cookie'),/infinity_session=v2_/);
    assert.equal(db.writes.filter(w=>w.sql.startsWith('INSERT INTO')).length,4);
    const callsBefore = tokenCalls;
    assert.match((await callbackAuth(context(db))).headers.get('Location'),/account_result=invalid/);
    assert.equal(tokenCalls,callsBefore);
    claims = {nonce:'wrong-nonce'};
    assert.match((await callbackAuth(context(fakeDb()))).headers.get('Location'),/account_result=service/);
    claims = {aud:'wrong-client'};
    assert.match((await callbackAuth(context(fakeDb()))).headers.get('Location'),/account_result=service/);
    claims = {}; badSignature = true;
    assert.match((await callbackAuth(context(fakeDb()))).headers.get('Location'),/account_result=service/);
    badSignature = false;
    claims = {email_verified:false};
    assert.match((await callbackAuth(context(fakeDb()))).headers.get('Location'),/account_result=verify_email/);
    profileStatus = 302;
    const profileRedirectDb = fakeDb();
    assert.match((await callbackAuth(context(profileRedirectDb))).headers.get('Location'),/account_result=provider/);
    assert.equal(profileRedirectDb.writes.length,0);
    profileStatus = 200;
    claims = {};
    const collision = fakeDb({emailConflict:true});
    assert.match((await callbackAuth(context(collision))).headers.get('Location'),/account_result=existing_account/);
    assert.equal(collision.writes.length,0);
    const existing = fakeDb({existingIdentity:true});
    assert.match((await callbackAuth(context(existing))).headers.get('Location'),/account_result=success/);
    assert.equal(existing.writes.length,1);
    assert.equal(existing.writes[0].args[1],'original-user-id');
    // 实际执行三份 SQL；数据库为内存测试库，不碰用户 D1/本地笔记。
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys=ON');
    for (const file of ['0001_cloud_sync.sql','0002_entitlements.sql','0003_authing.sql']) sqlite.exec(readFileSync(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
    const dbReal = {
      prepare(sql) { return { bind(...args) { return { async first() { return sqlite.prepare(sql).get(...args) || null; }, async run() { return sqlite.prepare(sql).run(...args); } }; } }; },
      async batch(items) { sqlite.exec('BEGIN'); try { for (const item of items) await item.run(); sqlite.exec('COMMIT'); } catch(error) { sqlite.exec('ROLLBACK'); throw error; } }
    };
    try {
      await dbReal.prepare('INSERT INTO auth_login_flows(state_hash,browser_hash,verifier,nonce,expires_at) VALUES(?,?,?,?,?)').bind(await sha256(state),await sha256(browser),'v'.repeat(64),'synthetic-nonce',Date.now()+600000).run();
      const actual = await callbackAuth(context(dbReal));
      assert.match(actual.headers.get('Location'),/account_result=success/);
      const session = actual.headers.get('Set-Cookie').match(/infinity_session=([^;]+)/)[1];
      const requestFor = (method, body, cookie=session) => ({env:envFor(dbReal),request:new Request(`${origin}/api/atlas`,{method,headers:{Cookie:`infinity_session=${cookie}`,Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})});
      assert.equal((await readAtlas(requestFor('GET'))).status,200);
      assert.equal((await writeAtlas(requestFor('PUT',{entries:[{title:'synthetic snapshot'}]}))).status,200);
      assert.equal((await (await readAtlas(requestFor('GET'))).json()).snapshot.payload.entries[0].title,'synthetic snapshot');
      assert.match((await callbackAuth(context(dbReal))).headers.get('Location'),/account_result=invalid/);
      const otherSession=`v2_${'c'.repeat(64)}`;
      await dbReal.prepare('INSERT INTO users(id,email,password_hash,password_salt,created_at) VALUES(?,?,?,?,?)').bind('other','other@example.test','external:authing','synthetic',Date.now()).run();
      await dbReal.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(await sessionHash(otherSession),'other',Date.now()+600000,Date.now()).run();
      assert.equal((await (await readAtlas(requestFor('GET',null,otherSession))).json()).snapshot,null);
      assert.equal((await logout(requestFor('POST'))).status,200);
      assert.equal((await readAtlas(requestFor('GET'))).status,401);
    } finally { sqlite.close(); }
    tokenStatus = 302;
    const redirectDb = fakeDb();
    const providerRedirect = await callbackAuth(context(redirectDb));
    const providerUrl = new URL(providerRedirect.headers.get('Location'));
    assert.equal(providerUrl.searchParams.get('account_result'),'provider');
    assert.equal(providerUrl.searchParams.get('account_stage'),'token');
    assert.match(providerUrl.searchParams.get('account_ref'),/^[a-f0-9]{12}$/);
    assert.equal(redirectDb.writes.length,0);
    assert.ok(!providerRedirect.headers.get('Set-Cookie').includes('infinity_session='));
    tokenStatus = 401;
    const unavailable = await callbackAuth(context(fakeDb()));
    assert.match(unavailable.headers.get('Location'),/account_result=provider/);
    assert.ok(!(await unavailable.text()).includes('private provider message'));
  } finally { globalThis.fetch = oldFetch; }
});
test('Authing mode blocks old password endpoints and old sessions without running PBKDF2', async () => {
  const ctx = {env:envFor(fakeDb()),request:new Request(`${origin}/api/auth/login`,{method:'POST'})};
  assert.equal((await legacyLogin(ctx)).status,409);
  assert.equal((await legacyRegister(ctx)).status,409);
  assert.equal(await userFrom({...ctx,request:new Request(origin,{headers:{Cookie:'infinity_session=legacy-token'}})}),null);
  assert.equal((await logout({...ctx,request:new Request(origin,{method:'POST',headers:{Origin:'https://other.example'}})})).status,403);
});

test('callback failures expose only a safe stage/category/reference, never credentials or raw errors', async () => {
  const oldFetch = globalThis.fetch, oldError = console.error;
  const logs = [];
  console.error = value => logs.push(value);
  try {
    const brokenDb = { prepare() { throw new Error('sensitive sql, email and token'); } };
    const databaseFailure = await callbackAuth(context(brokenDb));
    const dbUrl = new URL(databaseFailure.headers.get('Location'));
    assert.equal(dbUrl.searchParams.get('account_stage'), 'flow');
    assert.match(dbUrl.searchParams.get('account_ref'), /^[a-f0-9]{12}$/);
    globalThis.fetch = async () => { throw new DOMException('sensitive provider response and secret', 'TimeoutError'); };
    const tokenFailure = await callbackAuth(context(fakeDb()));
    assert.equal(new URL(tokenFailure.headers.get('Location')).searchParams.get('account_stage'), 'token');
    assert.ok(!tokenFailure.headers.get('Set-Cookie').includes('infinity_session='));
    assert.equal(JSON.parse(logs[0]).category, 'DATABASE_OPERATION_FAILED');
    assert.equal(JSON.parse(logs[1]).category, 'NETWORK_TIMEOUT');
    assert.doesNotMatch(logs.join(''), /sensitive|synthetic-code|synthetic-secret|email and token/);
    assert.doesNotMatch(tokenFailure.headers.get('Location'), /sensitive|synthetic-code|synthetic-secret/);
  } finally { globalThis.fetch = oldFetch; console.error = oldError; }
});
