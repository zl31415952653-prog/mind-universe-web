import { saveKnowledge } from './store';
import type { VoidId } from './types';

/**
 * Obsidian vault 导入器（第 4 轮）：
 * 浏览器选择 vault 文件夹（webkitdirectory），读取 .md 文件，保留正文与 [[双链]]，
 * 以文件名作标题、子文件夹名作标签，按内容去重后写入知识库（离线可用）。
 */

export interface VaultImportOptions {
  domain: string;
  voidType: VoidId;
}

export interface VaultImportResult {
  imported: number;
  skipped: number;
}

/** 规范化标题：去掉 .md 与重复的 .md.md 后缀 */
export function cleanVaultTitle(fileName: string): string {
  return fileName.replace(/\.md\.md$/i, '.md').replace(/\.md$/i, '').trim();
}

/** 去掉 Obsidian YAML frontmatter（--- 块），正文保留 */
export function stripFrontmatter(content: string): string {
  if (content.startsWith('---\n')) {
    const end = content.indexOf('\n---', 4);
    if (end !== -1) return content.slice(end + 4).replace(/^\n/, '');
  }
  return content;
}

/** 子文件夹名作标签（去掉数字编号前缀，如 01_政策合规 → 政策合规） */
export function folderTags(relativePath: string): string[] {
  const parts = relativePath.split('/');
  if (parts.length < 2) return [];
  return parts.slice(0, -1).map(p => p.replace(/^\d+[_\s]*/, '')).filter(Boolean);
}

async function sha1(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function importVaultFiles(files: File[], opts: VaultImportOptions): Promise<VaultImportResult> {
  const mdFiles = files.filter(f =>
    f.name.toLowerCase().endsWith('.md') &&
    !f.webkitRelativePath.includes('.obsidian') &&
    !f.name.startsWith('~$') &&
    f.name.toLowerCase() !== 'readme.md'
  );
  const seen = new Map<string, string>(); // 内容哈希 → 标题（去重）
  let imported = 0;
  for (const f of mdFiles) {
    const content = stripFrontmatter(await f.text());
    const title = cleanVaultTitle(f.name);
    if (!title || !content.trim()) continue;
    const hash = await sha1(content);
    if (seen.has(hash)) continue;
    seen.set(hash, title);
    await saveKnowledge('new', {
      title,
      content,
      domain: opts.domain,
      voidType: opts.voidType,
      taxonomy: ['心理健康'],
      difficulty: 2,
      prerequisites: [],
      relatedEntries: [],
      tags: folderTags(f.webkitRelativePath),
    });
    imported += 1;
  }
  return { imported, skipped: mdFiles.length - imported };
}
