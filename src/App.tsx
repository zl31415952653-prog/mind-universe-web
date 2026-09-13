import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { api, ApiError, getToken, setToken } from './api';
import Shell from './components/Shell';
import { getMeta } from './db';
import { useData } from './hooks/useData';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import EditorPage from './pages/EditorPage';
import ExperienceListPage from './pages/ExperienceListPage';
import GraphPage from './pages/GraphPage';
import KnowledgeEditorPage from './pages/KnowledgeEditorPage';
import KnowledgeListPage from './pages/KnowledgeListPage';
import LearnPage from './pages/LearnPage';
import SettingsPage from './pages/SettingsPage';
import TimelinePage from './pages/TimelinePage';
import type { User } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const data = useData(user);

  useEffect(() => {
    // 会话恢复：有令牌先尝试在线校验；网络不可用时使用本地缓存的会话（离线模式）
    void (async () => {
      if (!getToken()) return;
      try {
        setUser(await api.me());
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setToken(null); // 令牌失效
          return;
        }
        const cached = await getMeta<User>('user');
        if (cached) setUser(cached);
      }
    })();
  }, []);

  if (!user) return <AuthPage onAuth={setUser} />;

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <Shell user={user} onLogout={logout} online={data.online} pendingCount={data.pendingCount}>
      <Routes>
        <Route path="/" element={<DashboardPage entries={data.entries} links={data.links} />} />
        <Route path="/universe" element={<DashboardPage entries={data.entries} links={data.links} />} />
        <Route path="/experiences" element={<ExperienceListPage entries={data.entries} />} />
        <Route path="/knowledge" element={<KnowledgeListPage knowledge={data.knowledge} refresh={data.refresh} />} />
        <Route path="/knowledge/:id" element={<KnowledgeEditorPage refresh={data.refresh} knowledge={data.knowledge} entries={data.entries} />} />
        <Route path="/experience/:id" element={<EditorPage refresh={data.refresh} entries={data.entries} />} />
        <Route path="/graph" element={<GraphPage entries={data.entries} links={data.links} />} />
        <Route path="/timeline" element={<TimelinePage entries={data.entries} />} />
        <Route path="/learn" element={<LearnPage entries={data.entries} />} />
        <Route path="/settings" element={<SettingsPage user={user} />} />
      </Routes>
    </Shell>
  );
}
