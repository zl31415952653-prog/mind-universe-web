import Dexie, { type Table } from 'dexie';
import type { Entry, KnowledgeEntry, Link } from './types';

/** 待推送变更（同步队列） */
export interface OutboxItem {
  id: string;           // 队列项 id
  kind: 'entry' | 'link' | 'knowledge';
  op: 'create' | 'update' | 'delete';
  itemId: string;       // 条目/关系 id
  baseVersion?: number; // update 时的本地基准版本
  queuedAt: number;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

class InfinityDB extends Dexie {
  entries!: Table<Entry, string>;
  links!: Table<Link, string>;
  knowledge!: Table<KnowledgeEntry, string>;
  outbox!: Table<OutboxItem, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('infinity-local');
    this.version(2).stores({
      entries: 'id, updatedAt, primaryVoid, kind, deletedAt',
      links: 'id, createdAt',
      knowledge: 'id, updatedAt, domain, voidType, deletedAt',
      outbox: 'id, queuedAt',
      meta: 'key',
    });
  }
}

export const db = new InfinityDB();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
