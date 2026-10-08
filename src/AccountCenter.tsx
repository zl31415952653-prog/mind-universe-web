import { FormEvent, useEffect, useState } from 'react';
import type { Atlas } from './storage';
import './account.css';

type User = { id: string; email: string };
type Props = { atlas: Atlas; onRestore: (atlas: Atlas) => void };

function accountError(response: Response, fallback: string, action: 'account' | 'snapshot' = 'account') {
  if (response.status === 401) return action === 'snapshot' ? '登录已失效，请重新登录后再操作云端快照。' : '邮箱或密码不正确。如尚未注册，请切换到“创建账户”。';
  if (response.status === 409) return '该邮箱已注册，请返回“登录”。';
  if (response.status >= 500) return fallback || '账户服务暂时不可用，请稍后重试。';
  return fallback;
}

export default function AccountCenter({ atlas, onRestore }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [authConfig, setAuthConfig] = useState<{ provider: string; ready: boolean } | null>(null);

  useEffect(() => {
    void fetch('/api/auth/config').then(async response => {
      if (!response.ok) throw new Error('config');
      const value = await response.json() as { provider: string; ready: boolean };
      if (!['authing', 'legacy'].includes(value.provider)) throw new Error('config');
      setAuthConfig(value);
    }).catch(() => setMessage('账户服务未就绪；本地记录仍可使用。'));
    const url = new URL(window.location.href);
    const result = url.searchParams.get('account_result');
    const messages: Record<string, string> = {
      success: '认证回调已完成，正在核对本站登录状态。本地数据不会自动上传。',
      invalid: '登录校验已失效或不匹配，请重新发起登录。',
      cancelled: '登录已取消。本地资料不受影响。',
      provider: '认证服务未完成登录，请核对 Authing 的授权码和令牌配置。',
      verify_email: '请先在 Authing 验证邮箱，再重新登录。',
      existing_account: '该邮箱存在旧账户。为保护原快照，不会自动合并，请联系维护者进行迁移核对。',
      service: '登录接收失败，请维护者核对 D1 迁移及服务配置。本地资料仍保留。'
    };
    if (result) {
      setMessage(messages[result] || '请重新发起登录。');
      url.searchParams.delete('account_result');
      window.history.replaceState(null, '', url.href);
    }
    void fetch('/api/auth/me', { credentials: 'include' })
      .then(async response => response.ok ? (await response.json() as { user: User }).user : null)
      .then(setUser)
      .catch(() => setMessage('无法连接账户服务，请检查网络后重试。'));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, password })
      });
      const body = await response.json().catch(() => ({})) as { user?: User; error?: string };
      if (!response.ok) throw new Error(accountError(response, body.error || '暂时无法完成账户操作。'));
      setUser(body.user ?? null); setPassword('');
      setMessage(mode === 'login' ? '已登录。本地数据仍不会自动上传。' : '账户已创建。本地数据仍不会自动上传。');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '无法连接账户服务，请检查网络后重试。');
    } finally { setBusy(false); }
  };

  const push = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/atlas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(atlas) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(accountError(response, body.error || '同步失败。', 'snapshot'));
      setMessage('已将当前本地宇宙保存到你的云端快照。');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '无法连接账户服务，请检查网络后重试。'); }
    finally { setBusy(false); }
  };

  const pull = async () => {
    if (!window.confirm('下载云端快照会替换这台设备当前的本地内容。建议先使用“备份”导出当前数据。继续吗？')) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/atlas', { credentials: 'include' });
      const body = await response.json().catch(() => ({})) as { snapshot?: { payload: Atlas } | null; error?: string };
      if (!response.ok) throw new Error(accountError(response, body.error || '读取失败。', 'snapshot'));
      if (!body.snapshot) throw new Error('云端还没有保存过快照。');
      onRestore(body.snapshot.payload); setMessage('已恢复云端快照。');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '无法连接账户服务，请检查网络后重试。'); }
    finally { setBusy(false); }
  };

  const logout = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      if (!response.ok) throw new Error('退出登录暂时失败。');
      setUser(null); setMessage('已退出登录。本地资料仍保留在这台设备。');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '退出登录暂时失败。'); }
    finally { setBusy(false); }
  };

  if (user) return <section className="account-center" id="account"><p className="overline">SYNC & ACCOUNT</p><h3>{user.email}</h3><p>登录只用于你主动选择的云端同步。本地数据不会因登录而自动上传。</p><div className="account-actions"><button className="capture-button" disabled={busy} onClick={() => void push()}>保存到云端</button><button className="text-btn" disabled={busy} onClick={() => void pull()}>从云端恢复</button><button className="text-btn" disabled={busy} onClick={() => void logout()}>退出本站登录</button></div>{authConfig?.provider === 'authing' && <small>退出本站不等于退出 Authing；再次登录会重新要求认证。公用设备也请退出 Authing。</small>}{message && <p className="account-message">{message}</p>}</section>;

  if (!authConfig || authConfig.provider === 'authing') return <section className="account-center" id="account"><p className="overline">OPTIONAL CLOUD ACCOUNT</p><h3>登录以保存与恢复云端快照</h3><p>不登录也可使用本地记录。注册、邮箱验证和找回密码在 Authing 页面完成；本站不接收你的密码，登录不会上传笔记。</p><button className="capture-button" disabled={!authConfig?.ready || busy} onClick={() => window.location.assign('/api/auth/start')}>{!authConfig ? '正在检查账户入口…' : authConfig.ready ? '登录 / 注册 ↗' : '账户入口尚未配置'}</button>{message && <p className="account-message" role="status">{message}</p>}<small>点击后跳转至 Authing。本站会收到身份标识及已验证邮箱；云端快照仍需你主动保存。账户状态不代表云端备份已完成。</small></section>;

  return <section className="account-center" id="account"><p className="overline">OPTIONAL CLOUD ACCOUNT</p><h3>{mode === 'login' ? '登录以同步与恢复' : '创建账户以启用云端同步'}</h3><p>不登录也可完整使用本地记录。账户仅用于你主动选择的同步、额度与未来跨设备访问。</p><form onSubmit={event => void submit(event)}><label>邮箱<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></label><label>密码<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} minLength={10} required /></label><button className="capture-button" disabled={busy}>{busy ? '正在连接…' : mode === 'login' ? '登录' : '创建账户'}</button></form><button className="text-btn" onClick={() => { setMode(value => value === 'login' ? 'register' : 'login'); setMessage(''); }}>{mode === 'login' ? '没有账户？创建一个' : '已有账户？登录'}</button>{message && <p className="account-message">{message}</p>}<small>登录失败不影响本地笔记、学习与离线保存。若持续出现服务错误，请联系维护者核对线上日志。</small></section>;
}
