import test from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { compatibleHash } from '../functions/_lib/passwordHash.js';

const capped = async () => { throw new DOMException('Pbkdf2 failed: iteration counts above 100000 are not supported (requested 210000).', 'NotSupportedError'); };
test('模拟 Cloudflare 上限仍保留旧密码和会话散列，兼容 UTF-8', async () => {
  for (const [password, salt] of [['test-password-only', 'random-test-salt'], ['本地测试密码🔒', 'salt'], ['test-session-token', 'session']]) {
    const expected = pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('hex');
    assert.equal(await compatibleHash(password, salt, capped), expected);
    assert.equal(await compatibleHash(password, salt), expected);
  }
});
test('不掩盖其他加密故障，不回退到弱散列', async () => {
  await assert.rejects(compatibleHash('test', 'salt', async () => { throw new Error('unrelated crypto failure'); }), /unrelated crypto failure/);
});
