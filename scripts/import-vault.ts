/**
 * 一次性脚本：把《心理健康知识库_朱乐》Obsidian vault 的指定目录导入知识库。
 * 范围（用户 2026-09-13 确认）：01_政策合规 + 02_专业理论 + 专题三，领域=心理健康。
 * 幂等：条目 id 由相对路径哈希生成，重复运行不产生重复；按正文内容去重（.md 与 .md.md 同内容只收一条）。
 * 运行：npx tsx scripts/import-vault.ts [vault路径]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
// 复用服务端的建表与轻量迁移（保证旧库也补齐 knowledge_entries 等新表）
import db from '../server/db.js';

const VAULT = process.argv[2] || 'D:/HuaweiMoveData/Users/ROQU/Desktop/心理健康知识库_朱乐';
const SCOPE = ['01_政策合规', '02_专业理论', '专题三'];
const DOMAIN = '心理健康';
const VOID_TYPE = 'silence';

function sha1(text: string): string {
  return crypto.createHash('sha1').update(text).digest('hex');
}

function stripFrontmatter(content: string): string {
  if (content.startsWith('---\n')) {
    const end = content.indexOf('\n---', 4);
    if (end !== -1) return content.slice(end + 4).replace(/^\n/, '');
  }
  return content;
}

function cleanTitle(fileName: string): string {
  return fileName.replace(/\.md\.md$/i, '.md').replace(/\.md$/i, '').trim();
}

const users = db.prepare('SELECT id FROM users LIMIT 1').all() as { id: string }[];
if (users.length === 0) {
  console.error('✗ 数据库里没有用户（先启动过一次应用并注册/登录）');
  process.exit(1);
}
const ownerId = users[0].id;

const insert = db.prepare(`INSERT OR IGNORE INTO knowledge_entries
  (id,owner_id,title,content,domain,void_type,taxonomy,difficulty,prerequisites,related_entries,tags,is_default,created_at,updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

const seenContent = new Map<string, string>();
let imported = 0;
const skipped: string[] = [];
const list: string[] = [];

function walk(dir: string, base: string): { rel: string; name: string }[] {
  const out: { rel: string; name: string }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, base));
    else out.push({ rel: path.relative(base, abs).replace(/\\/g, '/'), name: entry.name });
  }
  return out;
}

for (const dir of SCOPE) {
  const full = path.join(VAULT, dir);
  if (!fs.existsSync(full)) {
    console.warn(`跳过不存在的目录：${dir}`);
    continue;
  }
  const files = walk(full, full).filter(f => f.name.toLowerCase().endsWith('.md'));
  const tag = dir.replace(/^\d+[_\s]*/, '');
  for (const f of files) {
    if (f.name.toLowerCase() === 'readme.md' || f.name.startsWith('~$')) continue;
    const abs = path.join(full, f.rel);
    const content = stripFrontmatter(fs.readFileSync(abs, 'utf8'));
    const title = cleanTitle(f.name);
    if (!title || !content.trim()) {
      skipped.push(`${dir}/${f.rel}（空文件）`);
      continue;
    }
    const hash = sha1(content);
    if (seenContent.has(hash)) {
      skipped.push(`${dir}/${f.rel}（与 ${seenContent.get(hash)} 内容重复）`);
      continue;
    }
    seenContent.set(hash, title);
    const entryId = 'vault-' + sha1(dir + '/' + f.rel).slice(0, 24);
    const t = Date.now();
    const r = insert.run(entryId, ownerId, title, content, DOMAIN, VOID_TYPE, JSON.stringify(['心理健康']), 2, '[]', '[]', JSON.stringify([tag]), 0, t, t);
    imported += Number(r.changes); // INSERT OR IGNORE：已存在时 changes 为 0
    if (r.changes) list.push(`${dir}/${f.rel} → 《${title}》`);
  }
}

console.log(`\n== 导入完成 ==`);
console.log(`导入 ${imported} 条（领域：${DOMAIN}，七空：${VOID_TYPE}，标签来自子文件夹）`);
console.log(`跳过 ${skipped.length} 个重复/无效文件`);
for (const s of skipped) console.log(`  - ${s}`);
console.log(`\n条目清单：`);
for (const l of list) console.log(`  ✓ ${l}`);

const total = db.prepare('SELECT COUNT(*) AS c FROM knowledge_entries WHERE owner_id=?').get(ownerId) as { c: number };
console.log(`\n当前知识库条目总数：${total.c}`);
