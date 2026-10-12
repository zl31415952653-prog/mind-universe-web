import { startAuth } from '../../_lib/authing.js';
import { json } from '../../_lib/auth.js';
export const onRequestGet = context => context.env.AUTH_PROVIDER === 'authing' ? startAuth(context) : json({ error: '此第三方入口已关闭，请在本站使用邀请制账号登录。' }, 410);
