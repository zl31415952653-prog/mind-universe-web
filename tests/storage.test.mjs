import test from 'node:test';
import assert from 'node:assert/strict';
import { writeWithLegacyMirror } from '../src/storageMirror.js';

test('legacy localStorage quota failures do not block IndexedDB primary writes', async () => {
  const originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = { setItem() { throw new DOMException('quota exceeded', 'QuotaExceededError'); } };
  const writes = [];
  try {
    await writeWithLegacyMirror('atlas', '{}', async () => writes.push('atlas'));
    await writeWithLegacyMirror('preferences', '[]', async () => writes.push('preferences'));
    assert.equal(writes.length, 2);
    assert.deepEqual(writes, ['atlas', 'preferences']);
  } finally {
    if (originalLocalStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = originalLocalStorage;
  }
});
