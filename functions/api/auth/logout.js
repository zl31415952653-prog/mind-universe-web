import {sessionHash,json} from '../../_lib/auth.js';
export async function onRequestPost(context){
  if(context.request.headers.get('Origin')!==new URL(context.request.url).origin)return json({error:'请求来源不匹配。'},403);
  const token=(context.request.headers.get('Cookie')||'').match(/(?:^|;\s*)infinity_session=([^;]+)/)?.[1];
  if(token && /^v2_[a-f0-9]{64}$/.test(token)) {
    const table=context.env.AUTH_PROVIDER==='invite'?'invite_sessions':'sessions';
    await context.env.DB.prepare(`DELETE FROM ${table} WHERE token_hash=?`).bind(await sessionHash(token)).run();
  }
  const response=json({ok:true});
  response.headers.set('Set-Cookie','infinity_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return response;
}
