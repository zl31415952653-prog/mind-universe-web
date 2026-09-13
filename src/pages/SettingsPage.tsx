import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AuditEntry, Consent, User } from '../types';

const fmt = (t: number) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(t);

export default function SettingsPage({ user }: { user: User }) {
  const [message, setMessage] = useState('');
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [consents, setConsents] = useState<Consent[] | null>(null);
  const [grantee, setGrantee] = useState('');
  const [purpose, setPurpose] = useState('');
  const [expires, setExpires] = useState('');

  const loadSecurityData = async () => {
    try {
      const [a, c] = await Promise.all([api.audit(), api.consents()]);
      setAudit(a);
      setConsents(c);
    } catch {
      // 离线：留空提示
    }
  };

  useEffect(() => {
    void loadSecurityData();
  }, []);

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

  const createConsent = async () => {
    setMessage('');
    if (!grantee.trim() || !purpose.trim() || !expires) {
      setMessage('对象、目的与失效时间都必填');
      return;
    }
    const expiresAt = new Date(expires).getTime();
    if (expiresAt <= Date.now()) {
      setMessage('失效时间必须在未来');
      return;
    }
    try {
      await api.createConsent(grantee.trim(), purpose.trim(), expiresAt);
      setGrantee('');
      setPurpose('');
      setExpires('');
      await loadSecurityData();
      setMessage('已创建分享授权记录（可随时撤销）。');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '创建失败');
    }
  };

  const revoke = async (id: string) => {
    try {
      await api.revokeConsent(id);
      await loadSecurityData();
      setMessage('已撤销该授权。');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '撤销失败');
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
        <p>导出包含你可见的条目、关系与知识库。请把文件保存在安全的位置。</p>
        <button className="secondary" onClick={download}>导出 JSON 数据</button>
        {message && <p className="notice">{message}</p>}

        <h2>分享授权（consents）</h2>
        <p>当前版本的分享方式是<b>导出 JSON 后自行交付</b>，服务器不会把数据交给任何第三方。这里的授权记录为未来"AI 分析摘要分享"预留：指定对象、目的与失效时间，可随时撤销——任何分享都必须经你明确授权。</p>
        <div className="learn-input-row">
          <input placeholder="对象（如：李医生 ly@example.com）" value={grantee} onChange={e => setGrantee(e.target.value)} />
          <input placeholder="目的（如：心理辅导参考）" value={purpose} onChange={e => setPurpose(e.target.value)} />
          <input type="datetime-local" value={expires} onChange={e => setExpires(e.target.value)} />
          <button className="secondary" onClick={createConsent}>创建授权记录</button>
        </div>
        {consents && consents.length > 0 && (
          <div className="consent-list">
            {consents.map(c => (
              <div key={c.id} className="consent-row">
                <span>
                  <b>{c.grantee}</b> · {c.purpose}
                  <small>（{fmt(c.createdAt)} 创建 · {fmt(c.expiresAt)} 失效{c.revokedAt ? ' · 已撤销' : ''}）</small>
                </span>
                {!c.revokedAt && <button className="text danger" onClick={() => revoke(c.id)}>撤销</button>}
              </div>
            ))}
          </div>
        )}
        {consents && consents.length === 0 && <p className="muted">暂无授权记录。</p>}

        <h2>审计日志（最近 100 条）</h2>
        <p>登录、导出、分享、AI 请求与条目变更都会被记录（不含正文内容）。</p>
        {audit === null ? (
          <p className="muted">离线时无法获取审计日志。</p>
        ) : (
          <div className="audit-list">
            {audit.map((a, i) => (
              <div key={i} className="audit-row">
                <code>{a.action}</code>
                <time>{fmt(a.createdAt)}</time>
              </div>
            ))}
            {audit.length === 0 && <p className="muted">暂无审计记录。</p>}
          </div>
        )}

        <h2>隐私说明</h2>
        <p>条目默认不会发送给 AI。每一条内容需单独开启"允许 AI 分析"，AI 建议不会自动写入你的宇宙；每次 AI 调用都会记录提供商、模型与时间，可追溯。</p>
      </section>
    </>
  );
}
