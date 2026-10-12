import test from 'node:test';
import assert from 'node:assert/strict';
import { accountFailure } from '../functions/_lib/accountFailure.js';
test('区分加密运行时限制、缺表及其他故障，不泄露原始异常', async () => {
  const cases = [
    ['PBKDF2 iteration counts above 100000 are not supported.', 'AUTH_CRYPTO_UNSUPPORTED'],
    ['D1_ERROR: no such table: users private-detail', 'AUTH_SCHEMA_UNAVAILABLE'],
    ['private-secret-and-email', 'AUTH_SERVICE_UNAVAILABLE']
  ];
  for (const [message, code] of cases) {
    const response = accountFailure(new Error(message));
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.code, code);
    assert.ok(!body.error.includes(message));
    assert.equal(response.headers.get('Set-Cookie'), null);
  }
});
