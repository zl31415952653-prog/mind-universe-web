import { db } from './db';
import {
  flushOutbox,
  keepKnowledgeLocalVersion,
  keepKnowledgeServerVersion,
  keepLocalVersion,
  keepServerVersion,
  notifySyncChange,
} from './sync';
import type { Entry, EntryDraft, KnowledgeDraft, KnowledgeEntry, Link, RelationType } from './types';

/**
 * 数据仓库（本地优先）：
 * 页面只与本模块交互 —— 写入先落 IndexedDB（立即可见），再入同步队列后台推送。
 * 网络状况不影响本地读写。
 */

interface MutOpts {
  /** 是否立即尝试后台推送；测试与离线模拟场景可关闭 */
  sync?: boolean;
}

async function enqueue(kind: 'entry', op: 'create' | 'update' | 'delete', itemId: string, baseVersion?: number): Promise<void> {
  await db.outbox.put({ id: crypto.randomUUID(), kind, op, itemId, baseVersion, queuedAt: Date.now() });
  notifySyncChange();
}

export async function saveEntry(
  idOrNew: string | 'new',
  draft: EntryDraft,
  opts: MutOpts = {},
): Promise<Entry> {
  if (idOrNew === 'new') {
    const entry: Entry = {
      id: crypto.randomUUID(),
      ...draft,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.entries.put(entry);
    await enqueue('entry', 'create', entry.id);
    if (opts.sync !== false) void flushOutbox();
    return entry;
  }
  const existing = await db.entries.get(idOrNew);
  if (!existing) throw new Error('条目不存在');
  const entry: Entry = { ...existing, ...draft, updatedAt: Date.now() };
  await db.entries.put(entry);
  await enqueue('entry', 'update', idOrNew, existing.version);
  if (opts.sync !== false) void flushOutbox();
  return entry;
}

export async function removeEntry(id: string, opts: MutOpts = {}): Promise<void> {
  const existing = await db.entries.get(id);
  if (!existing) return;
  await db.entries.put({ ...existing, deletedAt: Date.now(), updatedAt: Date.now() });
  await enqueue('entry', 'delete', id);
  if (opts.sync !== false) void flushOutbox();
}

export async function resolveConflict(id: string, keep: 'local' | 'server'): Promise<Entry | undefined> {
  return keep === 'local' ? keepLocalVersion(id) : keepServerVersion(id);
}

// ---------- 关系（本地优先，入同步队列） ----------

export async function addLink(input: { sourceId: string; targetId: string; relationType: RelationType; description?: string; strength?: number; source?: 'user' | 'ai' }): Promise<Link> {
  const link: Link = {
    id: crypto.randomUUID(),
    sourceId: input.sourceId,
    targetId: input.targetId,
    relationType: input.relationType,
    description: input.description ?? '',
    strength: input.strength ?? 0.5,
    source: input.source ?? 'user',
    status: 'accepted',
    createdAt: Date.now(),
  };
  await db.links.put(link);
  await db.outbox.put({ id: crypto.randomUUID(), kind: 'link', op: 'create', itemId: link.id, queuedAt: Date.now() });
  notifySyncChange();
  void flushOutbox();
  return link;
}

export async function removeLinkLocal(id: string): Promise<void> {
  await db.links.delete(id);
  await db.outbox.put({ id: crypto.randomUUID(), kind: 'link', op: 'delete', itemId: id, queuedAt: Date.now() });
  notifySyncChange();
  void flushOutbox();
}

// ---------- 知识库（本地优先，与经历同一套同步队列） ----------

async function enqueueKnowledge(op: 'create' | 'update' | 'delete', itemId: string, baseVersion?: number): Promise<void> {
  await db.outbox.put({ id: crypto.randomUUID(), kind: 'knowledge', op, itemId, baseVersion, queuedAt: Date.now() });
  notifySyncChange();
}

export async function saveKnowledge(idOrNew: string | 'new', draft: KnowledgeDraft, opts: MutOpts = {}): Promise<KnowledgeEntry> {
  if (idOrNew === 'new') {
    const entry: KnowledgeEntry = {
      id: crypto.randomUUID(),
      ...draft,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.knowledge.put(entry);
    await enqueueKnowledge('create', entry.id);
    if (opts.sync !== false) void flushOutbox();
    return entry;
  }
  const existing = await db.knowledge.get(idOrNew);
  if (!existing) throw new Error('知识条目不存在');
  const entry: KnowledgeEntry = { ...existing, ...draft, updatedAt: Date.now() };
  await db.knowledge.put(entry);
  await enqueueKnowledge('update', idOrNew, existing.version);
  if (opts.sync !== false) void flushOutbox();
  return entry;
}

export async function removeKnowledge(id: string, opts: MutOpts = {}): Promise<void> {
  const existing = await db.knowledge.get(id);
  if (!existing) return;
  await db.knowledge.put({ ...existing, deletedAt: Date.now(), updatedAt: Date.now() });
  await enqueueKnowledge('delete', id);
  if (opts.sync !== false) void flushOutbox();
}

export async function resolveKnowledgeConflict(id: string, keep: 'local' | 'server'): Promise<KnowledgeEntry | undefined> {
  return keep === 'local' ? keepKnowledgeLocalVersion(id) : keepKnowledgeServerVersion(id);
}

/**
 * 导入知识库 JSON（导出文件的 knowledge 数组）：
 * 为每条生成新 id 并重写前置/相关引用（保持链接关系），走本地库 + 同步队列，离线可用。
 */
export async function importKnowledge(list: KnowledgeEntry[]): Promise<number> {
  const idMap = new Map<string, string>();
  for (const k of list) idMap.set(k.id, crypto.randomUUID());
  let count = 0;
  for (const k of list) {
    if (!k.title?.trim()) continue;
    const entry: KnowledgeEntry = {
      ...k,
      id: idMap.get(k.id) ?? crypto.randomUUID(),
      prerequisites: (k.prerequisites ?? []).map(old => idMap.get(old)).filter((x): x is string => !!x),
      relatedEntries: (k.relatedEntries ?? []).map(old => idMap.get(old)).filter((x): x is string => !!x),
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: undefined,
      deletedAt: undefined,
      conflict: undefined,
      serverCopy: undefined,
    };
    await db.knowledge.put(entry);
    await enqueueKnowledge('create', entry.id);
    count += 1;
  }
  void flushOutbox();
  return count;
}
