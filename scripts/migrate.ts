/**
 * 数据库迁移执行与校验（第 8 轮）：
 * 复用服务端建表逻辑（幂等：CREATE TABLE IF NOT EXISTS + ensureColumn 补列），
 * 输出迁移后的表与 entries 列清单，供上线前核对。
 * 运行：npm run migrate（或 npx tsx scripts/migrate.ts）
 * 回滚策略：迁移是幂等补列，无破坏性变更；升级前先跑 scripts/backup.ts，
 *   异常时恢复备份 + 切换回旧版本代码（见 deploy/DEPLOY.md）。
 */
import db from '../server/db.js';

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
const entryCols = db.prepare('PRAGMA table_info(entries)').all() as { name: string }[];
const knowledgeCols = db.prepare('PRAGMA table_info(knowledge_entries)').all() as { name: string }[];

console.log('== 迁移完成（幂等） ==');
console.log('表：', tables.map(t => t.name).join(', '));
console.log('entries 列：', entryCols.map(c => c.name).join(', '));
console.log('knowledge_entries 列：', knowledgeCols.map(c => c.name).join(', '));

// 校验关键列齐备（缺失说明旧库未迁移成功）
const requiredEntryCols = ['id', 'owner_id', 'kind', 'title', 'content', 'primary_void', 'secondary_voids', 'tags', 'emotion', 'encoding', 'knowledge', 'privacy', 'attachments', 'sensory', 'occurred_at', 'insight', 'source', 'created_at', 'updated_at', 'version', 'deleted_at'];
const missing = requiredEntryCols.filter(c => !entryCols.some(x => x.name === c));
if (missing.length > 0) {
  console.error(`✗ 缺少列：${missing.join(', ')}`);
  process.exit(1);
}
console.log('✓ entries 关键列齐备');
