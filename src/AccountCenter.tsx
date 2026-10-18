import { FormEvent, useEffect, useState } from 'react';
import type { Atlas } from './storage';
import { accountActionError, checkAccount, readAccountResponse } from './accountState.js';
import './account.css';
type User = { id: string; username?: string; email?: string };
type Props = { atlas: Atlas; onRestore: (atlas: Atlas) => void };
type Mode = 'login' | 'register' | 'recover' | 'recovery-code';
export default function AccountCenter({ atlas, onRestore }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState(''), [password, setPassword] = useState('');
  const [invitation, setInvitation] = useState(''), [recoveryInput, setRecoveryInput] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false), [checking, setChecking] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    // Old callback query strings must not send the new flow back to email verification.
    const url = new URL(location.href);
    for (const key of ['account_result','account_stage','account_reason','account_status','account_error','account_ref']) url.searchParams.delete(key);
    history.replaceState(null, '', url.href);
  }, []);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    setChecking(true);
    void checkAccount(fetch, controller.signal).then(({ config, session }) => {
      if (!active) return;
      setReady(config.value?.provider === 'invite' && config.value.ready);
      setUser(session.value); setChecking(false);
      if (session.status === 'error' || config.status === 'error') setMessage('暂时无法确认账户状态，可重新检查；本地记录不受影响。');
    }).finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [retry]);
  async function request(path: string, body?: unknown, method = 'POST') {
    const response = await fetch(path, { method, credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(20000), headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    try { return await readAccountResponse(response); }
    catch (error) {
      if (response.status === 401 && path === '/api/atlas') setUser(null);
      throw error;
    }
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage(accountActionError(error)); }
    finally { setBusy(false); setPassword(''); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const data = await request(`/api/auth/${mode}`, { username, password, invitation, recoveryCode: recoveryInput }) as { recoveryCode?: string; message: string };
      setInvitation(''); setRecoveryInput('');
      if (data.recoveryCode) { setRecoveryCode(data.recoveryCode); setMessage(data.message); if (mode === 'recover') setUser(null); setMode('login'); return; }
      const { session } = await checkAccount(fetch, AbortSignal.timeout(12000));
      if (session.status !== 'ready' || !session.value?.username) throw new Error('凭证已提交，但未确认本站会话。请重新检查账户状态。');
      setUser(session.value); setMessage('已登录本站。本地记录没有上传，快照仍需你主动保存。');
    });
  }
  const changeMode = (next: Mode) => { setMode(next); setPassword(''); setInvitation(''); setRecoveryInput(''); setMessage(''); };
  return <section className="account-center" id="account">
    <p className="overline">LOCAL FIRST · INVITATION BETA</p>
    <h3>{checking ? '正在检查云端内测状态…' : user ? '已登录本站 ✓' : '本地直接使用 · 云端需内测账号'}</h3>
    <p>普通体验不需要注册。经历、知识和图谱保存在本机；换设备不会自动出现，清理浏览器数据可能导致记录丢失。请定期使用本窗口的“导出备份”，需要时“导入备份”。</p>
    <small>免登录不等于无限使用付费 AI。托管 AI 另有账号、额度和访问限制；登录不会自动上传笔记，云端快照需主动保存。</small>
    {recoveryCode ? <div className="account-recovery" role="status"><h4>请现在单独保存一次性恢复码</h4><p>请保存到密码管理器或安全的离线位置，不要发给维护者。此码不进入笔记备份，也不会再次显示。使用后旧码立即失效；同时丢失密码和恢复码时，不能仅凭口头声明重置账号。</p><code>{recoveryCode}</code><button className="capture-button" onClick={() => setRecoveryCode('')}>我已安全保存，继续</button></div> : <>
    {user && <><p>当前账号：{user.username || user.email}</p><div className="account-actions">
      <button className="capture-button" disabled={busy || checking} onClick={() => void run(async () => { await request('/api/atlas', atlas, 'PUT'); setMessage('当前本地数据已保存为此账号的云端快照。'); })}>主动保存云端快照</button>
      <button className="text-btn" disabled={busy || checking} onClick={() => { if (!confirm('恢复云端快照将替换本机数据。请先导出备份。继续吗？')) return; void run(async () => { const data = await request('/api/atlas', undefined, 'GET') as { snapshot?: { payload?: Atlas } }; const next = data.snapshot?.payload; if (!next || !['entries','knowledge','relations','transitions'].every(key => Array.isArray((next as unknown as Record<string, unknown>)[key]))) throw new Error('没有可恢复的有效快照。'); onRestore(next); setMessage('已恢复云端快照。'); }); }}>从云端恢复</button>
      <button className="text-btn" disabled={busy} onClick={() => void run(async () => { await request('/api/auth/logout'); setUser(null); setMode('login'); setMessage('已退出；本机记录仍保留。'); })}>退出登录</button>
      {user.username && <button className="text-btn" disabled={busy} onClick={() => changeMode('recovery-code')}>重新生成恢复码</button>}
    </div></>}
    {!checking && !ready && <p className="account-message">邀请制云端入口尚未启用或配置未就绪。无需再进行邮箱验证；你仍可直接使用本地记录。维护者需完成新版本部署与验收。</p>}
    {ready && (!user || mode === 'recovery-code') && <><h4>{mode === 'login' ? '内测账号登录' : mode === 'register' ? '凭邀请创建独立账号' : mode === 'recover' ? '使用恢复码重置密码' : '验证密码并更换恢复码'}</h4>
      <form onSubmit={submit}><fieldset disabled={busy || checking}>
        {mode !== 'recovery-code' && <label>用户名（3–32 位字母、数字或下划线，不区分大小写）<input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} pattern="[A-Za-z0-9_]{3,32}" required /></label>}
        {mode === 'register' && <label>邀请凭证<input type="password" autoComplete="off" value={invitation} onChange={event => setInvitation(event.target.value.trim())} required /></label>}
        {mode === 'recover' && <label>一次性恢复码<input type="password" autoComplete="off" value={recoveryInput} onChange={event => setRecoveryInput(event.target.value.trim())} required /></label>}
        <label>{mode === 'recover' ? '新密码' : '密码'}（15–128 个字符）<input type="password" autoComplete={mode === 'register' || mode === 'recover' ? 'new-password' : 'current-password'} minLength={15} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} required /></label>
        <button className="capture-button">{busy ? '正在处理…' : mode === 'login' ? '登录' : mode === 'register' ? '使用邀请创建账号' : mode === 'recover' ? '重置密码并使旧登录失效' : '生成新码，旧码立即失效'}</button>
      </fieldset></form>
      <div className="account-actions">{!user && <><button className="text-btn" disabled={busy} onClick={() => changeMode('login')}>已有内测账号</button><button className="text-btn" disabled={busy} onClick={() => changeMode('register')}>我有邀请凭证</button><button className="text-btn" disabled={busy} onClick={() => changeMode('recover')}>忘记密码</button></>}{user && <button className="text-btn" disabled={busy} onClick={() => changeMode('login')}>取消</button>}</div>
      <small>暂不开放自由注册，不需要邮箱。每人一个独立账号。旧 Authing 账号不会自动转换或合并；新账号不会自动取得旧账号的快照。</small>
    </>}
    </>}
    {message && <p className="account-message" role="status">{message}</p>}
    <button className="text-btn" disabled={busy || checking || !!recoveryCode} onClick={() => setRetry(value => value + 1)}>重新检查账户状态</button>
  </section>;
}
