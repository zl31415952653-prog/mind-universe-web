import { FormEvent, useEffect, useState } from 'react';
import type { Atlas } from './storage';
import './account.css';
import { checkAccount, callbackMessage } from './accountState.js';

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
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState('');
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'ready' | 'anonymous' | 'error'>('checking');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const url = new URL(window.location.href);
    const resultMessage = callbackMessage(url.searchParams);
    if (resultMessage) {
      setMessage(resultMessage);
      for (const name of ['account_result', 'account_stage', 'account_reason', 'account_ref']) url.searchParams.delete(name);
      window.history.replaceState(null, '', url.href);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    setChecking(true); setCheckError(''); setSessionStatus('checking');
    void checkAccount(fetch, controller.signal).then(({ config, session }) => {
      if (!active) return;
      setAuthConfig(config.value); setUser(session.value); setSessionStatus(session.status);
      setChecking(false);
      if (session.status === 'ready') {
        setMessage('已确认本站登录成功。本地笔记没有因登录而上传，云端快照仍需你主动保存。');
      } else if (session.status === 'anonymous') {
        setMessage(previous => previous.startsWith('认证已返回') ? '认证已返回，但本站未建立有效登录会话。请重新登录；若再次失败，由维护者排查。' : previous);
      }
      if (config.status === 'error' || session.status === 'error') {
        setCheckError(session.status === 'ready' ? '本站登录已确认，但账户入口配置检查失败，可重新检查。本地记录不受影响。' : session.status === 'anonymous' ? '本站当前未登录；账户入口检查失败，可重新检查。本地记录不受影响。' : '账户状态检查失败或超时，暂时无法确认登录。请点击“重新检查”；本地记录不受影响。');
      }
    }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [retry]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, password })
      });
      const body = await response.json().catch(() => ({})) as { user?: User; error?: string };
      if (!response.ok) throw new Error(accountError(response, body.error || '暂时无法完成账户操作。'));
      if (!body.user?.id || !body.user.email) throw new Error('账户返回信息不完整，尚未确认登录成功。');
      setUser(body.user); setSessionStatus('ready'); setPassword('');
      setMessage(mode === 'login' ? '已登录。本地数据仍不会自动上传。' : '账户已创建。本地数据仍不会自动上传。');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '无法连接账户服务，请检查网络后重试。');
    } finally { setBusy(false); }
  };

  const push = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/atlas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(atlas) });
      if (response.status === 401) { setUser(null); setSessionStatus('anonymous'); }
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
      if (response.status === 401) { setUser(null); setSessionStatus('anonymous'); }
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
      setUser(null); setSessionStatus('anonymous'); setMessage('已退出登录。本地资料仍保留在这台设备。');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '退出登录暂时失败。'); }
    finally { setBusy(false); }
  };

  const statusText = checking ? '正在确认本站登录状态…' : sessionStatus === 'error' ? '登录状态未知 · 检查失败' : '未登录本站';
  const checkFeedback = <>{checkError && <p className="account-message" role="status">{checkError}</p>}{!checking && <button className="text-btn" disabled={busy} onClick={() => setRetry(value => value + 1)}>重新检查账户状态</button>}</>;

  if (user && !checking) return <section className="account-center" id="account"><p className="overline">ACCOUNT VERIFIED</p><h3>已登录本站 ✓</h3><p>当前账户：{user.email}</p><p>本地笔记不会自动上传。登录成功不代表已保存云端快照。</p><div className="account-actions"><button className="capture-button" disabled={busy} onClick={() => void push()}>保存到云端</button><button className="text-btn" disabled={busy} onClick={() => void pull()}>从云端恢复</button><button className="text-btn" disabled={busy} onClick={() => void logout()}>退出本站登录</button></div>{authConfig?.provider === 'authing' && <small>退出本站不等于退出 Authing；再次登录会重新要求认证。公用设备也请退出 Authing。</small>}{message && <p className="account-message" role="status">{message}</p>}{checkFeedback}</section>;

  if (!authConfig || authConfig.provider === 'authing') return <section className="account-center" id="account"><p className="overline">OPTIONAL CLOUD ACCOUNT</p><h3>{statusText}</h3><p>登录后可主动保存与恢复云端快照。不登录也可使用本地记录。注册、邮箱验证和找回密码在 Authing 页面完成；本站不接收你的密码。</p><button className="capture-button" disabled={checking || !authConfig?.ready || busy} onClick={() => window.location.assign('/api/auth/start')}>{checking ? '正在检查账户入口…' : !authConfig ? '账户入口检查失败' : authConfig.ready ? '登录 / 注册 ↗' : '账户入口尚未配置'}</button>{message && <p className="account-message" role="status">{message}</p>}{checkFeedback}<small>点击后跳转至 Authing。只有返回本站并显示“已登录本站”及账户邮箱，才表示本站登录成功；云端快照仍需你主动保存。</small></section>;

  return <section className="account-center" id="account"><p className="overline">OPTIONAL CLOUD ACCOUNT</p><h3>{mode === 'login' ? '登录以同步与恢复' : '创建账户以启用云端同步'}</h3><p>不登录也可完整使用本地记录。账户仅用于你主动选择的同步、额度与未来跨设备访问。</p><form onSubmit={event => void submit(event)}><label>邮箱<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></label><label>密码<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} minLength={10} required /></label><button className="capture-button" disabled={busy}>{busy ? '正在连接…' : mode === 'login' ? '登录' : '创建账户'}</button></form><button className="text-btn" onClick={() => { setMode(value => value === 'login' ? 'register' : 'login'); setMessage(''); }}>{mode === 'login' ? '没有账户？创建一个' : '已有账户？登录'}</button>{message && <p className="account-message">{message}</p>}<small>登录失败不影响本地笔记、学习与离线保存。若持续出现服务错误，请联系维护者核对线上日志。</small></section>;
}
