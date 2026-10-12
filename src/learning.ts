import type { LearningMaterial, LearningProject, LearningSuggestion, LearningTask, VoidId } from './domain';

export const MAX_LOCAL_UNITS = 30;

const stopWords = new Set([
  '一个', '一些', '这个', '那个', '我们', '你们', '他们', '自己',
  '以及', '因为', '所以', '但是', '如果', '可以', '需要', '通过', '进行',
  '对于', '关于', '已经', '正在', '没有', '不能', '什么', '如何', '为什么',
  '随后', '获得', '写下', '适合', '复杂', '内容', '系统', '用户'
]);
const voidSignals: Array<{ id: VoidId; terms: string[]; rationale: string }> = [
  { id: 'void', terms: ['未知', '入门', '概念', '是什么', '问题', '基础', 'unknown', 'unfamiliar', 'question'], rationale: '材料中包含陌生概念、问题或入门线索，适合作为待探索内容。' },
  { id: 'silence', terms: ['定义', '原理', '总结', '结论', '掌握', '方法', 'definition', 'principle', 'recall'], rationale: '材料在陈述相对稳定的定义、原理或可归档的方法。' },
  { id: 'fracture', terms: ['但是', '矛盾', '争议', '区别', '误解', '错误', '反而', '比较', 'however', 'contrast', 'conflict', 'misconception'], rationale: '材料出现了对比、争议或容易混淆之处，值得单独辨析。' },
  { id: 'flow', terms: ['过程', '步骤', '发展', '变化', '正在', '阶段', '随后', '先', 'planning', 'plan', 'process', 'steps', 'practice'], rationale: '材料强调过程、步骤或尚在发展的状态。' },
  { id: 'mirror', terms: ['我', '理解', '反思', '策略', '困难', '感觉', 'monitoring', 'evaluating', 'reflect', 'self-questioning'], rationale: '材料包含学习者自己的理解、困难或学习策略线索。' },
  { id: 'nexus', terms: ['联系', '关系', '结构', '影响', '关联', '结合', 'relationship', 'connect', 'prior knowledge'], rationale: '材料强调概念之间的关系、结构或跨领域连接。' },
  { id: 'limit', terms: ['边界', '限制', '前沿', '未知', '无法', '极限', '不能', '不等于', '条件', 'limitation', 'cannot', 'condition'], rationale: '材料涉及适用边界、尚未解决的问题或进阶方向。' }
];

function units(content: string): Array<{ excerpt: string; start: number; page?: number }> {
  const result: Array<{ excerpt: string; start: number; page?: number }> = [];
  const pageMarkers = [...content.matchAll(/【第 (\d+) 页】/g)];
  let cursor = 0;
  const add = (end: number) => {
    const raw = content.slice(cursor, end);
    const withoutMarker = raw.replace(/^\s*【第 \d+ 页】\s*/, '');
    const excerpt = withoutMarker.trim();
    if (excerpt.length >= 4) {
      const start = cursor + raw.indexOf(excerpt);
      const marker = [...pageMarkers].reverse().find(item => (item.index ?? 0) <= start);
      result.push({ excerpt, start, page: marker ? Number(marker[1]) : undefined });
    }
    cursor = end;
  };
  // 单换行常是 PDF 的行宽折行；只在句末标点或空行拆分，保留原文字符偏移。
  for (const match of content.matchAll(/[。！？!?]|\.(?=\s|$)|\n\s*\n/g)) add((match.index ?? 0) + match[0].length);
  add(content.length);
  return result;
}
function hasCue(text: string, term: string): boolean {
  if (!/^[a-z -]+$/i.test(term)) return text.includes(term);
  return new RegExp(`(?:^|[^a-z])${term}(?![a-z])`, 'i').test(text);
}
function unitType(text: string): NonNullable<LearningSuggestion['unitType']> {
  if (/[？?]/.test(text)) return 'question';
  if (/限制|边界|条件|不能|不等于|只适用|\blimitation\b|\bcannot\b/i.test(text)) return 'limit';
  if (/实验|样本|数据|研究发现|结果显示|\bevidence\b|\bstudy\b/i.test(text)) return 'evidence';
  if (/例如|比如|举例|\bfor example\b/i.test(text)) return 'example';
  if (/先|随后|步骤|做法|练习|\bplanning\b|\bsteps\b|\bpractice\b/i.test(text)) return 'method';
  if (/定义|是指|意味着|\bdefinition\b/i.test(text)) return 'concept';
  return 'claim';
}
function keywordsFrom(text: string): string[] {
  const counts = new Map<string, number>();
  const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
  for (const { segment, isWordLike } of segmenter.segment(text)) {
    const word = segment.trim();
    if (!isWordLike || word.length < 2 || word.length > 12 || stopWords.has(word)) continue;
    if (!/[\p{L}]/u.test(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([word]) => word);
}

/** 可离线审查的首版分析器：只产生建议，不伪装成对材料的理解。 */
export function countMaterialUnits(content: string): number {
  return units(content).length;
}

export function analyseMaterial(material: LearningMaterial): LearningSuggestion[] {
  const fragments = units(material.content);
  if (fragments.length > MAX_LOCAL_UNITS) throw new Error(`本地试验版一次最多分析 ${MAX_LOCAL_UNITS} 个句段。请先选取一段材料导入，原文不会被自动删减。`);
  return fragments.map(({ excerpt, start, page }, index) => {
    const scores = voidSignals.map(signal => {
      const cues = signal.terms.filter(term => hasCue(excerpt, term));
      return { ...signal, cues, score: cues.length };
    });
    const ordered = scores.filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const primary = ordered[0] ?? null;
    const secondary = ordered.slice(1, 3).map(item => item.id);
    const rationale = primary
      ? `本句段出现“${primary.cues.join('、')}”等字面线索，暂建议从${primary.id === 'void' ? '未知' : '对应空域'}切入；词语匹配不等于理解原意，请核对原文。`
      : '本地规则未找到足够的七空线索；暂不分类，请由你补充判断。';
    return {
      id: crypto.randomUUID(), materialId: material.id, title: `${material.title || '学习材料'} · 片段 ${index + 1}`,
      summary: excerpt, keywords: keywordsFrom(excerpt), prerequisites: [],
      primaryVoid: primary?.id ?? null, secondaryVoids: secondary, rationale,
      evidence: { excerpt, start, ...(page ? { page } : {}) }, unitType: unitType(excerpt),
      voidAssessments: scores.map(item => ({ voidType: item.id, status: item.score ? 'candidate' as const : 'no-evidence' as const, cue: item.cues.join('、') || undefined }))
    };
  });
}

export type ConfirmationTaskPlan = { mode: 'none' | 'starter' | 'action'; action: string };

export function confirmationTasks(project: LearningProject, suggestion: LearningSuggestion, plan: ConfirmationTaskPlan): LearningTask[] {
  if (plan.mode === 'none') return [];
  if (plan.mode === 'starter') return starterTasks(project, suggestion);
  const action = plan.action.trim();
  if (!action || action.length > 500) throw new Error('请填写 1–500 字的下一步任务。');
  return [{ id: crypto.randomUUID(), projectId: project.id, kind: 'practice', title: action, note: `来自你确认的「${suggestion.title}」；这是行动安排，不是掌握程度判定。`, createdAt: Date.now() }];
}

export function starterTasks(project: LearningProject, suggestion: LearningSuggestion): LearningTask[] {
  const now = Date.now();
  return [
    { id: crypto.randomUUID(), projectId: project.id, kind: 'preview', title: `辨认「${suggestion.title}」的未知与目标`, note: '检查候选分类，圈出真正陌生的词或问题。', createdAt: now },
    { id: crypto.randomUUID(), projectId: project.id, kind: 'recall', title: `不用看资料，解释「${suggestion.title}」`, note: '用自己的话写三句话；卡住处就是下一轮学习线索。', createdAt: now },
    { id: crypto.randomUUID(), projectId: project.id, kind: 'review', title: '两天后回顾这份材料', note: '先回忆，再打开资料补充或修正。', createdAt: now + 2 * 86400000 }
  ];
}
