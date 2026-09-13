import type { Entry } from './types';

/**
 * 基础版双链（已确认决策 #6）：`[[标题]]` 语法 + 反向链接面板。
 * 采用"实时解析"而非存储表——内容即真相，永不因标题改动/同步而失效；
 * note_links 持久化表在第 5 轮关系系统与图谱一并建设。
 */

const WIKI_RE = /\[\[([^\[\]]+)\]\]/g;

/** 从正文提取所有 [[双链]] 目标标题（去重） */
export function extractWikiLinks(content: string): string[] {
  const out = new Set<string>();
  for (const m of content.matchAll(WIKI_RE)) out.add(m[1].trim());
  return [...out];
}

/** 哪些条目链接到了给定标题 */
export function backlinksOf(entries: Entry[], title: string): Entry[] {
  if (!title.trim()) return [];
  return entries.filter(e => !e.deletedAt && extractWikiLinks(e.content).includes(title));
}

/** 按标题精确查找条目（[[双链]] 跳转解析） */
export function findEntryByTitle(entries: Entry[], title: string): Entry | undefined {
  return entries.find(e => !e.deletedAt && e.title.trim() === title);
}
