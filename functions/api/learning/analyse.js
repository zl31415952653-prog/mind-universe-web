import {consume, remaining, restore} from '../../_lib/quota.js';

const prompt = `你是“心智宇宙”的学习资料整理助手。只依据用户提供的一份材料生成可修改的候选学习卡片；不编造事实，不把七空当作客观判定。七空候选：void=未知/入门问题，silence=稳定定义或已理解知识，fracture=冲突争议或易混淆处，flow=过程与正在形成，mirror=学习者反思，nexus=关系与跨域连接，limit=边界与开放问题。只返回 JSON：{"title":"不超过40字","summary":"不超过180字","keywords":["最多6个"],"prerequisites":["最多3项"],"primaryVoid":"七空 id","secondaryVoids":["最多2项"],"rationale":"不超过100字，说明候选依据"}。全部字段都是候选，等待用户确认。`;
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }); }
export async function onRequestPost(context) {
  if (!context.env.DEEPSEEK_API_KEY) return json({ error: { message: 'AI 服务尚未配置。' } }, 503);
  try {
    const input = await context.request.json();
    if (typeof input?.content !== 'string' || !input.content.trim()) return json({ error: { message: '请提供资料正文。' } }, 400);
    const quota = await consume(context, 'record'); if (quota.error) return quota.error;
    const response = await fetch(`${(context.env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${context.env.DEEPSEEK_API_KEY}` }, body: JSON.stringify({ model: context.env.AI_MODEL || 'deepseek-flash', messages: [{ role: 'system', content: prompt }, { role: 'user', content: JSON.stringify({ title: String(input.title || '').slice(0, 120), source: String(input.source || '').slice(0, 500), content: input.content.slice(0, 12000) }) }], response_format: { type: 'json_object' }, temperature: 0.2, max_tokens: 1100 }) });
    const body = await response.text();
    if (!response.ok) { await restore(context, quota.user, quota.column); return json({ error: { message: 'AI 服务暂时不可用。' } }, response.status >= 500 ? 502 : response.status); }
    return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Infinity-Quota': JSON.stringify(await remaining(context, quota.user)) } });
  } catch { return json({ error: { message: '请求无法处理。' } }, 400); }
}
