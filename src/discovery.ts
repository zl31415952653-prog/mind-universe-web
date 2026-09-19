import type { DiscoverySuggestion, Entry, Relation } from './domain';

const ignored = new Set('我们你们他们这个那个一些一个已经正在因为所以但是如果可以需要知道自己什么怎么为什么时候今天事情感觉经历学习知识'.split(''));
function terms(entry: Entry) { return [...new Set((`${entry.title} ${entry.body}`).match(/[\u4e00-\u9fa5]{2,}|[A-Za-z][A-Za-z0-9-]{2,}/g)?.filter(word=>!ignored.has(word)) ?? [])]; }

/** 本地、可解释的关系发现：仅用重复出现的明确词语，不调用网络或模型。 */
export function discoverLocal(entries: Entry[], existing: Relation[]): DiscoverySuggestion[] {
  const output: DiscoverySuggestion[]=[];
  for(let left=0;left<entries.length;left+=1) for(let right=left+1;right<entries.length;right+=1) {
    const a=entries[left],b=entries[right];
    if(existing.some(relation=>(relation.from===a.id&&relation.to===b.id)||(relation.from===b.id&&relation.to===a.id))) continue;
    const shared=terms(a).filter(term=>terms(b).includes(term)).slice(0,3);
    if(shared.length<1) continue;
    output.push({id:crypto.randomUUID(),from:a.id,to:b.id,type:a.primaryVoid===b.primaryVoid?'resonance':'thread',reason:`两条记录都明确出现了「${shared.join('、')}」，这可能是一条值得由你检查的线索。`,sharedTerms:shared,status:'pending',createdAt:Date.now()});
  }
  return output.slice(0,8);
}
