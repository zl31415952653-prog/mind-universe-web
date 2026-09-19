import type { Entry, Relation, Transition, VoidId } from './domain';
import { getVoid } from './domain';

export interface Reflection {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  entryIds: string[];
}

/**
 * 回望只从用户已有数据中归纳；不做心理诊断，也不输出人格结论。
 * 每张卡都保留 entryIds，让用户能回到原始经历核对或拒绝该观察。
 */
export function buildReflections(entries: Entry[], relations: Relation[], transitions: Transition[]): Reflection[] {
  const mine = entries.filter(e => !e.id.startsWith('seed-'));
  const base = mine.length ? mine : entries;
  if (!base.length) return [];
  const cards: Reflection[] = [];
  const byVoid = new Map<VoidId, Entry[]>();
  for (const entry of base) byVoid.set(entry.primaryVoid, [...(byVoid.get(entry.primaryVoid) ?? []), entry]);
  const dominant = [...byVoid.entries()].sort((a,b) => b[1].length - a[1].length)[0];
  if (dominant && dominant[1].length >= 2) {
    const v = getVoid(dominant[0]);
    cards.push({ id: `void-${v.id}`, eyebrow: 'A PATTERN IN YOUR ATLAS', title: `最近，你常从「${v.name}」看世界。`, body: `有 ${dominant[1].length} 段经历停在${v.worldview}。这不是定义你，只是提示：也许可以轻轻问问自己——${v.question}`, entryIds: dominant[1].map(e => e.id) });
  }
  const degree = new Map<string, number>();
  for (const r of relations) { degree.set(r.from, (degree.get(r.from) ?? 0) + 1); degree.set(r.to, (degree.get(r.to) ?? 0) + 1); }
  const bridge = [...degree.entries()].sort((a,b) => b[1] - a[1])[0];
  if (bridge && bridge[1] >= 2) {
    const entry = entries.find(e => e.id === bridge[0]);
    if (entry) cards.push({ id: `bridge-${entry.id}`, eyebrow: 'A BRIDGE APPEARS', title: `「${entry.title}」正在成为一座桥。`, body: `你已经确认它与 ${bridge[1]} 段经历有关。与其急着给出结论，不如看看这些连接共同指向了哪个问题。`, entryIds: [entry.id, ...relations.filter(r => r.from === entry.id || r.to === entry.id).map(r => r.from === entry.id ? r.to : r.from)] });
  }
  if (transitions.length) {
    const recent = [...transitions].sort((a,b) => b.createdAt - a.createdAt)[0];
    const entry = entries.find(e => e.id === recent.entryId);
    if (entry) cards.push({ id: `move-${recent.id}`, eyebrow: 'A MOVEMENT YOU CONFIRMED', title: `一段经历从「${getVoid(recent.from).name}」走向了「${getVoid(recent.to).name}」。`, body: recent.reason || `这是你对「${entry.title}」当前位置的新理解。你随时可以重新看待它。`, entryIds: [entry.id] });
  }
  const unlinked = base.filter(e => !degree.has(e.id));
  if (unlinked.length >= 2) cards.push({ id: 'quiet-stars', eyebrow: 'QUIET STARS', title: `还有 ${unlinked.length} 颗星尘暂时独自发光。`, body: '独立不等于缺失。等到某一天你想起它们之间的回声，再建立联系也不迟。', entryIds: unlinked.slice(0, 4).map(e => e.id) });
  return cards.slice(0, 3);
}
