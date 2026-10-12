// Local Cloudflare runtime compatibility probe; no remote account or data used.
// Usage: node scripts/test-invite-workerd.mjs <path-to-miniflare-package>
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { pbkdf2Sync } from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {Miniflare}=require(process.argv[2] || 'miniflare');
const bundle=await build({stdin:{contents:`import {passwordDigest} from './functions/_lib/inviteAuth.js';
export default {async fetch(){const start=performance.now();const value=await passwordDigest('synthetic-runtime-password','synthetic-salt');return Response.json({value,elapsedMs:performance.now()-start});}}`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-18'});
try {
  const response=await mf.dispatchFetch('http://localhost/');
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.value,'pbkdf2-sha256-600000:'+pbkdf2Sync('synthetic-runtime-password','synthetic-salt',600000,32,'sha256').toString('hex'));
  console.log(JSON.stringify({compatible:true,localElapsedMs:result.elapsedMs,note:'Local elapsed time is NOT production CPU time; validate production plan budget before activation.'}));
}finally{await mf.dispose();}
