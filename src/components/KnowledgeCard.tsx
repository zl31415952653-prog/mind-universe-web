import { Link } from 'react-router-dom';
import { voidById } from '../data';
import { stripMarkdown } from '../text';
import type { KnowledgeEntry } from '../types';

export default function KnowledgeCard({ k }: { k: KnowledgeEntry }) {
  const v = voidById(k.voidType);
  return (
    <Link to={'/knowledge/' + k.id} className="entry-card">
      <div>
        <span className="void-badge" style={{ '--c': v.color } as React.CSSProperties}>{v.symbol} {v.name}</span>
        <span className="kind">{k.domain || '未分类'}</span>
        {k.isDefault && <span className="kind default">默认知识</span>}
      </div>
      <h3>{k.title}</h3>
      <p>{stripMarkdown(k.content).slice(0, 110) || '尚未写下内容'}</p>
      <footer>
        {k.taxonomy.slice(0, 3).map(t => <i key={t}>#{t}</i>)}
        <span className="difficulty" title="难度">{'★'.repeat(k.difficulty)}{'☆'.repeat(5 - k.difficulty)}</span>
      </footer>
    </Link>
  );
}
