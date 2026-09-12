// 领域类型 —— 对应《重构方案分析 v3》3.3 节数据模型与服务端存储字段

export type VoidId = 'void' | 'silence' | 'fracture' | 'flow' | 'mirror' | 'nexus' | 'limit';
export type ExperienceType = 'emotional' | 'knowledge' | 'daily';

export interface VoidDef {
  id: VoidId;
  symbol: string;   // ∅₁
  name: string;     // 虚空
  meaning: string;  // 未知的世界
  color: string;    // 纲领第八节色值
  question: string; // 核心问题
}

export interface EmotionEncoding {
  valence?: number;   // -1 ~ 1
  intensity?: number; // 0 ~ 1
  label?: string;
}

export interface ColorBlock {
  name: string;
  hex: string;
  meaning: string;
}

export interface EntryEncoding {
  color?: ColorBlock | null;
}

export interface KnowledgeEncoding {
  domain?: string;
  taxonomy?: string[];
}

export interface Privacy {
  aiVisible?: boolean;
}

export interface Entry {
  id: string;
  kind: ExperienceType;
  title: string;
  content: string;
  primaryVoid: VoidId;
  secondaryVoids: VoidId[];
  tags: string[];
  emotion: EmotionEncoding;
  encoding: EntryEncoding;
  knowledge: KnowledgeEncoding;
  privacy: Privacy;
  source?: string | null;
  isDefault?: boolean;
  createdAt: number;
  updatedAt: number;
  version?: number;
}

/** 编辑器/创建接口使用的草稿：不含服务端生成的字段 */
export interface EntryDraft {
  kind: ExperienceType;
  title: string;
  content: string;
  primaryVoid: VoidId;
  secondaryVoids: VoidId[];
  tags: string[];
  emotion: EmotionEncoding;
  encoding: EntryEncoding;
  knowledge: KnowledgeEncoding;
  privacy: Privacy;
}

export interface Link {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  description: string;
  strength: number;
  source: 'user' | 'ai';
  status: string;
  createdAt: number;
}

export interface LinkInput {
  sourceId: string;
  targetId: string;
  relationType?: string;
  description?: string;
  strength?: number;
}

export interface SuggestionPayload {
  primaryVoid: VoidId;
  tags: string[];
  color: string;
  reason: string;
}

export interface Suggestion {
  id: string;
  entryId: string;
  payload: SuggestionPayload;
  status: string;
  createdAt: number;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
}
