import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, setToken } from '../api';
import { setMeta } from '../db';
import type { User } from '../types';

export default function AuthPage({ onAuth }: { onAuth: (u: User) => void }) {
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const r = register
        ? await api.register(form.email, form.password, form.displayName)
        : await api.login(form.email, form.password);
      setToken(r.token);
      await setMeta('user', r.user); // 缓存会话，供离线模式恢复
      onAuth(r.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : '认证失败');
    }
  };

  return (
    <main className="auth">
      <section className="auth-card">
        <div className="brand">
          <span>∞</span>
          <h1>心智宇宙</h1>
          <p>记录服务于编码</p>
        </div>
        <h2>{register ? '创建你的宇宙' : '进入心智宇宙'}</h2>
        <form onSubmit={submit}>
          {register && (
            <label>称呼
              <input required value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} />
            </label>
          )}
          <label>邮箱
            <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>密码
            <input required minLength={8} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            <small>至少 8 位</small>
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary">{register ? '创建并进入' : '登录'}</button>
        </form>
        <button className="text" onClick={() => setRegister(!register)}>
          {register ? '已有账户？登录' : '没有账户？创建一个'}
        </button>
      </section>
    </main>
  );
}
