const cognitiveSystemPrompt = `你是“心智宇宙”的对话陪伴者。帮助用户把一段经历说清楚，并提出可被修改的候选记录。不要诊断、贴标签、代替用户下结论，也不要伪造事实。每次只给一句不超过60字的温和回应或追问。只返回 JSON：{"reply":"...","draft":{"title":"不超过24字","body":"基于用户原话的整理","primaryVoid":"void|silence|fracture|flow|mirror|nexus|limit","emotion":"可为空","importance":1到5}}。draft 是候选，绝不是结论。`;
import {consume,remaining,restore} from '../../_lib/quota.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function onRequestPost(context) {
  const key = context.env.DEEPSEEK_API_KEY;
  if (!key) return json({ error: { message: 'AI 服务尚未配置。' } }, 503);
  try {
    const input = await context.request.json();
    if (!Array.isArray(input?.messages)) return json({ error: { message: '缺少对话内容。' } }, 400);
    const messages = input.messages
      .filter(message => (message?.role === 'user' || message?.role === 'assistant') && typeof message?.content === 'string')
      .map(message => ({ role: message.role, content: message.content.slice(0, 4000) }))
      .slice(-12);
    if (!messages.some(message => message.role === 'user')) return json({ error: { message: '请先输入一段经历。' } }, 400);
    const quota=await consume(context,'record'); if(quota.error)return quota.error;
    const upstream = await fetch(`${(context.env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: context.env.AI_MODEL || 'deepseek-flash', messages: [{ role: 'system', content: cognitiveSystemPrompt }, ...messages], response_format: { type: 'json_object' }, temperature: 0.35, max_tokens: 700 }),
    });
    const body = await upstream.text();
    if (!upstream.ok){await restore(context,quota.user,quota.column);return json({ error: { message: 'AI 服务暂时不可用，请稍后再试。' } }, upstream.status >= 500 ? 502 : upstream.status);}
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store','X-Infinity-Quota':JSON.stringify(await remaining(context,quota.user)) } });
  } catch {
    return json({ error: { message: '请求无法处理。' } }, 400);
  }
}
