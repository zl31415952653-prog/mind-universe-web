import { Link } from 'react-router-dom';
import EntryCard from '../components/EntryCard';
import Universe from '../components/Universe';
import { VOIDS } from '../data';
import type { Entry, Link as LinkItem } from '../types';

export default function DashboardPage({ entries, links }: { entries: Entry[]; links: LinkItem[] }) {
  const mine = entries.filter(e => !e.isDefault);
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">你的认知数据面貌</p>
          <h1>心智宇宙</h1>
          <p>每颗星尘都是一段被你确认过的经历。</p>
        </div>
        <Link className="primary" to="/experience/new">+ 记录经历</Link>
      </header>
      <Universe entries={entries} links={links} />
      <section className="void-stats">
        {VOIDS.map(v => (
          <div key={v.id} style={{ borderColor: v.color }}>
            <b>{entries.filter(e => e.primaryVoid === v.id).length}</b>
            <span>{v.symbol} {v.name}</span>
            <small>{v.question}</small>
          </div>
        ))}
      </section>
      <section>
        <h2>最近星尘</h2>
        <div className="cards">
          {mine.slice(0, 6).map(e => <EntryCard key={e.id} entry={e} />)}
          {!mine.length && <p className="muted">从一条经历开始，宇宙会慢慢生长。</p>}
        </div>
      </section>
    </>
  );
}
