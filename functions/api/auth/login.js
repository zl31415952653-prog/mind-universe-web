import { inviteAction } from '../../_lib/inviteAuth.js';
export const onRequestPost = context => inviteAction(context, 'login');
