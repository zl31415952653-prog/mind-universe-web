import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/auth/credential-probe.js';

const origin = 'https://fixture.example';
const env = {
  AUTH_PROVIDER: 'authing',
  AUTHING_ISSUER: 'https://fixture.authing.cn/oidc',
  AUTH_APP_ORIGIN: origin,
  AUTHING_CLIENT_ID: 'fixture-client',
  AUTHING_CLIENT_SECRET: 'fixture-secret',
  DB: {}
};

test('credential probe compares post and basic without exposing credentials', async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    const basic = options.headers.get('Authorization');
    return Response.json({ error: basic ? 'invalid_client' : 'invalid_grant', error_description: 'private provider text' }, { status: 400 });
  };
  try {
    const response = await onRequestPost({
      env,
      request: new Request(`${origin}/api/auth/credential-probe`, {
        method: 'POST',
        headers: { Origin: origin, 'X-Diagnostic-Intent': 'authing-client' }
      })
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      post: { status: 400, error: 'invalid_grant' },
      basic: { status: 400, error: 'invalid_client' }
    });
    assert.equal(requests.length, 2);
    assert.equal(requests[0].options.body.get('client_secret'), 'fixture-secret');
    assert.match(requests[1].options.headers.get('Authorization'), /^Basic /);
    assert.ok(!requests[1].options.body.has('client_secret'));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('credential probe rejects requests outside the configured site', async () => {
  const response = await onRequestPost({
    env,
    request: new Request(`${origin}/api/auth/credential-probe`, {
      method: 'POST',
      headers: { Origin: 'https://other.example', 'X-Diagnostic-Intent': 'authing-client' }
    })
  });
  assert.equal(response.status, 403);
});
