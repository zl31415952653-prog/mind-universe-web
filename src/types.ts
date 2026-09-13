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
  worldview: string; // 世界观完整描述（纲领 8.2）
  shape: string;     // 编码特征：形状
  texture: string;   // 编码特征：质感
  examples: string[]; // 典型经历（纲领 8.3）
  guidance: string;  // 认知建设建议
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
  /** 色系（红/橙黄/绿/青蓝/紫/白灰褐） */
  category: string;
  /** 关联的空（可选，如"靛青"呼应虚空） */
  voidId?: VoidId;
}

/** 感官编码：用户独特的感知通道（SPEC 4.3） */
export interface SensoryEncoding {
  shapes?: string[];
  textures?: string[];
  angles?: string[];
  lines?: string[];
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
  sensory: SensoryEncoding;
  knowledge: KnowledgeEncoding;
  privacy: Privacy;
  attachments?: AttachmentMeta[];
  source?: string | null;
  isDefault?: boolean;
  createdAt: number;
  updatedAt: number;
  version?: number;
  /** 本地软删除标记（同步队列专用，删除同步成功后移除） */
  deletedAt?: number;
  /** 同步冲突标记：本地与服务器版本不一致，等待用户裁决 */
  conflict?: boolean;
  /** 冲突时的服务器版本（供"采用云端版"恢复） */
  serverCopy?: Entry;
}

/** 附件元数据（文件本体存服务器 uploads 目录，条目里只存引用） */
export interface AttachmentMeta {
  id: string;
  name: string;
  mime: string;
  size: number;
  url: string;
  createdAt: number;
}

/** 历史版本（服务器在每次更新前保存快照） */
export interface EntryVersion {
  id: string;
  entryId: string;
  version: number;
  snapshot: Entry;
  createdAt: number;
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
  sensory: SensoryEncoding;
  knowledge: KnowledgeEncoding;
  privacy: Privacy;
  attachments?: AttachmentMeta[];
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
  id?: string;
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
  emotionLabel?: string;
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
