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

export default function Shell({ user, onLogout, children }: { user: User; onLogout: () => void; children: ReactNode }) {
  return (
    <div className="shell">
      <aside>
        <Link className="side-brand" to="/universe">∞ <span>心智宇宙</span></Link>
        <p className="user">{user.displayName}</p>
        <nav>
          {NAV.map(([to, name]) => <NavLink key={to} to={to}>{name}</NavLink>)}
        </nav>
        <div className="side-bottom">
          <Link to="/settings">设置与数据</Link>
          <button className="text" onClick={onLogout}>退出登录</button>
        </div>
      </aside>
      <section className="content">{children}</section>
    </div>
  );
}
