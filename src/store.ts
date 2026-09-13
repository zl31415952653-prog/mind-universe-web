import { db } from './db';
import { flushOutbox, keepLocalVersion, keepServerVersion, notifySyncChange } from './sync';
import type { Entry, EntryDraft } from './types';

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
