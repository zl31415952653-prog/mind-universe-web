const cognitiveSystemPrompt = `你是“心智宇宙”的对话陪伴者。帮助用户把一段经历说清楚，并提出可被修改的候选记录。不要诊断、贴标签、代替用户下结论，也不要伪造事实。每次只给一句不超过60字的温和回应或追问。只返回 JSON：{"reply":"...","draft":{"title":"不超过24字","body":"基于用户原话的整理","primaryVoid":"void|silence|fracture|flow|mirror|nexus|limit","emotion":"可为空","importance":1到5}}。draft 是候选，绝不是结论。`;
import {consume,remaining,restore} from '../../_lib/quota.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function onRequestPost(context) {
  const key = context.env.DEEPSEEK_API_KEY;
  if (!key) return json({ error: { message: 'AI 服务尚未配置。' } }, 503);
  let reservation = null;
  let refundAttempted = false;
  let refundSucceeded = false;
  let upstreamSucceeded = false;
  const refund = async () => {
    if (!reservation || refundAttempted) return;
    refundAttempted = true;
    await restore(context, reservation.user, reservation.column);
    refundSucceeded = true;
  };
  try {
    const input = await context.request.json();
    if (!Array.isArray(input?.messages)) return json({ error: { message: '缺少对话内容。' } }, 400);
    const messages = input.messages
      .filter(message => (message?.role === 'user' || message?.role === 'assistant') && typeof message?.content === 'string')
      .map(message => ({ role: message.role, content: message.content.slice(0, 4000) }))
      .slice(-12);
    if (!messages.some(message => message.role === 'user')) return json({ error: { message: '请先输入一段经历。' } }, 400);
    const quota=await consume(context,'record'); if(quota.error)return quota.error;
    reservation = quota;
    const upstream = await fetch(`${(context.env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: context.env.AI_MODEL || 'deepseek-flash', messages: [{ role: 'system', content: cognitiveSystemPrompt }, ...messages], response_format: { type: 'json_object' }, temperature: 0.35, max_tokens: 700 }),
      signal: AbortSignal.timeout(20000),
    });
    const body = await upstream.text();
    if (!upstream.ok){await refund();return json({ error: { message: 'AI 服务暂时不可用，已退还本次额度，请稍后再试。' } }, upstream.status >= 500 ? 502 : upstream.status);}
    upstreamSucceeded = true;
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store','X-Infinity-Quota':JSON.stringify(await remaining(context,quota.user)) } });
  } catch {
    if (reservation && !upstreamSucceeded) {
      if (!refundAttempted) { try { await refund(); } catch { /* Report the unconfirmed refund below. */ } }
      if (!refundSucceeded) return json({ error: { message: 'AI 请求中断，额度回滚暂未确认。请稍后检查额度或联系维护者。' } }, 503);
    }
    return json({ error: { message: reservation ? refundSucceeded ? 'AI 请求连接中断，已退还本次额度，请稍后重试。' : 'AI 请求失败，额度状态暂无法确认。' : '请求无法处理。' } }, reservation ? 502 : 400);
  }
}
