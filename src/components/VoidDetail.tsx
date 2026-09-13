import { voidById } from '../data';
import type { VoidId } from '../types';

/**
 * 七空详情（第 3 轮丰满化）：把纲领 8.2–8.3 的世界观、编码特征、
 * 典型经历带进选择器旁，让"选空"从贴标签变成构建对世界的理解。
 */
export default function VoidDetail({ id }: { id: VoidId }) {
  const v = voidById(id);
  return (
    <div className="void-detail" style={{ borderColor: v.color }}>
      <div className="void-detail-head" style={{ background: v.color + '22' }}>
        <b>{v.symbol} {v.name} · {v.meaning}</b>
        <span style={{ color: v.color }}>{v.question}</span>
      </div>
      <p>{v.worldview}</p>
      <dl>
        <dt>形状</dt><dd>{v.shape}</dd>
        <dt>质感</dt><dd>{v.texture}</dd>
      </dl>
      <ul>
        {v.examples.map(ex => <li key={ex}>“{ex}”</li>)}
      </ul>
      <small className="void-guidance">{v.guidance}</small>
    </div>
  );
}
