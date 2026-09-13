/**
 * 加密快照备份（第 8 轮）：
 * 把 DATA_DIR（SQLite + 附件）打包为 JSON 并 AES-256-GCM 加密，输出到 backups/。
 * 密码：命令行参数或 BACKUP_PASSWORD 环境变量。
 * 保留策略：默认保留最近 7 份（BACKUP_KEEP 可调），更早的备份文件自动删除。
 * 运行：npx tsx scripts/backup.ts [密码]
 * 恢复：npx tsx scripts/restore.ts <备份文件> [密码]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import db from '../server/db.js';
import { dataRoot, uploadsRoot } from '../server/db.js';

const password = process.argv[2] || process.env.BACKUP_PASSWORD;
if (!password) {
  console.error('用法：npx tsx scripts/backup.ts <备份密码>（或设 BACKUP_PASSWORD）');
  process.exit(1);
}

// 备份前做一致性检查点
db.exec('PRAGMA wal_checkpoint(TRUNCATE);');

const files: Record<string, string> = {};
for (const f of fs.readdirSync(dataRoot)) {
  const abs = path.join(dataRoot, f);
  if (fs.statSync(abs).isFile()) files[f] = fs.readFileSync(abs).toString('base64');
}
if (fs.existsSync(uploadsRoot)) {
  for (const f of fs.readdirSync(uploadsRoot)) {
    files['uploads/' + f] = fs.readFileSync(path.join(uploadsRoot, f)).toString('base64');
  }
}

const payload = zlib.gzipSync(Buffer.from(JSON.stringify({ exportedAt: Date.now(), files })));

// AES-256-GCM：密钥 = SHA-256(密码)，随机 salt/iv
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(password, salt, 100_000, 32, 'sha256');
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const enc = Buffer.concat([cipher.update(payload), cipher.final()]);
const tag = cipher.getAuthTag();

const backupDir = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.resolve('backups');
fs.mkdirSync(backupDir, { recursive: true });
const name = `infinity-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.enc`;
const out = Buffer.concat([Buffer.from('INFINITYBCK1'), salt, iv, tag, enc]);
fs.writeFileSync(path.join(backupDir, name), out);

// 保留最近 N 份
const keep = Number(process.env.BACKUP_KEEP || 7);
const backups = fs.readdirSync(backupDir).filter(f => f.endsWith('.enc')).sort();
for (const old of backups.slice(0, Math.max(0, backups.length - keep))) {
  fs.rmSync(path.join(backupDir, old));
  console.log(`清理旧备份：${old}`);
}

console.log(`✓ 备份完成：${path.join(backupDir, name)}（${(out.length / 1024 / 1024).toFixed(2)} MB，加密）`);
