import { Link } from 'react-router-dom';
import { TYPES } from '../data';
import type { Entry } from '../types';
import VoidBadge from './VoidBadge';

const fmt = (t: number) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(t);

export default function EntryCard({ entry }: { entry: Entry }) {
  return (
    <Link to={'/experience/' + entry.id} className="entry-card">
      <div>
        <VoidBadge id={entry.primaryVoid} />
        <span className="kind">{TYPES[entry.kind]}</span>
      </div>
      <h3>{entry.title}</h3>
      <p>{entry.content.slice(0, 125) || '尚未写下内容'}</p>
      <footer>
        {entry.tags.map(t => <i key={t}>#{t}</i>)}
        <time>{fmt(entry.updatedAt)}</time>
      </footer>
    </Link>
  );
}
