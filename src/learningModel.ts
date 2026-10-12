import type { LearningMaterial, LearningSuggestion, VoidId } from './domain';

const ids: VoidId[] = ['void', 'silence', 'fracture', 'flow', 'mirror', 'nexus', 'limit'];
const types = ['concept', 'claim', 'method', 'example', 'evidence', 'limit', 'question'];
const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const list = (value: unknown, max: number) => Array.isArray(value) ? value.map(item => text(item, 80)).filter(Boolean).slice(0, max) : [];

/** 只兼容完整 JSON 或单一代码围栏，不修补截断、注释或附加说明。 */
export function parseLearningJson(content: unknown): unknown {
  if (typeof content !== 'string' || !content.trim()) throw new Error('模型返回空内容，未保存候选。请稍后手动重试。');
  const clean = content.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1');
  try { return JSON.parse(clean); }
  catch { throw new Error('模型返回的学习结构不是完整 JSON，未保存候选。请缩小材料范围后手动重试。'); }
}

/** 必须在本机正文中复核引用；不让模型生成的定位或七空标签直接成为事实。 */
export function normalizeLearningUnits(raw: unknown, material: LearningMaterial): LearningSuggestion[] {
  const units = (raw as { units?: unknown })?.units;
  if (!Array.isArray(units) || units.length > 12) throw new Error('AI 未返回有效的知识单元列表，请缩小材料范围后重试。');
  const result: LearningSuggestion[] = [];
  for (const item of units) {
    if (!item || typeof item !== 'object') throw new Error('AI 候选结构不完整，请重试。');
    const value = item as Record<string, unknown>;
    const excerpt = typeof value.excerpt === 'string' ? value.excerpt : '';
    const providedStart = value.start;
    const matches = excerpt ? [...material.content.matchAll(new RegExp(excerpt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))].map(match => match.index!) : [];
    const start = typeof providedStart === 'number' && Number.isInteger(providedStart) && providedStart >= 0 && material.content.slice(providedStart, providedStart + excerpt.length) === excerpt
      ? providedStart : matches.length === 1 ? matches[0] : -1;
    if (excerpt.trim().length < 4 || start < 0) throw new Error('AI 原文引用无法准确定位，未保存任何候选。请缩小材料范围后重试。');
    const title = text(value.title, 60), summary = text(value.summary, 500);
    if (!title || !summary || !types.includes(String(value.unitType))) throw new Error('AI 知识单元缺少标题、摘要或有效类型。');
    const assessments = Array.isArray(value.voidAssessments) ? value.voidAssessments : [];
    if (assessments.length !== 7 || new Set(assessments.map(a => a?.voidType)).size !== 7) throw new Error('AI 没有完成七空逐项检查，请重试。');
    const voidAssessments: NonNullable<LearningSuggestion['voidAssessments']> = ids.map(voidType => {
      const assessment = assessments.find(a => a?.voidType === voidType);
      if (!assessment || !['candidate', 'no-evidence', 'needs-input'].includes(assessment.status)) throw new Error('AI 七空状态无法识别。');
      const cue = text(assessment.cue, 500);
      if (assessment.status === 'candidate' && (!cue || !excerpt.includes(cue))) throw new Error('AI 七空判断没有匹配的原文依据，未保存候选。');
      if (assessment.status === 'needs-input' && !cue) throw new Error('AI 未说明需要用户补充的问题。');
      return { voidType, status: assessment.status, ...(assessment.status !== 'no-evidence' ? { cue } : {}) };
    });
    const candidates = new Set(voidAssessments.filter(a => a.status === 'candidate').map(a => a.voidType));
    const primaryVoid = candidates.has(value.primaryVoid as VoidId) ? value.primaryVoid as VoidId : null;
    const secondaryVoids = [...new Set(list(value.secondaryVoids, 2))].filter((id): id is VoidId => candidates.has(id as VoidId) && id !== primaryVoid);
    const markers = [...material.content.slice(0, start + 1).matchAll(/【第 (\d+) 页】/g)];
    const page = markers.at(-1)?.[1];
    result.push({ id: crypto.randomUUID(), materialId: material.id, title, summary, keywords: list(value.keywords, 6), prerequisites: list(value.prerequisites, 3), primaryVoid, secondaryVoids,
      rationale: text(value.rationale, 240) || '模型提出的候选，仍需核对原文。', evidence: { excerpt, start, ...(page ? { page: Number(page) } : {}) },
      unitType: value.unitType as LearningSuggestion['unitType'], voidAssessments, reviewState: 'pending', analysisMode: 'ai', nextAction: text(value.nextAction, 240) || undefined });
  }
  if (!result.length) throw new Error('AI 未找到有充分原文依据的知识单元，材料未导入。可以改用本地模式保留片段。');
  return result;
}
