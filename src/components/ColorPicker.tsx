import { useState } from 'react';
import { COLORS, COLOR_CATEGORIES, voidById } from '../data';
import type { ColorBlock } from '../types';

/**
 * 中式色卡选择器（第 3 轮）：色系筛选 + 色块网格 + 含义与空关联展示。
 * 颜色是视觉记忆的编码线索（决策 #9），不是装饰。
 */
export default function ColorPicker({ value, onChange }: { value: ColorBlock | null | undefined; onChange: (c: ColorBlock | null) => void }) {
  const [category, setCategory] = useState('全部');
  const [q, setQ] = useState('');

  const list = COLORS.filter(c =>
    (category === '全部' || c.category === category) &&
    (!q || c.name.includes(q))
  );

  return (
    <div className="color-picker">
      <div className="color-filters">
        {['全部', ...COLOR_CATEGORIES].map(cat => (
          <button key={cat} type="button" className={category === cat ? 'active' : ''} onClick={() => setCategory(cat)}>{cat}</button>
        ))}
        <input placeholder="搜色名" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="color-grid">
        {list.map(c => (
          <button
            key={c.name}
            type="button"
            className={'color-swatch' + (value?.name === c.name ? ' selected' : '')}
            style={{ background: c.hex }}
            title={`${c.name} · ${c.meaning}${c.voidId ? ` · 呼应${voidById(c.voidId).name}` : ''}`}
            onClick={() => onChange(value?.name === c.name ? null : c)}
          />
        ))}
      </div>
      <div className="color-selected">
        {value
          ? <span className="color-chip">
              <i style={{ background: value.hex }} />
              <b>{value.name}</b> <em>{value.hex}</em>
              <small>{value.meaning}{value.voidId ? ` · 呼应${voidById(value.voidId).name}` : ''}</small>
            </span>
          : <small className="muted">未选色块（从上方色卡中选择，颜色即编码）</small>}
      </div>
    </div>
  );
}
