const encoder = new TextEncoder();
export const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const hex=buffer=>Array.from(new Uint8Array(buffer)).map(x=>x.toString(16).padStart(2,'0')).join('');
export const random=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
export async function hash(text,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(text),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:210000,hash:'SHA-256'},key,256));}
export const cookie=(token)=>`infinity_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
export async function userFrom(context){const token=(context.request.headers.get('Cookie')||'').match(/(?:^|;\s*)infinity_session=([^;]+)/)?.[1];if(!token)return null;const row=await context.env.DB.prepare('SELECT u.id,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await hash(token,'session'),Date.now()).first();return row||null;}
