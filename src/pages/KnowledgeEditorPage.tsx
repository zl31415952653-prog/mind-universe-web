import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Markdown from '../components/Markdown';
import VoidDetail from '../components/VoidDetail';
import { VOIDS } from '../data';
import { db } from '../db';
import { removeKnowledge, resolveKnowledgeConflict, saveKnowledge } from '../store';
import type { Entry, KnowledgeDraft, KnowledgeEntry, VoidId } from '../types';

const emptyDraft = (): KnowledgeDraft => ({
  title: '',
  content: '',
  domain: '',
  voidType: 'mirror',
  taxonomy: [],
  difficulty: 2,
  prerequisites: [],
  relatedEntries: [],
  tags: [],
});

const toDraft = (k: KnowledgeEntry): KnowledgeDraft => ({
  title: k.title,
  content: k.content,
  domain: k.domain,
  voidType: k.voidType,
  taxonomy: k.taxonomy ?? [],
  difficulty: k.difficulty ?? 2,
  prerequisites: k.prerequisites ?? [],
  relatedEntries: k.relatedEntries ?? [],
  tags: k.tags ?? [],
});

const DIFFICULTY_LABELS = ['', '入门', '基础', '进阶', '熟练', '精深'];
const fmt = (t: number) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(t);

export default function KnowledgeEditorPage({ refresh, knowledge, entries }: {
  refresh: () => Promise<void>;
  knowledge: KnowledgeEntry[];
  entries: Entry[];
}) {
  const { id } = useParams();
  const nav = useNavigate();
  const [draft, setDraft] = useState<KnowledgeDraft>(emptyDraft);
  const [full, setFull] = useState<KnowledgeEntry | null>(null);
  const [loading, setLoading] = useState(id !== 'new');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [linkQ, setLinkQ] = useState('');

  const domains = useMemo(() => [...new Set(knowledge.map(k => k.domain).filter(Boolean))].sort(), [knowledge]);
  const linkable = knowledge.filter(k => k.id !== id && !k.deletedAt && `${k.title} ${k.domain}`.includes(linkQ));

  useEffect(() => {
    if (id === 'new' || !id) {
      setLoading(false);
      return;
    }
    void (async () => {
      const k = await db.knowledge.get(id);
      if (!k || k.deletedAt) {
        setError('未找到知识条目');
        setLoading(false);
        return;
      }
      setFull(k);
      setDraft(toDraft(k));
      setLoading(false);
    })();
  }, [id]);

  const update = <K extends keyof KnowledgeDraft>(key: K, v: KnowledgeDraft[K]) => setDraft(d => ({ ...d, [key]: v }));

  const toggleRel = (field: 'prerequisites' | 'relatedEntries', targetId: string) => {
    const cur = draft[field];
    const next = cur.includes(targetId) ? cur.filter(x => x !== targetId) : [...cur, targetId];
    update(field, next);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const saved = await saveKnowledge(id === 'new' || !id ? 'new' : id, draft);
      await refresh();
      nav('/knowledge/' + saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  };

  const del = async () => {
    if (!id) return;
    if (!window.confirm('确定删除这条知识？')) return;
    await removeKnowledge(id);
    await refresh();
    nav('/knowledge');
  };

  const keepLocal = async () => {
    if (!id) return;
    const next = await resolveKnowledgeConflict(id, 'local');
    if (next) {
      setFull(next);
      setDraft(toDraft(next));
    }
  };

  const useServer = async () => {
    if (!id) return;
    const next = await resolveKnowledgeConflict(id, 'server');
    if (next) {
      setFull(next);
      setDraft(toDraft(next));
    }
  };

  if (loading) return <p>正在载入…</p>;

  return (
    <form className="editor" onSubmit={submit}>
      <header className="page-head">
        <div>
          <p className="eyebrow">{full?.isDefault ? '默认知识条目' : '知识条目'}</p>
          <h1>{id === 'new' ? '新建知识' : '编辑知识'}</h1>
        </div>
        <div className="actions">
          {id !== 'new' && !full?.isDefault && <button type="button" className="secondary danger" onClick={del}>删除</button>}
          <button className="primary">保存</button>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      {full?.conflict && full.serverCopy && (
        <div className="suggestion">
          <b>⚠ 同步冲突</b>
          <p>此条目在另一处被修改过。云端版本：{fmt(full.serverCopy.updatedAt)}，标题"{full.serverCopy.title}"。</p>
          <div className="actions">
            <button type="button" className="secondary" onClick={keepLocal}>保留本地版</button>
            <button type="button" className="secondary" onClick={useServer}>采用云端版</button>
          </div>
        </div>
      )}
      <div className="editor-grid">
        <section className="paper">
          <label>标题
            <input required placeholder="知识条目的名字" value={draft.title} onChange={e => update('title', e.target.value)} />
          </label>
          <label>领域
            <input list="domain-list" placeholder="如：心理学 / 学习科学 / 你的自定义领域" value={draft.domain} onChange={e => update('domain', e.target.value)} />
            <datalist id="domain-list">
              {domains.map(d => <option key={d} value={d} />)}
            </datalist>
          </label>
          <label>分类学标签 <small>用逗号分隔，如：认知科学, 理论</small>
            <input value={draft.taxonomy.join(', ')} onChange={e => update('taxonomy', e.target.value.split(',').map(x => x.trim()).filter(Boolean))} />
          </label>
          <label>正文 <small>支持 Markdown 与 [[双链]]</small>
            <div className="content-tabs">
              <button type="button" className={mode === 'write' ? 'active' : ''} onClick={() => setMode('write')}>编辑</button>
              <button type="button" className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>预览</button>
            </div>
            {mode === 'write'
              ? <textarea rows={16} placeholder="写下这个概念：定义、来源、你自己的解释……" value={draft.content} onChange={e => update('content', e.target.value)} />
              : <div className="preview-box"><Markdown content={draft.content} entries={entries} knowledge={knowledge} /></div>}
          </label>
          <label>标签 <small>用逗号分隔</small>
            <input value={draft.tags.join(', ')} onChange={e => update('tags', e.target.value.split(',').map(x => x.trim()).filter(Boolean))} />
          </label>
        </section>
        <aside className="coding">
          <h2>结构化字段</h2>
          <label>七空归属
            <select value={draft.voidType} onChange={e => update('voidType', e.target.value as VoidId)}>
              {VOIDS.map(v => <option value={v.id} key={v.id}>{v.symbol} {v.name} — {v.meaning}</option>)}
            </select>
          </label>
          <VoidDetail id={draft.voidType} />
          <label>难度
            <select value={draft.difficulty} onChange={e => update('difficulty', Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} — {DIFFICULTY_LABELS[n]}</option>)}
            </select>
          </label>
          <div className="panel-block">
            <h3>前置知识</h3>
            <input placeholder="搜索知识条目…" value={linkQ} onChange={e => setLinkQ(e.target.value)} />
            <div className="link-picker">
              {linkable.slice(0, 30).map(k => (
                <label key={k.id}>
                  <input type="checkbox" checked={draft.prerequisites.includes(k.id)} onChange={() => toggleRel('prerequisites', k.id)} />
                  {k.title} <small>{k.domain}</small>
                </label>
              ))}
              {linkable.length === 0 && <small>没有匹配的条目</small>}
            </div>
            <small>当前已选 {draft.prerequisites.length} 条前置</small>
          </div>
          <div className="panel-block">
            <h3>相关知识</h3>
            <div className="link-picker">
              {linkable.slice(0, 30).map(k => (
                <label key={k.id}>
                  <input type="checkbox" checked={draft.relatedEntries.includes(k.id)} onChange={() => toggleRel('relatedEntries', k.id)} />
                  {k.title} <small>{k.domain}</small>
                </label>
              ))}
              {linkable.length === 0 && <small>没有匹配的条目</small>}
            </div>
            <small>当前已选 {draft.relatedEntries.length} 条相关</small>
          </div>
        </aside>
      </div>
    </form>
  );
}
