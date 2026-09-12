import { useState } from 'react';
import { api } from '../api';
import type { User } from '../types';

export default function SettingsPage({ user }: { user: User }) {
  const [message, setMessage] = useState('');

  const download = async () => {
    try {
      const data = await api.export();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      a.download = `infinity-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMessage('已导出你的数据。');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '导出失败');
    }
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">数据主权与偏好</p>
          <h1>设置</h1>
        </div>
      </header>
      <section className="settings">
        <h2>账户</h2>
        <p>{user.displayName} · {user.email}</p>
        <h2>数据导出</h2>
        <p>导出包含你可见的条目与关系。请把文件保存在安全的位置。</p>
        <button className="secondary" onClick={download}>导出 JSON 数据</button>
        {message && <p className="notice">{message}</p>}
        <h2>隐私说明</h2>
        <p>条目默认不会发送给 AI。每一条内容需单独开启"允许 AI 分析"，AI 建议不会自动写入你的宇宙。</p>
      </section>
    </>
  );
}
