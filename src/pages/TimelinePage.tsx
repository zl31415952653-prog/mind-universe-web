import { useState } from 'react';
import EntryCard from '../components/EntryCard';
import { TYPES } from '../data';
import type { Entry, ExperienceType } from '../types';

/**
 * 时间线（第 5 轮增强）：
 * 按发生时间（无则用创建时间）倒序排列，支持 日/周/月/年 缩放分组与类型筛选。
 */

type Zoom = 'day' | 'week' | 'month' | 'year';

const timeOf = (e: Entry): number => e.occurredAt ?? e.createdAt;

function groupKey(t: number, zoom: Zoom): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (zoom === 'year') return `${d.getFullYear()}`;
  if (zoom === 'month') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  if (zoom === 'week') {
    // ISO 周：以周一为一周起点
    const day = (d.getDay() + 6) % 7;
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function groupLabel(key: string, zoom: Zoom): string {
  if (zoom === 'year') return `${key} 年`;
  if (zoom === 'month') {
    const [y, m] = key.split('-');
    return `${y} 年 ${m} 月`;
  }
  if (zoom === 'week') {
    const [y, m, d] = key.split('-');
    return `${y} 年 ${m} 月 ${d} 日起的一周`;
  }
  const [y, m, d] = key.split('-');
  return `${y} 年 ${m} 月 ${d} 日`;
}

export default function TimelinePage({ entries }: { entries: Entry[] }) {
  const [zoom, setZoom] = useState<Zoom>('month');
  const [kind, setKind] = useState('');

  const rows = entries
    .filter(e => !e.isDefault && (!kind || e.kind === kind))
    .sort((a, b) => timeOf(b) - timeOf(a));

  const groups = new Map<string, Entry[]>();
  for (const e of rows) {
    const key = groupKey(timeOf(e), zoom);
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">时间锚点</p>
          <h1>时间线</h1>
          <p>按发生时间排列；没有填发生时间的条目使用创建时间。</p>
        </div>
      </header>
      <div className="filters">
        {(['day', 'week', 'month', 'year'] as Zoom[]).map(z => (
          <button key={z} className={'zoom-btn' + (zoom === z ? ' active' : '')} onClick={() => setZoom(z)}>
            {z === 'day' ? '日' : z === 'week' ? '周' : z === 'month' ? '月' : '年'}
          </button>
        ))}
        <select value={kind} onChange={e => setKind(e.target.value)}>
          <option value="">全部类型</option>
          {(Object.entries(TYPES) as [ExperienceType, string][]).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
      </div>
      <div className="timeline">
        {[...groups.entries()].map(([key, list]) => (
          <section key={key} className="timeline-group">
            <h3>{groupLabel(key, zoom)} <small>· {list.length} 条</small></h3>
            {list.map(e => (
              <article key={e.id}>
                <time>{new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(timeOf(e))}</time>
                <EntryCard entry={e} />
              </article>
            ))}
          </section>
        ))}
        {rows.length === 0 && <p className="muted">还没有经历；去记录第一条吧。</p>}
      </div>
    </>
  );
}
