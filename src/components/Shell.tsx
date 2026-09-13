import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import type { User } from '../types';

const NAV = [
  ['/universe', '宇宙'],
  ['/experiences', '经历'],
  ['/knowledge', '知识库'],
  ['/graph', '关系图谱'],
  ['/timeline', '时间线'],
  ['/learn', 'AI 学习'],
] as const;

interface Props {
  user: User;
  onLogout: () => void;
  children: ReactNode;
  online: boolean;
  pendingCount: number;
}

export default function Shell({ user, onLogout, children, online, pendingCount }: Props) {
  return (
    <div className="shell">
      <aside>
        <Link className="side-brand" to="/universe">∞ <span>心智宇宙</span></Link>
        <p className="user">{user.displayName}</p>
        <nav>
          {NAV.map(([to, name]) => <NavLink key={to} to={to}>{name}</NavLink>)}
        </nav>
        <div className="side-bottom">
          <div className="sync-status" title="数据保存在本地，联网时自动同步">
            {online ? (pendingCount ? `待同步 ${pendingCount} 条` : '☁ 已同步') : '◌ 离线模式（本地可用）'}
          </div>
          <Link to="/settings">设置与数据</Link>
          <button className="text" onClick={onLogout}>退出登录</button>
        </div>
      </aside>
      <section className="content">{children}</section>
    </div>
  );
}
