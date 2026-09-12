import { useState } from 'react';
import { Link } from 'react-router-dom';
import EntryCard from '../components/EntryCard';
import { TYPES } from '../data';
import type { Entry, ExperienceType } from '../types';

export default function ExperienceListPage({ entries, knowledge = false }: { entries: Entry[]; knowledge?: boolean }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');

  const rows = entries.filter(e =>
    (knowledge ? e.kind === 'knowledge' : !e.isDefault) &&
    (!kind || e.kind === kind) &&
    `${e.title} ${e.content} ${e.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{knowledge ? '默认知识与个人知识' : '把片段编入你的世界'}</p>
          <h1>{knowledge ? '知识库' : '经历'}</h1>
        </div>
        <Link className="primary" to="/experience/new">+ {knowledge ? '新建知识' : '新建经历'}</Link>
      </header>
      <div className="filters">
        <input placeholder="搜索标题、正文或标签" value={q} onChange={e => setQ(e.target.value)} />
        {!knowledge && (
          <select value={kind} onChange={e => setKind(e.target.value)}>
            <option value="">全部类型</option>
            {(Object.entries(TYPES) as [ExperienceType, string][]).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        )}
      </div>
      <div className="cards">
        {rows.map(e => <EntryCard key={e.id} entry={e} />)}
        {!rows.length && <p className="muted">没有匹配的条目。</p>}
      </div>
    </>
  );
}
