import { defaultKnowledgePack } from './defaultKnowledge';
import type { LearningMaterial, LearningReference, LearningSuggestion } from './domain';

// 仅用于检索提示，不参与七空分类。双语术语不是论文结论。
const aliases: Record<string, string[]> = {
  '问题形成': ['问题', 'question', 'inquiry'], '检索': ['检索', 'search'],
  '反馈': ['反馈', 'feedback'], '先尝试': ['尝试', 'attempt'],
  '主动回忆': ['回忆', 'recall', 'retrieval'], '延迟保持': ['保持', 'retention'],
  '间隔练习': ['间隔', 'spacing', 'spaced'], '回顾': ['回顾', 'review'],
  '概念改变': ['概念改变', 'conceptual change', 'misconception'], '辨析': ['区别', 'contrast'],
  '认知冲突': ['冲突', 'conflict'], '研究方法': ['研究方法', 'research method'],
  '证据比较': ['证据', 'evidence'], '目标': ['目标', 'goal', 'planning'],
  '自我调节': ['自我调节', 'self-regulated', 'self-regulation'],
  '监控': ['监控', 'monitoring'], '调整': ['调整', 'adjust'],
  '元认知': ['元认知', 'metacognition'], '把握度': ['把握度', 'confidence'],
  '校准': ['校准', 'calibration'], '反思': ['反思', 'reflection', 'reflect'],
  '策略': ['策略', 'strategy', 'strategies'], '解释': ['解释', 'explain', 'explanation'],
  '关系': ['关系', 'relationship', 'connection'], '概念图': ['概念图', 'concept map'],
  '人工确认': ['确认', 'confirmation'], '适用范围': ['范围', 'scope', 'context'],
  '迁移': ['迁移', 'transfer'], '不确定性': ['不确定', 'uncertainty'],
  '待确认': ['待确认', 'uncertain'], '来源判断': ['来源', 'source'],
  '信息素养': ['信息素养', 'information literacy']
};
const matchTerm = (content: string, term: string) => /^[a-z -]+$/.test(term)
  ? new RegExp(`\\b${term}\\b`, 'i').test(content) : content.includes(term);

// 真实试跑发现“解释/反馈”等泛词会错配：先检查条目的主题线索，再排序。
const topicCues: Record<string, string[]> = {
  'v-01':['不懂','不知道','未知','缺口','unknown','unfamiliar'],
  'v-02':['问题','提问','question','inquiry','检索','search'],
  'v-03':['尝试','解法','受挫','失败','attempt','failure'],
  'j-01':['回忆','重读','熟悉','recall','retrieval','familiar','rereading'],
  'j-02':['间隔','回顾','spacing','spaced','review'],
  'j-03':['回忆','订正','纠正','recall','retrieval','correction'],
  'l-01':['旧解释','新解释','概念改变','误解','conceptual change','misconception'],
  'l-02':['冲突','矛盾','conflict','contradiction'],
  'l-03':['证据','研究方法','evidence','research method'],
  'f-01':['目标','goal','planning'], 'f-02':['检查','监控','monitoring','check'],
  'f-03':['调整','adjust'], 'm-01':['把握度','熟悉','信心','confidence','familiar'],
  'm-02':['把握度','校准','confidence','calibration'],
  'm-03':['策略','复盘','strategies','strategy','reflection'],
  'c-01':['联系','连接','关系','关联','connection','relationship','link'],
  'c-02':['概念图','concept map'], 'c-03':['关系','relationship'],
  'e-01':['对象','任务','情境','范围','适用','scope','context','population'],
  'e-02':['不确定','待确认','未知','uncertain','uncertainty'],
  'e-03':['来源','source','信息素养','information literacy']
};

/** 小型确定性词面检索；无匹配就留空，不按所属空硬配参考。 */
export function retrieveLearningReferences(content: string, pack: LearningMaterial['referencePack'], limit = 3): LearningReference[] {
  if (pack !== 'learning-science-v1') return [];
  return defaultKnowledgePack.filter(entry => entry.id.startsWith('learning-science-') && entry.reviewStatus === 'provisional').map(entry => {
    const topics = (topicCues[entry.id.replace('learning-science-','')] ?? []).filter(term => matchTerm(content,term));
    const terms = topics.length ? [...new Set([...topics,...entry.tags.flatMap(tag => aliases[tag] ?? [])])].filter(term => matchTerm(content, term)) : [];
    return { entry, terms };
  }).filter(item => item.terms.length).sort((a,b) => b.terms.length - a.terms.length || a.entry.id.localeCompare(b.entry.id)).slice(0, Math.max(0, Math.min(6, limit)))
    .map(({entry,terms}) => ({ id: entry.id, title: entry.title, summary: entry.summary, source: entry.source ?? '', evidenceLocator: entry.evidenceLocator ?? '', evidenceLimit: entry.evidenceLimit ?? '', suggestedAction: entry.suggestedAction ?? '', matchedTerms: terms, reviewStatus: 'provisional' }));
}

export function attachLearningReferences(material: LearningMaterial, suggestions: LearningSuggestion[]): LearningSuggestion[] {
  return suggestions.map(item => ({ ...item, references: retrieveLearningReferences(item.evidence?.excerpt ?? item.summary, material.referencePack) }));
}
