import type { Entry, Relation, Transition } from './domain';

export interface QuestionThread { id: string; title: string; entryIds: string[]; relationCount: number; }

/** 已确认关系的连通分量：它们不是自动主题，只是用户已经手动织出的线。 */
export function buildQuestionThreads(entries: Entry[], relations: Relation[]): QuestionThread[] {
  const graph = new Map<string, Set<string>>();
  for (const r of relations) {
    graph.set(r.from, new Set([...(graph.get(r.from) ?? []), r.to]));
    graph.set(r.to, new Set([...(graph.get(r.to) ?? []), r.from]));
  }
  const seen = new Set<string>(); const threads: QuestionThread[] = [];
  for (const id of graph.keys()) {
    if (seen.has(id)) continue;
    const group: string[] = []; const queue = [id]; seen.add(id);
    while (queue.length) { const current = queue.shift()!; group.push(current); for (const next of graph.get(current) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); } }
    const items = group.map(itemId => entries.find(e => e.id === itemId)).filter((e): e is Entry => !!e);
    const count = relations.filter(r => group.includes(r.from) && group.includes(r.to)).length;
    const anchor = [...items].sort((a,b) => (graph.get(b.id)?.size ?? 0) - (graph.get(a.id)?.size ?? 0))[0];
    if (anchor && items.length > 1) threads.push({ id: `thread-${anchor.id}`, title: anchor.title, entryIds: items.map(e => e.id), relationCount: count });
  }
  return threads.sort((a,b) => b.entryIds.length - a.entryIds.length);
}

export function pathFor(entryId: string, entry: Entry, transitions: Transition[]) {
  const moves = transitions.filter(t => t.entryId === entryId).sort((a,b) => a.createdAt - b.createdAt);
  const origin = moves[0]?.from ?? entry.primaryVoid;
  return { origin, moves, current: entry.primaryVoid };
}
