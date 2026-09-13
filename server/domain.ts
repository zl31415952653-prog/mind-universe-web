// 服务端领域类型（与前端 src/types.ts 对应）

export type ExperienceType = 'emotional' | 'knowledge' | 'daily';
export type VoidId = 'void' | 'silence' | 'fracture' | 'flow' | 'mirror' | 'nexus' | 'limit';

export interface AttachmentMeta {
  id: string;
  name: string;
  mime: string;
  size: number;
  url: string;
  createdAt: number;
}

export interface EntryRow {
  [key: string]: unknown;
  id: string;
  owner_id?: string;
  kind: ExperienceType;
  title: string;
  content: string;
  primary_void: VoidId;
  secondary_voids: string;
  tags: string;
  emotion: string;
  encoding: string;
  knowledge: string;
  privacy: string;
  attachments: string;
  sensory: string;
  source: string | null;
  is_default: number;
  created_at: number;
  updated_at: number;
  version: number;
  deleted_at: number | null;
}

export interface LinkRow {
  [key: string]: unknown;
  id: string;
  owner_id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  description: string;
  strength: number;
  source: string;
  status: string;
  created_at: number;
}

export interface AttachmentRow {
  id: string;
  owner_id: string;
  filename: string;
  mime: string;
  size: number;
  created_at: number;
  deleted_at: number | null;
}

export interface VersionRow {
  [key: string]: unknown;
  id: string;
  entry_id: string;
  owner_id: string;
  version: number;
  snapshot: string;
  created_at: number;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  created_at: number;
}
