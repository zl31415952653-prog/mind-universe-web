import {consume, remaining, restore} from '../../_lib/quota.js';
import { learningPrompt as prompt } from '../../_lib/learningPrompt.js';
import { sanitizeLearningReferences } from '../../_lib/learningReferences.js';
import { learningModelOptions } from '../../_lib/learningModelOptions.js';

function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }); }
export async function onRequestPost(context) {
  if (!context.env.DEEPSEEK_API_KEY) return json({ error: { message: 'AI 服务尚未配置。' } }, 503);
  let quota;
  try {
    const input = await context.request.json();
    if (typeof input?.content !== 'string' || !input.content.trim()) return json({ error: { message: '请提供资料正文。' } }, 400);
    if (input.content.length > 12000) return json({ error: { message: '正文超过12000字符，请缩小范围，不会自动截断。' } }, 400);
    const references = sanitizeLearningReferences(input.references);
    const endpoint = (context.env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
    quota = await consume(context, 'record'); if (quota.error) return quota.error;
    const response = await fetch(`${endpoint}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${context.env.DEEPSEEK_API_KEY}` }, body: JSON.stringify({ model: context.env.AI_MODEL || 'deepseek-flash', messages: [{ role: 'system', content: prompt }, { role: 'user', content: JSON.stringify({ title: String(input.title || '').slice(0, 120), source: String(input.source || '').slice(0, 500), content: input.content, ...(references.length ? {references} : {}) }) }], response_format: { type: 'json_object' }, temperature: 0.2, max_tokens: 7000, ...learningModelOptions(endpoint) }) });
    const body = await response.text();
    if (!response.ok) { await restore(context, quota.user, quota.column); return json({ error: { message: 'AI 服务暂时不可用。' } }, response.status >= 500 ? 502 : response.status); }
    const payload = JSON.parse(body);
    const choice = payload.choices?.[0];
    const content = typeof choice?.message?.content === 'string' ? choice.message.content.trim() : '';
    const result = JSON.parse(content.replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1') || '{}');
    if (choice?.finish_reason === 'length' || !Array.isArray(result.units) || !result.units.length || result.units.length > 12) {
      await restore(context, quota.user, quota.column);
      return json({ error: { message: 'AI 未返回完整知识单元，请缩小正文范围后重试。' } }, 502);
    }
    return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Infinity-Quota': JSON.stringify(await remaining(context, quota.user)) } });
  } catch {
    if (quota && !quota.error) { await restore(context, quota.user, quota.column); return json({ error: { message: 'AI 响应无法识别，请重试。' } }, 502); }
    return json({ error: { message: '请求无法处理。' } }, 400);
  }
}
