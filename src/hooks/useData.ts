import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { db } from '../db';
import { ensureLocalSeed, flushOutbox, onSyncChange, pullSnapshot } from '../sync';
import type { Discovery, Entry, KnowledgeEntry, Link, User } from '../types';

/**
 * 用户数据加载（本地优先）：
 * 界面数据始终来自 IndexedDB；登录后先尝试拉取服务器快照（失败则用本地/兜底知识包），
 * 再推送待同步队列。监听同步事件与网络恢复，自动刷新界面与推送。
 */
export function useData(user: User | null) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const refresh = useCallback(async () => {
    const [e, l, k, p] = await Promise.all([db.entries.toArray(), db.links.toArray(), db.knowledge.toArray(), db.outbox.count()]);
    setEntries(e.filter(x => !x.deletedAt));
    setLinks(l);
    setKnowledge(k.filter(x => !x.deletedAt));
    setPendingCount(p);
  }, []);

  const refreshDiscoveries = useCallback(async () => {
    try {
      setDiscoveries(await api.discoveries());
    } catch {
      // 离线或未接入：忽略
    }
  }, []);

  const syncAll = useCallback(async () => {
    try {
      await pullSnapshot();
      await refreshDiscoveries();
    } catch {
      // 离线：保留本地数据；本地为空时用打包的默认知识库兜底
      await ensureLocalSeed();
    }
    await flushOutbox();
    await refresh();
  }, [refresh, refreshDiscoveries]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    void (async () => {
      await syncAll();
      setLoading(false);
    })();
  }, [user, syncAll]);

  useEffect(() => {
    const off = onSyncChange(() => void refresh());
    const goOnline = () => {
      setOnline(true);
      void syncAll();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      off();
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [refresh, syncAll]);

  return { entries, links, knowledge, discoveries, loading, refresh, refreshDiscoveries, pendingCount, online };
}
