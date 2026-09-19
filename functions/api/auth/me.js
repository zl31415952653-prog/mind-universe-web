import {json,userFrom} from '../../_lib/auth.js';
export async function onRequestGet(context){const user=await userFrom(context);if(!user)return json({user:null},401);const quota=await context.env.DB.prepare('SELECT plan,ai_record_credits,ai_reflection_credits,period_ends_at FROM entitlements WHERE user_id=?').bind(user.id).first();return json({user,quota:quota||null});}
