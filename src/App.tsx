import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { api, getToken, setToken } from './api';
import Shell from './components/Shell';
import { useData } from './hooks/useData';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import EditorPage from './pages/EditorPage';
import ExperienceListPage from './pages/ExperienceListPage';
import GraphPage from './pages/GraphPage';
import LearnPage from './pages/LearnPage';
import SettingsPage from './pages/SettingsPage';
import TimelinePage from './pages/TimelinePage';
import type { User } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const data = useData(user);

  useEffect(() => {
    if (getToken()) api.me().then(setUser).catch(() => setToken(null));
  }, []);

  if (!user) return <AuthPage onAuth={setUser} />;

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <Shell user={user} onLogout={logout}>
      <Routes>
        <Route path="/" element={<DashboardPage entries={data.entries} links={data.links} />} />
        <Route path="/universe" element={<DashboardPage entries={data.entries} links={data.links} />} />
        <Route path="/experiences" element={<ExperienceListPage entries={data.entries} />} />
        <Route path="/knowledge" element={<ExperienceListPage entries={data.entries} knowledge />} />
        <Route path="/experience/:id" element={<EditorPage refresh={data.refresh} />} />
        <Route path="/graph" element={<GraphPage entries={data.entries} links={data.links} />} />
        <Route path="/timeline" element={<TimelinePage entries={data.entries} />} />
        <Route path="/learn" element={<LearnPage entries={data.entries} />} />
        <Route path="/settings" element={<SettingsPage user={user} />} />
      </Routes>
    </Shell>
  );
}
