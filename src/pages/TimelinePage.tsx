import EntryCard from '../components/EntryCard';
import type { Entry } from '../types';

const fmt = (t: number) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(t);

/**
 * 时间线（过渡版）。
 * 当前按更新时间倒序排列；第 5 轮将支持按发生时间、日/周/月/年缩放与筛选。
 */
export default function TimelinePage({ entries }: { entries: Entry[] }) {
  const rows = [...entries.filter(e => !e.isDefault)].sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">时间锚点</p>
          <h1>时间线</h1>
        </div>
      </header>
      <div className="timeline">
        {rows.map(e => (
          <article key={e.id}>
            <time>{fmt(e.updatedAt)}</time>
            <EntryCard entry={e} />
          </article>
        ))}
      </div>
    </>
  );
}
