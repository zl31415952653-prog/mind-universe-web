import type { LearningMaterial, LearningProject, LearningSuggestion, LearningTask, VoidId } from './domain';

const stopWords = new Set('一个一些这个那个我们你们他们以及因为所以但是如果可以需要通过进行对于关于已经正在没有什么如何为什么学习知识资料内容系统用户'.split(''));
const voidSignals: Array<{ id: VoidId; terms: string[]; rationale: string }> = [
  { id: 'void', terms: ['未知', '入门', '概念', '是什么', '问题', '基础'], rationale: '材料中包含陌生概念、问题或入门线索，适合作为待探索内容。' },
  { id: 'silence', terms: ['定义', '原理', '总结', '结论', '掌握', '方法'], rationale: '材料在陈述相对稳定的定义、原理或可归档的方法。' },
  { id: 'fracture', terms: ['但是', '矛盾', '争议', '区别', '误解', '错误', '反而'], rationale: '材料出现了对比、争议或容易混淆之处，值得单独辨析。' },
  { id: 'flow', terms: ['过程', '步骤', '发展', '变化', '正在', '阶段'], rationale: '材料强调过程、步骤或尚在发展的状态。' },
  { id: 'mirror', terms: ['我', '理解', '反思', '策略', '困难', '感觉'], rationale: '材料包含学习者自己的理解、困难或学习策略线索。' },
  { id: 'nexus', terms: ['联系', '关系', '结构', '影响', '关联', '结合'], rationale: '材料强调概念之间的关系、结构或跨领域连接。' },
  { id: 'limit', terms: ['边界', '限制', '前沿', '未知', '无法', '极限'], rationale: '材料涉及适用边界、尚未解决的问题或进阶方向。' }
];

function unique(values: string[]) { return [...new Set(values.filter(Boolean))]; }
function sentences(content: string) { return content.split(/[。！？!?\n]+/).map(v => v.trim()).filter(Boolean); }

/** 可离线审查的首版分析器：只产生建议，不伪装成对材料的理解。 */
export function analyseMaterial(material: LearningMaterial): LearningSuggestion[] {
  const text = material.content.trim();
  if (!text) return [];
  const chunks = sentences(text).slice(0, 8);
  const rawWords = text.match(/[\u4e00-\u9fa5]{2,}|[A-Za-z][A-Za-z0-9-]{2,}/g) ?? [];
  const keywords = unique(rawWords.filter(word => !stopWords.has(word)).sort((a, b) => rawWords.filter(x => x === b).length - rawWords.filter(x => x === a).length)).slice(0, 6);
  const scores = voidSignals.map(signal => ({ ...signal, score: signal.terms.reduce((sum, term) => sum + (text.match(new RegExp(term, 'g'))?.length ?? 0), 0) }));
  const ordered = scores.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const primary = ordered[0];
  const secondary = ordered.filter(item => item.id !== primary.id && item.score > 0).slice(0, 2).map(item => item.id);
  const title = material.title || keywords.slice(0, 3).join(' · ') || '未命名学习材料';
  const summary = chunks.slice(0, 2).join('。') || '这份材料还需要你补充内容。';
  const prerequisite = keywords.slice(0, 3).map(keyword => `确认你是否已理解「${keyword}」的基础定义`);
  return [{
    id: crypto.randomUUID(), materialId: material.id, title, summary, keywords,
    prerequisites: prerequisite, primaryVoid: primary.id, secondaryVoids: secondary,
    rationale: `${primary.rationale} 这是基于可见词语的本地候选，不代表唯一分类。请按你的理解修改。`
  }];
}

export function starterTasks(project: LearningProject, suggestion: LearningSuggestion): LearningTask[] {
  const now = Date.now();
  return [
    { id: crypto.randomUUID(), projectId: project.id, kind: 'preview', title: `辨认「${suggestion.title}」的未知与目标`, note: '检查候选分类，圈出真正陌生的词或问题。', createdAt: now },
    { id: crypto.randomUUID(), projectId: project.id, kind: 'recall', title: `不用看资料，解释「${suggestion.title}」`, note: '用自己的话写三句话；卡住处就是下一轮学习线索。', createdAt: now },
    { id: crypto.randomUUID(), projectId: project.id, kind: 'review', title: '两天后回顾这份材料', note: '先回忆，再打开资料补充或修正。', createdAt: now + 2 * 86400000 }
  ];
}
