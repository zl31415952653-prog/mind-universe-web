import test from 'node:test';
import assert from 'node:assert/strict';
import { accountActionError, checkAccount, callbackMessage, readAccountResponse } from '../src/accountState.js';

test('account actions replace browser transport errors with clear local-first guidance', () => {
  assert.match(accountActionError(new TypeError('Failed to fetch')), /无法连接云端服务/);
  assert.match(accountActionError(new DOMException('aborted', 'TimeoutError')), /请求超时/);
  assert.equal(accountActionError(new Error('账号不存在。')), '账号不存在。');
});

test('account API keeps normal JSON errors and identifies non-JSON Cloudflare failures without exposing bodies', async () => {
  await assert.rejects(readAccountResponse(Response.json({ error: '用户名或密码不正确。' }, { status: 401 })), /用户名或密码不正确/);
  await assert.rejects(
    readAccountResponse(new Response('<html>edge failure</html>', { status: 502, headers: { 'Content-Type': 'text/html' } })),
    error => /HTTP 502/.test(error.message) && /非 JSON 错误页/.test(error.message) && !/edge failure/.test(error.message)
  );
  await assert.rejects(
    readAccountResponse(new Response('error code: 1102', { status: 503, headers: { 'Content-Type': 'text/plain' } })),
    error => /错误 1102/.test(error.message) && /不是密码错误/.test(error.message)
  );
  await assert.rejects(
    readAccountResponse(Response.json({ detail: 'private diagnostic' }, { status: 503 })),
    error => /HTTP 503/.test(error.message) && !/private diagnostic/.test(error.message)
  );
});

test('invite users need no email; config alone never implies login', async () => {
  const result = await checkAccount(async path => Response.json(path.endsWith('/config') ? {provider:'invite',ready:true} : {user:{id:'synthetic',username:'learner'}}));
  assert.equal(result.session.status,'ready');
  assert.deepEqual(result.session.value,{id:'synthetic',username:'learner'});
});

test('only a valid site user confirms login; config readiness alone does not', async () => {
  const fetcher = userResponse => async path => path.endsWith('/config') ? Response.json({ provider: 'authing', ready: true }) : userResponse;
  const anonymous = await checkAccount(fetcher(Response.json({ user: null }, { status: 401 })));
  assert.equal(anonymous.config.value.ready, true);
  assert.equal(anonymous.session.status, 'anonymous');
  const confirmed = await checkAccount(fetcher(Response.json({ user: { id: 'fixture', email: 'fixture@example.test' } })));
  assert.equal(confirmed.session.status, 'ready');
  for (const response of [Response.json({ user: null }), Response.json({ user: { email: 'fixture@example.test' } }), Response.json({}, { status: 503 })]) {
    const checked = await checkAccount(fetcher(response));
    assert.equal(checked.session.status, 'error');
    assert.equal(checked.session.value, null);
  }
});

test('failed and aborted checks settle to an error, not permanent loading or false logout', async () => {
  const controller = new AbortController();
  const fetcher = async (path, options) => {
    assert.equal(options.credentials, 'include');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.signal, controller.signal);
    throw new DOMException('private network detail', 'AbortError');
  };
  controller.abort();
  const checked = await checkAccount(fetcher, controller.signal);
  assert.equal(checked.config.status, 'error');
  assert.equal(checked.session.status, 'error');
  const partial = await checkAccount(async path => {
    if (path.endsWith('/config')) throw new Error('config unavailable');
    return Response.json({ user: { id: 'fixture', email: 'fixture@example.test' } });
  });
  assert.equal(partial.session.status, 'ready');
  assert.equal(partial.config.status, 'error');
});

test('callback text preserves uncertainty and accepts only safe stage and reference values', () => {
  assert.match(callbackMessage(new URLSearchParams('account_result=success')), /尚未确认登录成功/);
  const safe = callbackMessage(new URLSearchParams('account_result=service&account_stage=verify&account_ref=abcdef123456'));
  assert.match(safe, /核验身份签名/);
  assert.match(safe, /abcdef123456/);
  assert.doesNotMatch(safe, /D1/);
  const provider = callbackMessage(new URLSearchParams('account_result=provider&account_stage=token&account_status=401&account_error=invalid_client&account_ref=123456abcdef'));
  assert.match(provider, /交换认证凭证/);
  assert.match(provider, /App Secret/);
  assert.match(provider, /invalid_client/);
  assert.match(provider, /123456abcdef/);
  const missingCookie = callbackMessage(new URLSearchParams('account_result=invalid&account_stage=flow&account_reason=cookie&account_ref=654321abcdef'));
  assert.match(missingCookie, /没有带回一次性登录校验 Cookie/);
  assert.match(missingCookie, /654321abcdef/);
  const unsafe = callbackMessage(new URLSearchParams('account_result=service&account_stage=secret-value&account_ref=private-token'));
  assert.doesNotMatch(unsafe, /secret-value|private-token/);
});
