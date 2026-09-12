import type { CSSProperties } from 'react';
import { voidById } from '../data';
import type { VoidId } from '../types';

export default function VoidBadge({ id }: { id: VoidId }) {
  const v = voidById(id);
  return (
    <span className="void-badge" style={{ '--c': v.color } as CSSProperties}>
      {v.symbol} {v.name}
    </span>
  );
}
