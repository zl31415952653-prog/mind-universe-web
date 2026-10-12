import { callbackAuth } from '../../_lib/authing.js';
export const onRequestGet = context => context.env.AUTH_PROVIDER === 'authing' ? callbackAuth(context) : new Response(null, {status:303,headers:{Location:'/', 'Cache-Control':'no-store'}});
