const system = `你是“心智宇宙”的回望助手。只根据用户提供的经历、关系与迁移做温和观察，不诊断、不归因、不贴人格标签、不下结论。每条观察必须引用至少一个用户给出的 evidence id；没有充分证据就不要生成。只返回 JSON：{"opening":"一句边界说明","cards":[{"title":"不超过30字","body":"不超过140字的可忽略观察","evidenceIds":["用户给出的id"]}]}。最多3张卡。`;
import {consume,remaining,restore} from '../../_lib/quota.js';
const respond = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function onRequestPost(context) {
  if (!context.env.DEEPSEEK_API_KEY) return respond({ error: { message: 'AI 服务尚未配置。' } }, 503);
  try {
    const input = await context.request.json();
    const evidence = Array.isArray(input?.evidence) ? input.evidence.filter(item => typeof item?.id === 'string' && typeof item?.title === 'string').slice(0, 24).map(item => ({ id: item.id, title: item.title.slice(0, 80), body: typeof item.body === 'string' ? item.body.slice(0, 600) : '', void: item.void || '', emotion: item.emotion || '' })) : [];
    if (evidence.length < 2) return respond({ error: { message: '至少需要两条经历才能进行回望。' } }, 400);
    const quota=await consume(context,'reflection'); if(quota.error)return quota.error;
    const upstream = await fetch(`${(context.env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${context.env.DEEPSEEK_API_KEY}` }, body: JSON.stringify({ model: context.env.AI_MODEL || 'deepseek-flash', messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify({ evidence, relations: Array.isArray(input.relations) ? input.relations.slice(0, 40) : [], transitions: Array.isArray(input.transitions) ? input.transitions.slice(0, 30) : [] }) }], response_format: { type: 'json_object' }, temperature: 0.25, max_tokens: 900 }) });
    if (!upstream.ok){await restore(context,quota.user,quota.column);return respond({ error: { message: '回望服务暂时不可用。' } }, upstream.status >= 500 ? 502 : upstream.status);}
    const data = await upstream.json(); const content = data?.choices?.[0]?.message?.content;
    if (!content) return respond({ error: { message: '没有可用的回望内容。' } }, 502);
    const result = JSON.parse(content); const known = new Set(evidence.map(item => item.id));
    const cards = Array.isArray(result.cards) ? result.cards.slice(0, 3).map(card => ({ title: String(card?.title || '').slice(0, 60), body: String(card?.body || '').slice(0, 360), evidenceIds: Array.isArray(card?.evidenceIds) ? card.evidenceIds.filter(id => typeof id === 'string' && known.has(id)).slice(0, 4) : [] })).filter(card => card.title && card.body && card.evidenceIds.length) : [];
    return new Response(JSON.stringify({ opening: typeof result.opening === 'string' ? result.opening.slice(0, 160) : '以下是基于已选经历的观察，你可以完全不同意。', cards }),{headers:{'Content-Type':'application/json','X-Infinity-Quota':JSON.stringify(await remaining(context,quota.user))}});
  } catch { return respond({ error: { message: '无法处理这次回望请求。' } }, 400); }
}
