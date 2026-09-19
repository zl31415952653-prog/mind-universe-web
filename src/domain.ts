export type VoidId = 'void' | 'silence' | 'fracture' | 'flow' | 'mirror' | 'nexus' | 'limit';

export interface Void {
  id: VoidId;
  symbol: string;
  name: string;
  worldview: string;
  question: string;
  color: string;
  soft: string;
}

export interface Signal {
  emotion?: string;
  colorName?: string;
  colorHex?: string;
  texture?: string;
}

export type ExperienceKind = 'emotional' | 'knowledge' | 'daily';

/** 第三方无默认访问权；授权记录应在后续云端版本中带有不可篡改的审计日志。 */
export interface ShareGrant {
  id: string;
  recipient: string;
  purpose: string;
  scope: 'analysis-only' | 'source-and-analysis';
  createdAt: number;
  expiresAt?: number;
  revokedAt?: number;
}

export interface PrivacySettings {
  aiVisible: boolean;
  shareGrants: ShareGrant[];
}

/** 这是用户在本地执行的授权操作记录，不代表第三方已实际读取任何内容。 */
export interface AuthorizationAuditEvent {
  id: string;
  entryId: string;
  grantId: string;
  action: 'created' | 'revoked';
  createdAt: number;
}

export const defaultPrivacy = (): PrivacySettings => ({ aiVisible: true, shareGrants: [] });

export interface Entry {
  id: string;
  kind: ExperienceKind;
  title: string;
  body: string;
  primaryVoid: VoidId;
  secondaryVoids: VoidId[];
  signal: Signal;
  createdAt: number;
  importance: number;
  insight?: string;
  privacy: PrivacySettings;
}

export interface Relation {
  id: string;
  from: string;
  to: string;
  type: 'resonance' | 'tension' | 'thread';
  reason?: string;
}

/** 发现不是关系本身。候选必须经过用户接受或忽略，不能自动写入图谱。 */
export interface DiscoverySuggestion {
  id: string;
  from: string;
  to: string;
  type: Relation['type'];
  reason: string;
  sharedTerms: string[];
  status: 'pending' | 'accepted' | 'dismissed';
  createdAt: number;
}

/** 学习材料或被沉淀的知识；它不是普通附件，而是可进入七空的认知节点。 */
export interface KnowledgeEntry {
  id: string;
  title: string;
  summary: string;
  voidType: VoidId;
  source?: string;
  tags: string[];
  linkedEntryIds: string[];
  createdAt: number;
  /** 预置知识是可见、可导出、可由用户继续扩展的脚手架，不是隐藏系统规则。 */
  isDefault?: boolean;
  domain?: string;
  taxonomy?: string[];
  prerequisites?: string[];
}

/** 知识之间的边必须由用户确认；AI 未来只能提交同样结构的候选边。 */
export interface KnowledgeRelation {
  id: string;
  from: string;
  to: string;
  type: 'prerequisite' | 'contains' | 'contrast' | 'conflict' | 'analogy' | 'application';
  reason: string;
  createdAt: number;
}

/** 一份进入学习流程的原始材料。首版只处理用户主动粘贴的文本或网址说明。 */
export interface LearningMaterial {
  id: string;
  projectId: string;
  title: string;
  kind: 'text' | 'web' | 'pdf';
  source?: string;
  content: string;
  createdAt: number;
}

/** AI/本地分析的输出永远是候选；confirmedAt 为空即未被用户确认。 */
export interface LearningSuggestion {
  id: string;
  materialId: string;
  title: string;
  summary: string;
  keywords: string[];
  prerequisites: string[];
  primaryVoid: VoidId;
  secondaryVoids: VoidId[];
  rationale: string;
  confirmedAt?: number;
  knowledgeEntryId?: string;
}

export interface LearningTask {
  id: string;
  projectId: string;
  title: string;
  kind: 'preview' | 'recall' | 'practice' | 'review';
  note: string;
  doneAt?: number;
  createdAt: number;
}

export interface LearningProject {
  id: string;
  title: string;
  goal: string;
  currentLevel: 'new' | 'building' | 'familiar';
  createdAt: number;
}

/** 用户确认的一次主空变化；系统不得自动写入。 */
export interface Transition {
  id: string;
  entryId: string;
  from: VoidId;
  to: VoidId;
  reason: string;
  createdAt: number;
}

export const VOIDS: Void[] = [
  { id: 'void', symbol: '∅₁', name: '虚空', worldview: '未知的世界', question: '这里有什么？', color: '#5968d9', soft: '#b8c7ff' },
  { id: 'silence', symbol: '∅₂', name: '寂空', worldview: '已理解的世界', question: '我已理解什么？', color: '#2676d6', soft: '#9dd5ff' },
  { id: 'fracture', symbol: '∅₃', name: '裂空', worldview: '冲突的世界', question: '什么正在撕裂我？', color: '#ef5b61', soft: '#ffc1ba' },
  { id: 'flow', symbol: '∅₄', name: '流空', worldview: '变化的世界', question: '什么正在形成？', color: '#2dbb9c', soft: '#a0f4d9' },
  { id: 'mirror', symbol: '∅₅', name: '映空', worldview: '自我的世界', question: '我如何看待自己？', color: '#bac8dd', soft: '#f0f6ff' },
  { id: 'nexus', symbol: '∅₆', name: '联空', worldview: '连接的世界', question: '什么与什么相连？', color: '#f3c75f', soft: '#ffe9ad' },
  { id: 'limit', symbol: '∅₇', name: '极空', worldview: '边界的世界', question: '边缘在哪里？', color: '#ad69e5', soft: '#ead1ff' }
];

export const getVoid = (id: VoidId) => VOIDS.find(v => v.id === id) ?? VOIDS[0];

export const seedEntries: Entry[] = [
  { id: 'seed-1', kind:'emotional', title: '一个尚未命名的困惑', body: '我发现自己总在做很多事，却不确定它们是否指向同一个方向。', primaryVoid: 'void', secondaryVoids: ['mirror'], signal: { emotion: '迷茫', colorName: '靛青', colorHex: '#5968d9', texture: '雾' }, createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5, importance: 4, privacy: defaultPrivacy() },
  { id: 'seed-2', kind:'knowledge', title: '学习不是积累，而是建立联系', body: '把一个概念和一段经验连起来，它才开始成为自己的知识。', primaryVoid: 'nexus', secondaryVoids: ['silence'], signal: { emotion: '清醒', colorName: '明黄', colorHex: '#f3c75f', texture: '光' }, createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3, importance: 5, insight: '知识在被个人经验照亮时，才真正留下来。', privacy: defaultPrivacy() },
  { id: 'seed-3', kind:'daily', title: '我正在学着慢一点', body: '今天没有解决问题，但我允许它暂时悬在那里。', primaryVoid: 'flow', secondaryVoids: ['void'], signal: { emotion: '平静', colorName: '青碧', colorHex: '#2dbb9c', texture: '水' }, createdAt: Date.now() - 1000 * 60 * 60 * 22, importance: 3, privacy: defaultPrivacy() }
];

export const seedRelations: Relation[] = [
  { id: 'rel-1', from: 'seed-1', to: 'seed-2', type: 'thread' },
  { id: 'rel-2', from: 'seed-1', to: 'seed-3', type: 'resonance' }
];
