import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import ColorPicker from '../components/ColorPicker';
import Markdown from '../components/Markdown';
import VoidBadge from '../components/VoidBadge';
import VoidDetail from '../components/VoidDetail';
import { TYPES, VOIDS } from '../data';
import { db } from '../db';
import { ALL_EMOTIONS, EMOTIONS_NEGATIVE, EMOTIONS_POSITIVE } from '../emotions';
import { backlinksOf } from '../links';
import { RELATION_TYPES, relationById } from '../relations';
import { SENSORY_OPTIONS } from '../sensory';
import { addLink, removeEntry, removeLinkLocal, resolveConflict, saveEntry } from '../store';
import { TEMPLATES } from '../templates';
import type { Entry, EntryDraft, EntryVersion, ExperienceType, Link as LinkItem, RelationType, SensoryEncoding, Suggestion, VoidId } from '../types';

const emptyDraft = (): EntryDraft => ({
  kind: 'daily',
  title: '',
  content: '',
  primaryVoid: 'flow',
  secondaryVoids: [],
  tags: [],
  emotion: { valence: 0, intensity: 0.5, label: '' },
  encoding: { color: null },
  sensory: {},
  knowledge: { domain: '', taxonomy: [] },
  privacy: { aiVisible: false },
  attachments: [],
  occurredAt: null,
  insight: false,
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
  sensory: e.sensory ?? {},
  knowledge: e.knowledge ?? {},
  privacy: e.privacy ?? {},
  attachments: e.attachments ?? [],
  occurredAt: e.occurredAt ?? null,
  insight: !!e.insight,
});

const fmt = (t: number) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(t);

const toLocalInput = (t?: number | null): string => {
  if (!t) return '';
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (s: string): number | null => (s ? new Date(s).getTime() : null);

export default function EditorPage({ refresh, entries, links }: { refresh: () => Promise<void>; entries: Entry[]; links: LinkItem[] }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft);
  const [full, setFull] = useState<Entry | null>(null); // 完整条目（含冲突/版本字段）
  const [loading, setLoading] = useState(id !== 'new');
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [uploading, setUploading] = useState(false);
  const [versions, setVersions] = useState<EntryVersion[] | null>(null);
  const [linkTarget, setLinkTarget] = useState('');
  const [linkType, setLinkType] = useState<RelationType>('similar');
  const [linkDesc, setLinkDesc] = useState('');

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

  const changeKind = (k: ExperienceType) => {
    setDraft(d => {
      const next = { ...d, kind: k };
      // 新建且正文为空时自动套用该类型模板（已有内容则不打扰）
      if (!next.content.trim()) next.content = TEMPLATES[k];
      return next;
    });
  };

  const insertTemplate = () => update('content', TEMPLATES[draft.kind] + '\n\n' + draft.content);

  const toggleSensory = (key: keyof SensoryEncoding, v: string) => {
    const cur = draft.sensory?.[key] ?? [];
    const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v];
    update('sensory', { ...draft.sensory, [key]: next });
  };

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

  const uploadFile = async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const att = await api.upload(file);
      update('attachments', [...(draft.attachments ?? []), att]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败（附件上传需要联网）');
    } finally {
      setUploading(false);
    }
  };

  const loadVersions = async () => {
    if (!id || id === 'new') return;
    setError('');
    try {
      setVersions(await api.versions(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取历史版本失败（需要联网）');
    }
  };

  const createRelation = async () => {
    if (!id || id === 'new' || !linkTarget) return;
    setError('');
    try {
      await addLink({ sourceId: id, targetId: linkTarget, relationType: linkType, description: linkDesc.trim() });
      setLinkTarget('');
      setLinkDesc('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立关系失败');
    }
  };

  const deleteRelation = async (linkId: string) => {
    await removeLinkLocal(linkId);
    await refresh();
  };

  if (loading) return <p>正在载入…</p>;

  const backlinks = full ? backlinksOf(entries, full.title) : [];
  const related = full ? links.filter(l => l.sourceId === full.id || l.targetId === full.id) : [];
  const linkableEntries = entries.filter(e => !e.isDefault && e.id !== full?.id);

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
            <select value={draft.kind} onChange={e => changeKind(e.target.value as ExperienceType)}>
              {(Object.entries(TYPES) as [ExperienceType, string][]).map(([k, n]) => <option value={k} key={k}>{n}</option>)}
            </select>
          </label>
          <label>标题
            <input required placeholder="给这段经历一个名字" value={draft.title} onChange={e => update('title', e.target.value)} />
          </label>
          <label>正文 <small>支持 Markdown；使用 [[标题]] 建立双链</small>
            <div className="content-tabs">
              <button type="button" className={mode === 'write' ? 'active' : ''} onClick={() => setMode('write')}>编辑</button>
              <button type="button" className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>预览</button>
              <button type="button" className="text" title="按当前类型插入模板" onClick={insertTemplate}>插入模板</button>
            </div>
            {mode === 'write'
              ? <textarea rows={18} placeholder="此刻发生了什么？你感受到什么？" value={draft.content} onChange={e => update('content', e.target.value)} />
              : <div className="preview-box"><Markdown content={draft.content} entries={entries} /></div>}
          </label>
          <label>标签 <small>用逗号分隔</small>
            <input value={draft.tags.join(', ')} onChange={e => update('tags', e.target.value.split(',').map(x => x.trim()).filter(Boolean))} />
          </label>
          <label>发生时间 <small>时间线锚点；日常经历建议填写（不填则用创建时间）</small>
            <input type="datetime-local" value={toLocalInput(draft.occurredAt)} onChange={e => update('occurredAt', fromLocalInput(e.target.value))} />
          </label>
          <label>附件 <small>图片/音频，单个不超过 10MB；上传需要联网，附件引用随保存写入条目</small>
            <div className="attachments">
              {(draft.attachments ?? []).map(a => (
                <span key={a.id} className="attachment-chip">
                  {a.name} <small>({Math.max(1, Math.round(a.size / 1024))}KB)</small>
                  <button type="button" title="移除引用" onClick={() => update('attachments', (draft.attachments ?? []).filter(x => x.id !== a.id))}>×</button>
                </span>
              ))}
              <input type="file" accept="image/*,audio/*" disabled={uploading} onChange={e => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(f);
                e.target.value = '';
              }} />
            </div>
          </label>
        </section>
        <aside className="coding">
          <h2>编码</h2>
          <label>主空
            <select value={draft.primaryVoid} onChange={e => update('primaryVoid', e.target.value as VoidId)}>
              {VOIDS.map(v => <option value={v.id} key={v.id}>{v.symbol} {v.name} — {v.meaning}</option>)}
            </select>
          </label>
          <VoidDetail id={draft.primaryVoid} />
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
            <input list="emotion-list" value={draft.emotion.label ?? ''} placeholder="输入或从下方选择" onChange={e => update('emotion', { ...draft.emotion, label: e.target.value })} />
            <datalist id="emotion-list">
              {ALL_EMOTIONS.map(e => <option key={e} value={e} />)}
            </datalist>
            <div className="emotion-chips">
              {EMOTIONS_POSITIVE.map(e => (
                <button key={e} type="button" className={'emotion-chip pos' + (draft.emotion.label === e ? ' on' : '')} onClick={() => update('emotion', { ...draft.emotion, label: e })}>{e}</button>
              ))}
              {EMOTIONS_NEGATIVE.slice(0, 8).map(e => (
                <button key={e} type="button" className={'emotion-chip neg' + (draft.emotion.label === e ? ' on' : '')} onClick={() => update('emotion', { ...draft.emotion, label: e })}>{e}</button>
              ))}
            </div>
          </label>
          <label>情绪效价 <b>{Number(draft.emotion.valence ?? 0).toFixed(1)}</b>
            <input type="range" min="-1" max="1" step=".1" value={draft.emotion.valence ?? 0} onChange={e => update('emotion', { ...draft.emotion, valence: Number(e.target.value) })} />
          </label>
          <label>情绪强度 <b>{Number(draft.emotion.intensity ?? 0).toFixed(1)}</b>
            <input type="range" min="0" max="1" step=".1" value={draft.emotion.intensity ?? 0} onChange={e => update('emotion', { ...draft.emotion, intensity: Number(e.target.value) })} />
          </label>
          <label>色块（中式色卡）
            <ColorPicker value={draft.encoding.color} onChange={c => update('encoding', { ...draft.encoding, color: c })} />
          </label>
          <label>感官编码 <small>形状/质感/角度/线条，可多选</small>
            <div className="sensory-groups">
              {SENSORY_OPTIONS.map(g => (
                <div key={g.key} className="sensory-group">
                  <em>{g.label}</em>
                  <div className="emotion-chips">
                    {g.values.map(v => {
                      const on = (draft.sensory?.[g.key] ?? []).includes(v);
                      return (
                        <button key={v} type="button" className={'emotion-chip' + (on ? ' on' : '')} onClick={() => toggleSensory(g.key, v)}>{v}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </label>
          <label className="ai-toggle">
            <input type="checkbox" checked={!!draft.privacy.aiVisible} onChange={e => update('privacy', { ...draft.privacy, aiVisible: e.target.checked })} />
            允许 AI 分析此条目
          </label>
          <label className="ai-toggle">
            <input type="checkbox" checked={!!draft.insight} onChange={e => update('insight', e.target.checked)} />
            标记为灵感（超新星 💥）
          </label>
          <small>AI 只会提出建议；保存分类或关系始终由你决定。</small>
          {suggestion && (
            <div className="suggestion">
              <b>待确认建议</b>
              <p>{suggestion.payload.reason}</p>
              <p>主空：<VoidBadge id={suggestion.payload.primaryVoid} /></p>
              <p>标签：{suggestion.payload.tags.join('、') || '无'}</p>
              {suggestion.payload.emotionLabel && <p>情绪：{suggestion.payload.emotionLabel}</p>}
            </div>
          )}
          {id !== 'new' && (
            <div className="panel-block">
              <h3>关联条目（关系）</h3>
              {related.length === 0 && <small>还没有关系；在下方选择目标与类型建立</small>}
              {related.map(l => {
                const other = entries.find(e => e.id === (l.sourceId === full?.id ? l.targetId : l.sourceId));
                const def = relationById(l.relationType);
                return (
                  <div key={l.id} className="relation-item">
                    <span style={{ color: def.color }} title={def.desc}>{def.label}</span>
                    <Link to={'/experience/' + other?.id}>{other?.title ?? '（已删除条目）'}</Link>
                    <small>{l.sourceId === full?.id ? '→' : '←'}</small>
                    <button type="button" title="删除关系" onClick={() => deleteRelation(l.id)}>×</button>
                  </div>
                );
              })}
              <select value={linkTarget} onChange={e => setLinkTarget(e.target.value)}>
                <option value="">选择关联的条目…</option>
                {linkableEntries.slice(0, 200).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
              <select value={linkType} onChange={e => setLinkType(e.target.value as RelationType)}>
                {RELATION_TYPES.map(r => <option key={r.id} value={r.id}>{r.label} — {r.desc}</option>)}
              </select>
              <input placeholder="关系说明（可选）" value={linkDesc} onChange={e => setLinkDesc(e.target.value)} />
              <button type="button" className="secondary" disabled={!linkTarget} onClick={createRelation}>建立关系</button>
            </div>
          )}
          {id !== 'new' && (
            <div className="panel-block">
              <h3>反向链接</h3>
              {backlinks.length === 0
                ? <small>没有条目链接到这里（在别的条目正文写 [[{full?.title ?? ''}]] 即可建立）</small>
                : backlinks.map(e => (
                  <Link key={e.id} className="backlink-item" to={'/experience/' + e.id}>
                    {e.title}
                  </Link>
                ))}
            </div>
          )}
          {id !== 'new' && (
            <div className="panel-block">
              <h3>历史版本 <button type="button" className="text" onClick={loadVersions}>{versions ? `${versions.length} 个` : '获取'}</button></h3>
              {versions?.length === 0 && <small>暂无历史版本（保存并同步后生成）</small>}
              {versions && versions.length > 0 && <small>点击版本载入编辑器，按"保存"后生效</small>}
              {versions?.map(v => (
                <div key={v.id} className="history-item">
                  <small>{fmt(v.createdAt)} · 第 {v.version} 版</small>
                  <button type="button" className="text" onClick={() => setDraft(toDraft(v.snapshot))}>
                    {v.snapshot.title || '（无标题）'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </form>
  );
}
