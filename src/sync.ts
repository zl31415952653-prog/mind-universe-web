import { api, ApiError } from './api';
import { db, getMeta, setMeta } from './db';
import { buildDefaultEntries } from './defaultKnowledge';
import type { Entry, EntryDraft } from './types';

/**
 * 同步引擎（离线优先）：
 * - pullSnapshot：拉取服务器全量快照合并到本地；本地有待推送修改的条目不被覆盖
 * - flushOutbox：按队列顺序推送变更；409 冲突保留双方并标记，绝不静默覆盖
 * - 事件通知：任何队列/数据变化后 emitSyncChange，UI 据此刷新
 */

type Listener = () => void;
const listeners = new Set<Listener>();
export function onSyncChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export function notifySyncChange(): void {
  listeners.forEach(fn => fn());
}

// 串行化推送：多次调用排队执行，await flushOutbox() 返回时保证本轮推送已完成
let flushChain: Promise<void> = Promise.resolve();

const entryToDraft = (e: Entry): EntryDraft => ({
  kind: e.kind,
  title: e.title,
  content: e.content,
  primaryVoid: e.primaryVoid,
  secondaryVoids: e.secondaryVoids ?? [],
  tags: e.tags ?? [],
  emotion: e.emotion ?? {},
  encoding: e.encoding ?? { color: null },
  knowledge: e.knowledge ?? {},
  privacy: e.privacy ?? {},
  attachments: e.attachments ?? [],
});

/** 仅当从未成功同步且本地为空时，用打包的默认知识库兜底（离线可用） */
export async function ensureLocalSeed(): Promise<void> {
  const lastPull = await getMeta<number>('lastPulledAt');
  if (lastPull) return;
  const count = await db.entries.count();
  if (count === 0) {
    await db.entries.bulkPut(buildDefaultEntries());
  }
}

/** 拉取服务器快照并合并：本地未修改的以服务器为准；服务器已删的移除本地副本 */
export async function pullSnapshot(): Promise<void> {
  const [serverEntries, serverLinks] = await Promise.all([api.entries(), api.links()]);
  const localEntries = await db.entries.toArray();
  const localLinks = await db.links.toArray();
  const outbox = await db.outbox.toArray();
  const pendingEntryIds = new Set(outbox.filter(o => o.kind === 'entry').map(o => o.itemId));
  const pendingLinkIds = new Set(outbox.filter(o => o.kind === 'link').map(o => o.itemId));
  const lastPull = Number(await getMeta<number>('lastPulledAt') ?? 0);

  for (const se of serverEntries) {
    const le = localEntries.find(e => e.id === se.id);
    if (!le || !pendingEntryIds.has(se.id)) await db.entries.put(se);
  }
  const serverIds = new Set(serverEntries.map(e => e.id));
  for (const le of localEntries) {
    if (le.deletedAt) continue;
    if (!serverIds.has(le.id) && !pendingEntryIds.has(le.id) && le.updatedAt <= lastPull) {
      await db.entries.delete(le.id); // 服务器端已删除
    }
  }

  for (const sl of serverLinks) {
    const ll = localLinks.find(l => l.id === sl.id);
    if (!ll || !pendingLinkIds.has(sl.id)) await db.links.put(sl);
  }
  const serverLinkIds = new Set(serverLinks.map(l => l.id));
  for (const ll of localLinks) {
    if (!serverLinkIds.has(ll.id) && !pendingLinkIds.has(ll.id) && ll.createdAt <= lastPull) {
      await db.links.delete(ll.id);
    }
  }

  await setMeta('lastPulledAt', Date.now());
}

interface ConflictBody {
  error?: string;
  current?: Entry;
}

function isConflict(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 409 && !!(err.body as ConflictBody | undefined)?.current;
}

/** 推送同步队列。网络失败即停（保留队列）；冲突标记后停在该项并继续 */
export function flushOutbox(): Promise<void> {
  flushChain = flushChain.catch(() => {}).then(doFlush);
  return flushChain;
}

async function doFlush(): Promise<void> {
  try {
    const items = await db.outbox.orderBy('queuedAt').toArray();
    for (const item of items) {
      try {
        if (item.kind === 'entry') await flushEntry(item);
        else await flushLink(item);
        await db.outbox.delete(item.id);
      } catch (err) {
        if (isConflict(err)) {
          await markConflict(item.itemId, err.body as ConflictBody);
          await db.outbox.delete(item.id);
          continue;
        }
        // 网络错误/其他服务端错误：停止本轮推送，保留队列等下次
        break;
      }
    }
  } finally {
    notifySyncChange();
  }
}

async function flushEntry(item: { op: string; itemId: string; baseVersion?: number }): Promise<void> {
  if (item.op === 'delete') {
    try {
      await api.remove(item.itemId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return; // 已不存在，视为成功
      throw err;
    }
    await db.entries.delete(item.itemId);
    return;
  }
  const local = await db.entries.get(item.itemId);
  if (!local || local.deletedAt) return;
  const draft = entryToDraft(local);
  if (item.op === 'create') {
    const created = await api.create({ ...draft, id: local.id });
    await db.entries.put({ ...created, deletedAt: undefined });
  } else {
    const updated = await api.update(item.itemId, draft, item.baseVersion ?? local.version);
    await db.entries.put({ ...updated, deletedAt: undefined, conflict: undefined, serverCopy: undefined });
  }
}

async function flushLink(item: { op: string; itemId: string }): Promise<void> {
  if (item.op === 'delete') {
    try {
      await api.removeLink(item.itemId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return;
      throw err;
    }
    await db.links.delete(item.itemId);
    return;
  }
  const local = await db.links.get(item.itemId);
  if (!local) return;
  const created = await api.createLink({
    id: local.id,
    sourceId: local.sourceId,
    targetId: local.targetId,
    relationType: local.relationType,
    description: local.description,
    strength: local.strength,
  });
  await db.links.put(created);
}

/** 409 冲突：保留双方，标记待用户裁决 */
async function markConflict(itemId: string, body: ConflictBody): Promise<void> {
  const serverRow = body.current;
  if (!serverRow) return;
  const local = await db.entries.get(itemId);
  if (!local) return;
  await db.entries.put({ ...local, conflict: true, serverCopy: serverRow });
}

/** 冲突裁决（见 store.ts 导出） */
export async function keepLocalVersion(id: string): Promise<Entry | undefined> {
  const e = await db.entries.get(id);
  if (!e?.serverCopy) return;
  const next: Entry = {
    ...e,
    ...entryToDraft(e),
    version: e.serverCopy.version,
    conflict: undefined,
    serverCopy: undefined,
    updatedAt: Date.now(),
  };
  await db.entries.put(next);
  await db.outbox.put({
    id: crypto.randomUUID(),
    kind: 'entry',
    op: 'update',
    itemId: id,
    baseVersion: next.version,
    queuedAt: Date.now(),
  });
  notifySyncChange();
  void flushOutbox();
  return next;
}

export async function keepServerVersion(id: string): Promise<Entry | undefined> {
  const e = await db.entries.get(id);
  if (!e?.serverCopy) return;
  const next: Entry = { ...e.serverCopy, deletedAt: undefined, conflict: undefined, serverCopy: undefined };
  await db.entries.put(next);
  await db.outbox.where('itemId').equals(id).delete();
  notifySyncChange();
  return next;
}
