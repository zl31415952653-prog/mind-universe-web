import { useCallback, useEffect, useState } from 'react';
import { api, getToken } from '../api';
import type { Entry, Link, User } from '../types';

/**
 * 用户数据加载。
 * 修复原实现的问题：原代码只在组件挂载时拉取一次，登录发生在挂载之后，
 * 导致登录后列表为空、必须刷新页面才能看到数据。
 * 现在以 user 为依赖：登录（或会话恢复）后自动拉取。
 */
export function useData(user: User | null) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    setLoading(true);
    try {
      const [e, l] = await Promise.all([api.entries(), api.links()]);
      setEntries(e);
      setLinks(l);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  return { entries, links, loading, refresh };
}
