import { defaultPrivacy, type DiscoverySuggestion, type Entry, type LearningMaterial, type LearningSuggestion, type Relation, type Transition, type VoidId } from './domain';
import { learningPrompt } from '../functions/_lib/learningPrompt.js';
import { normalizeLearningUnits, parseLearningJson } from './learningModel';
import { retrieveLearningReferences } from './learningReferences';
import { learningModelOptions } from '../functions/_lib/learningModelOptions.js';

export type DialogueMessage = { role: 'user' | 'assistant'; content: string };
export type AiConfig = { mode: 'local' | 'managed' | 'personal'; endpoint: string; model: string; apiKey: string };
export type DialogueProposal = { reply: string; draft: Omit<Entry, 'id' | 'createdAt'> };
export type MirrorCard = { title: string; body: string; evidenceIds: string[] };
export type MirrorResponse = { opening: string; cards: MirrorCard[] };

const voidIds: VoidId[] = ['void', 'silence', 'fracture', 'flow', 'mirror', 'nexus', 'limit'];
const systemPrompt = `你是“心智宇宙”的对话陪伴者。你的职责是帮助用户把一段经历先说清楚，再提出一份可被用户修改和确认的记录草案。
边界：不诊断、不贴人格标签、不宣称知道用户内心、不下结论；语气温和、具体、克制。不要伪造事实。每次只提出一个简短的追问或回应。
请只返回 JSON：{"reply":"不超过60字的回应或追问","draft":{"title":"不超过24字","body":"基于用户原话的简洁整理","primaryVoid":"void|silence|fracture|flow|mirror|nexus|limit","emotion":"可为空","importance":1到5}}。draft 是候选，绝不是结论。`;
const mirrorPrompt = `你是“心智宇宙”的回望助手。只根据用户提供的经历、关系与迁移做温和观察，不诊断、不归因、不贴人格标签、不下结论。每条观察必须引用至少一条 evidence id；没有充分证据就不要生成。只返回 JSON：{"opening":"一句边界说明","cards":[{"title":"不超过30字","body":"不超过140字的可忽略观察","evidenceIds":["用户给出的id"]}]}。最多3张卡。`;
const discoveryPrompt = `你是“心智宇宙”的关系发现助手。只根据用户提供的记录，提出最多5条“可能值得用户检查”的关系候选。不得诊断、心理归因或代替用户下结论；不得使用没有给出的内容。每条候选必须引用两个不同的真实记录 id，并说明两段原文中可核查的共同线索。关系 type 只能是 resonance（呼应）、tension（张力/矛盾）、thread（值得追踪的线索）。只返回 JSON：{"suggestions":[{"from":"真实记录id","to":"真实记录id","type":"resonance|tension|thread","reason":"不超过120字的可核查理由","sharedTerms":["最多3个来自材料的词或短语"]}]}。没有充分依据则返回空数组。`;

function signal(emotion = ''): Entry['signal'] { return { emotion, colorName: '靛青', colorHex: '#5968d9', texture: '' }; }
function normalize(raw: unknown, fallback: string): DialogueProposal {
  const value = raw as { reply?: unknown; draft?: Record<string, unknown> };
  const draft = value?.draft ?? {};
  const primaryVoid = typeof draft.primaryVoid === 'string' && voidIds.includes(draft.primaryVoid as VoidId) ? draft.primaryVoid as VoidId : 'void';
  return {
    reply: typeof value?.reply === 'string' && value.reply.trim() ? value.reply.trim() : '我听见了。哪一个部分，是你最想先留下来的？',
    draft: {
      title: typeof draft.title === 'string' && draft.title.trim() ? draft.title.trim().slice(0, 24) : fallback.slice(0, 24),
      kind: 'daily',
      body: typeof draft.body === 'string' ? draft.body.trim() : fallback,
      primaryVoid,
      secondaryVoids: [],
      signal: signal(typeof draft.emotion === 'string' ? draft.emotion.trim() : ''),
      importance: typeof draft.importance === 'number' ? Math.max(1, Math.min(5, Math.round(draft.importance))) : 3,
      privacy: defaultPrivacy(),
    },
  };
}

export function localProposal(messages: DialogueMessage[]): DialogueProposal {
  const words = messages.filter(message => message.role === 'user').map(message => message.content.trim()).filter(Boolean);
  const last = words.at(-1) ?? '';
  const joined = words.join('\n');
  return normalize({ reply: words.length < 2 ? '我在。你愿意再说一点：这件事让你最在意的是什么？' : '我先把你说的整理成一份草案。你可以随时改掉它，不必急着定义。', draft: { title: last.replace(/[。！？!?].*$/,'').slice(0,24) || '一段尚待理解的经历', body: joined, primaryVoid: 'void', importance: 3 } }, last);
}

export async function askModel(config: AiConfig, messages: DialogueMessage[]): Promise<DialogueProposal> {
  const last = messages.filter(message => message.role === 'user').at(-1)?.content ?? '';
  const response = await fetch(config.endpoint.trim().replace(/\/$/, '') + '/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey.trim()}` },
    body: JSON.stringify({ model: config.model.trim(), messages: [{ role: 'system', content: systemPrompt }, ...messages], response_format: { type: 'json_object' }, temperature: 0.35, max_tokens: 700 }),
  });
  if (!response.ok) throw new Error(`模型服务返回 ${response.status}`);
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('模型没有返回可用内容');
  try { return normalize(JSON.parse(content), last); } catch { throw new Error('模型返回的结构无法识别'); }
}

export async function askMirror(config: AiConfig, entries: Entry[], relations: Relation[], transitions: Transition[]): Promise<MirrorResponse> {
  const evidence = entries.slice(0, 24).map(entry => ({ id: entry.id, title: entry.title, body: entry.body.slice(0, 600), void: entry.primaryVoid, emotion: entry.signal.emotion || '' }));
  const personal = config.mode === 'personal';
  const response = await fetch(config.endpoint.trim().replace(/\/$/, '') + (personal ? '/chat/completions' : '/reflection'), {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(config.mode === 'personal' ? { Authorization: `Bearer ${config.apiKey.trim()}` } : {}) },
    body: JSON.stringify(personal ? { model: config.model.trim(), messages: [{ role: 'system', content: mirrorPrompt }, { role: 'user', content: JSON.stringify({ evidence, relations: relations.slice(0, 40), transitions: transitions.slice(0, 30) }) }], response_format: { type: 'json_object' }, temperature: 0.25, max_tokens: 900 } : { evidence, relations: relations.slice(0, 40), transitions: transitions.slice(0, 30) }),
  });
  if (!response.ok) throw new Error(`回望服务返回 ${response.status}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> } & { opening?: unknown; cards?: unknown };
  const raw = personal ? JSON.parse(payload.choices?.[0]?.message?.content ?? '{}') as { opening?: unknown; cards?: unknown } : payload;
  const known = new Set(entries.map(entry => entry.id));
  const cards = Array.isArray(raw.cards) ? raw.cards.slice(0, 3).map(card => {
    const item = card as { title?: unknown; body?: unknown; evidenceIds?: unknown };
    return { title: typeof item.title === 'string' ? item.title.slice(0, 60) : '一条等待你确认的观察', body: typeof item.body === 'string' ? item.body.slice(0, 360) : '', evidenceIds: Array.isArray(item.evidenceIds) ? item.evidenceIds.filter((id): id is string => typeof id === 'string' && known.has(id)).slice(0, 4) : [] };
  }).filter(card => card.body && card.evidenceIds.length) : [];
  if (!cards.length) throw new Error('回望没有形成可追溯的观察');
  return { opening: typeof raw.opening === 'string' ? raw.opening.slice(0, 160) : '以下只是基于已选记录的观察，你可以完全不同意。', cards };
}

function stringList(value: unknown, limit: number) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim().slice(0, 80)).slice(0, limit) : []; }
export async function analyseLearningWithModel(config: AiConfig, material: LearningMaterial): Promise<LearningSuggestion[]> {
  if (config.mode === 'local') throw new Error('本地模式请使用本地分析。');
  if (material.content.length > 12000) throw new Error('AI 每次最多处理 12000 字符，请缩小页段或删选正文；不会自动截断。');
  const personal = config.mode === 'personal';
  const url = config.endpoint.trim().replace(/\/$/, '') + (personal ? '/chat/completions' : '/learning/analyse');
  const references = retrieveLearningReferences(material.content, material.referencePack, 6);
  const input = { title: material.title, source: material.source ?? '', content: material.content, ...(references.length ? { references } : {}) };
  const payload = personal
    ? { model: config.model.trim(), messages: [{ role: 'system', content: learningPrompt }, { role: 'user', content: JSON.stringify(input) }], response_format: { type: 'json_object' }, temperature: 0.2, max_tokens: 7000, ...learningModelOptions(config.endpoint) }
    : input;
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(personal ? { Authorization: `Bearer ${config.apiKey.trim()}` } : {}) }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`资料分析服务返回 ${response.status}`);
  const body = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string } }> };
  if (body.choices?.[0]?.finish_reason === 'length') throw new Error('AI 输出达到长度限制，未保存候选。请缩小材料范围。');
  let raw: unknown = body;
  if (body.choices) {
    raw = parseLearningJson(body.choices[0]?.message?.content);
  }
  return normalizeLearningUnits(raw, material);
}

export async function discoverWithModel(config: AiConfig, entries: Entry[]): Promise<DiscoverySuggestion[]> {
  if (config.mode === 'local') throw new Error('本地模式请使用本地扫描。');
  const evidence=entries.slice(0,36).map(entry=>({id:entry.id,title:entry.title,body:entry.body.slice(0,900),kind:entry.kind,void:entry.primaryVoid}));
  const personal=config.mode==='personal'; const url=config.endpoint.trim().replace(/\/$/,'')+(personal?'/chat/completions':'/discovery');
  const payload=personal?{model:config.model.trim(),messages:[{role:'system',content:discoveryPrompt},{role:'user',content:JSON.stringify({entries:evidence})}],response_format:{type:'json_object'},temperature:0.2,max_tokens:1200}:{entries:evidence};
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(personal?{Authorization:`Bearer ${config.apiKey.trim()}`}:{})},body:JSON.stringify(payload)});
  if(!response.ok)throw new Error(`关系发现服务返回 ${response.status}`); const body=await response.json() as {choices?:Array<{message?:{content?:string}}>} & {suggestions?:unknown};
  const raw=personal?JSON.parse(body.choices?.[0]?.message?.content??'{}') as {suggestions?:unknown}:body; const known=new Set(entries.map(entry=>entry.id));
  if(!Array.isArray(raw.suggestions))return [];
  return raw.suggestions.slice(0,5).flatMap(item=>{const value=item as Record<string,unknown>;const from=typeof value.from==='string'?value.from:'';const to=typeof value.to==='string'?value.to:'';const type=value.type==='resonance'||value.type==='tension'||value.type==='thread'?value.type:null;if(!from||!to||from===to||!known.has(from)||!known.has(to)||!type)return [];return [{id:crypto.randomUUID(),from,to,type,reason:typeof value.reason==='string'?value.reason.slice(0,240):'模型提出的候选，请查看原始记录后决定。',sharedTerms:stringList(value.sharedTerms,3),status:'pending' as const,createdAt:Date.now()}];});
}
