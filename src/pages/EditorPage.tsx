import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import VoidBadge from '../components/VoidBadge';
import { COLORS, TYPES, VOIDS } from '../data';
import { db } from '../db';
import { removeEntry, resolveConflict, saveEntry } from '../store';
import type { Entry, EntryDraft, ExperienceType, Suggestion, VoidId } from '../types';

const emptyDraft = (): EntryDraft => ({
  kind: 'daily',
  title: '',
  content: '',
  primaryVoid: 'flow',
  secondaryVoids: [],
  tags: [],
  emotion: { valence: 0, intensity: 0.5, label: '' },
  encoding: { color: null },
  knowledge: { domain: '', taxonomy: [] },
  privacy: { aiVisible: false },
});

const toDraft = (e: Entry): EntryDraft => ({
  kind: e.kind,
  title: e.title,
  content: e.content,
  primaryVoid: e.primaryVoid,
  secondaryVoids: e.secondaryVoids ?? [],
  tags: e.tags ?? [],
  emotion: e.emotion ?? {},
  encoding: e.encoding ?? { color: null },
  knowledge: e.knowledge ?? {},
  privacy: e.privacy ?? {},
});

const fmt = (t: number) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(t);

export default function EditorPage({ refresh }: { refresh: () => Promise<void> }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft);
  const [full, setFull] = useState<Entry | null>(null); // 完整条目（含冲突/版本字段）
  const [loading, setLoading] = useState(id !== 'new');
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  useEffect(() => {
    if (id === 'new' || !id) {
      setLoading(false);
      return;
    }
    // 本地优先：从 IndexedDB 读取（离线也可编辑）
    void (async () => {
      const e = await db.entries.get(id);
      if (!e || e.deletedAt) {
        setError('未找到条目');
        setLoading(false);
        return;
      }
      setFull(e);
      setDraft(toDraft(e));
      setLoading(false);
    })();
  }, [id]);

  const update = <K extends keyof EntryDraft>(k: K, v: EntryDraft[K]) => setDraft(d => ({ ...d, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const saved = await saveEntry(id === 'new' || !id ? 'new' : id, draft);
      await refresh();
      nav('/experience/' + saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  };

  const del = async () => {
    if (!id) return;
    if (!window.confirm('确定删除这条经历？删除会先保存在本地，联网后同步到服务器。')) return;
    await removeEntry(id);
    await refresh();
    nav('/experiences');
  };

  const keepLocal = async () => {
    if (!id) return;
    const next = await resolveConflict(id, 'local');
    if (next) {
      setFull(next);
      setDraft(toDraft(next));
    }
  };

  const useServer = async () => {
    if (!id) return;
    const next = await resolveConflict(id, 'server');
    if (next) {
      setFull(next);
      setDraft(toDraft(next));
    }
  };

  const ai = async () => {
    if (!id) return;
    try {
      setSuggestion(await api.suggest(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '建议生成失败');
    }
  };

  if (loading) return <p>正在载入…</p>;

  return (
    <form className="editor" onSubmit={submit}>
      <header className="page-head">
        <div>
          <p className="eyebrow">{id === 'new' ? '新的星尘' : '编辑星尘'}</p>
          <h1>{id === 'new' ? '记录经历' : '编辑条目'}</h1>
        </div>
        <div className="actions">
          {id !== 'new' && <button type="button" className="secondary danger" onClick={del}>删除</button>}
          {id !== 'new' && <button type="button" className="secondary" onClick={ai}>AI 协助编码</button>}
          <button className="primary">保存</button>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      {full?.conflict && full.serverCopy && (
        <div className="suggestion">
          <b>⚠ 同步冲突</b>
          <p>此条目在另一处被修改过。云端版本：{fmt(full.serverCopy.updatedAt)}，标题"{full.serverCopy.title}"。</p>
          <p>请裁决：保留哪个版本？未裁决前，本地版本仍会继续使用。</p>
          <div className="actions">
            <button type="button" className="secondary" onClick={keepLocal}>保留本地版</button>
            <button type="button" className="secondary" onClick={useServer}>采用云端版</button>
          </div>
        </div>
      )}
      <div className="editor-grid">
        <section className="paper">
          <label>经历类型
            <select value={draft.kind} onChange={e => update('kind', e.target.value as ExperienceType)}>
              {(Object.entries(TYPES) as [ExperienceType, string][]).map(([k, n]) => <option value={k} key={k}>{n}</option>)}
            </select>
          </label>
          <label>标题
            <input required placeholder="给这段经历一个名字" value={draft.title} onChange={e => update('title', e.target.value)} />
          </label>
          <label>正文 <small>支持 Markdown；使用 [[标题]] 记录关联</small>
            <textarea rows={18} placeholder="此刻发生了什么？你感受到什么？" value={draft.content} onChange={e => update('content', e.target.value)} />
          </label>
          <label>标签 <small>用逗号分隔</small>
            <input value={draft.tags.join(', ')} onChange={e => update('tags', e.target.value.split(',').map(x => x.trim()).filter(Boolean))} />
          </label>
        </section>
        <aside className="coding">
          <h2>编码</h2>
          <label>主空
            <select value={draft.primaryVoid} onChange={e => update('primaryVoid', e.target.value as VoidId)}>
              {VOIDS.map(v => <option value={v.id} key={v.id}>{v.symbol} {v.name} — {v.meaning}</option>)}
            </select>
          </label>
          <label>附加空
            <div className="checklist">
              {VOIDS.filter(v => v.id !== draft.primaryVoid).map(v => (
                <label key={v.id}>
                  <input
                    type="checkbox"
                    checked={draft.secondaryVoids.includes(v.id)}
                    onChange={e => update(
                      'secondaryVoids',
                      e.target.checked ? [...draft.secondaryVoids, v.id] : draft.secondaryVoids.filter(x => x !== v.id)
                    )}
                  />
                  {v.symbol} {v.name}
                </label>
              ))}
            </div>
          </label>
          <label>情绪标签
            <input value={draft.emotion.label ?? ''} onChange={e => update('emotion', { ...draft.emotion, label: e.target.value })} />
          </label>
          <label>情绪效价 <b>{Number(draft.emotion.valence ?? 0).toFixed(1)}</b>
            <input type="range" min="-1" max="1" step=".1" value={draft.emotion.valence ?? 0} onChange={e => update('emotion', { ...draft.emotion, valence: Number(e.target.value) })} />
          </label>
          <label>情绪强度 <b>{Number(draft.emotion.intensity ?? 0).toFixed(1)}</b>
            <input type="range" min="0" max="1" step=".1" value={draft.emotion.intensity ?? 0} onChange={e => update('emotion', { ...draft.emotion, intensity: Number(e.target.value) })} />
          </label>
          <label>色块
            <select
              value={draft.encoding.color?.name ?? ''}
              onChange={e => {
                const c = COLORS.find(x => x.name === e.target.value);
                update('encoding', { ...draft.encoding, color: c ?? null });
              }}
            >
              <option value="">不设置</option>
              {COLORS.map(c => <option key={c.name} value={c.name}>{c.name} · {c.meaning}</option>)}
            </select>
          </label>
          <label className="ai-toggle">
            <input type="checkbox" checked={!!draft.privacy.aiVisible} onChange={e => update('privacy', { ...draft.privacy, aiVisible: e.target.checked })} />
            允许 AI 分析此条目
          </label>
          <small>AI 只会提出建议；保存分类或关系始终由你决定。</small>
          {suggestion && (
            <div className="suggestion">
              <b>待确认建议</b>
              <p>{suggestion.payload.reason}</p>
              <p>主空：<VoidBadge id={suggestion.payload.primaryVoid} /></p>
              <p>标签：{suggestion.payload.tags.join('、') || '无'}</p>
            </div>
          )}
        </aside>
      </div>
    </form>
  );
}
