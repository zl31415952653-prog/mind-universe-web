import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestPost } from '../functions/api/auth/register.js';
test('old public email registration stays closed even when provider is unset',async()=>{
  const response=await onRequestPost({request:new Request('https://test.example/api/auth/register',{method:'POST',body:JSON.stringify({email:'fixture@example.test',password:'synthetic-test-password'})}),env:{}});
  assert.equal(response.status,409);assert.equal(response.headers.get('Set-Cookie'),null);
});
// Atomic account/quota creation and rollback tests now use real SQLite in invite-auth.test.mjs.
