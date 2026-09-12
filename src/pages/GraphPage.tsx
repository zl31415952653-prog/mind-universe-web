import { Link } from 'react-router-dom';
import { voidById } from '../data';
import type { Entry, Link as LinkItem } from '../types';

/**
 * 关系图谱（过渡版）。
 * 当前仅为按位置散列的节点圆点；第 5 轮将替换为力导向图谱（Cytoscape），
 * 支持六类关系连线、筛选与 AI 建议边脉冲显示。
 */
export default function GraphPage({ entries, links }: { entries: Entry[]; links: LinkItem[] }) {
  const usable = entries.filter(e => !e.isDefault);
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">已确认的关系</p>
          <h1>关系图谱</h1>
        </div>
      </header>
      <div className="graph">
        {usable.map((e, i) => {
          const v = voidById(e.primaryVoid);
          return (
            <Link
              key={e.id}
              to={'/experience/' + e.id}
              style={{ left: `${12 + (i * 23) % 75}%`, top: `${15 + (i * 31) % 70}%`, background: v.color }}
              title={e.title}
            >
              {e.title.slice(0, 8)}
            </Link>
          );
        })}
        {links.length === 0 && (
          <p className="muted">关系会在后续版本中通过"关联条目"面板创建；双链文字已经可以记录在正文中。</p>
        )}
      </div>
      <p className="muted">当前显示 {usable.length} 个星尘与 {links.length} 条已确认关系。图谱布局将随着关系编辑功能继续增强。</p>
    </>
  );
}
