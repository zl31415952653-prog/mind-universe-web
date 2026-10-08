import { compatibleHash } from './passwordHash.js';
export const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export const random=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
export const hash = compatibleHash;
export const cookie=(token)=>`infinity_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
// 高熵随机会话令牌用 SHA-256；与低熵密码不同，不需要昂贵的密码派生。
export async function sessionHash(token){if(!/^v2_[a-f0-9]{64}$/.test(token))return hash(token,'session');const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));return 'v2:'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
export async function userFrom(context){const token=(context.request.headers.get('Cookie')||'').match(/(?:^|;\s*)infinity_session=([^;]+)/)?.[1];if(!token||token.length>128)return null;if(context.env.AUTH_PROVIDER==='authing'&&!/^v2_[a-f0-9]{64}$/.test(token))return null;const row=await context.env.DB.prepare('SELECT u.id,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await sessionHash(token),Date.now()).first();return row||null;}
