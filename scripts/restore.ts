/**
 * 备份恢复（第 8 轮）：解密并解包 scripts/backup.ts 生成的快照到 DATA_DIR。
 * 用法：npx tsx scripts/restore.ts <备份文件> [密码]
 * 注意：恢复会覆盖 DATA_DIR 中同名文件；恢复前建议对当前数据再做一次备份。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { dataRoot, uploadsRoot } from '../server/db.js';

const file = process.argv[2];
const password = process.argv[3] || process.env.BACKUP_PASSWORD;
if (!file || !password) {
  console.error('用法：npx tsx scripts/restore.ts <备份文件> <密码>');
  process.exit(1);
}

const buf = fs.readFileSync(path.resolve(file));
const MAGIC = 'INFINITYBCK1';
const magic = buf.subarray(0, MAGIC.length).toString('ascii');
if (magic !== MAGIC) {
  console.error('✗ 不是有效的备份文件');
  process.exit(1);
}
const salt = buf.subarray(MAGIC.length, MAGIC.length + 16);
const iv = buf.subarray(MAGIC.length + 16, MAGIC.length + 28);
const tag = buf.subarray(MAGIC.length + 28, MAGIC.length + 44);
const enc = buf.subarray(MAGIC.length + 44);
// salt/iv/tag/enc 偏移见上方 MAGIC 布局（12 + 16 + 12 + 16）

const key = crypto.pbkdf2Sync(password, salt, 100_000, 32, 'sha256');
const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(tag);
let plain: Buffer;
try {
  plain = Buffer.concat([decipher.update(enc), decipher.final()]);
} catch {
  console.error('✗ 解密失败：密码错误或文件损坏');
  process.exit(1);
}

const data = JSON.parse(zlib.gunzipSync(plain).toString('utf8')) as { files: Record<string, string> };
fs.mkdirSync(dataRoot, { recursive: true });
fs.mkdirSync(uploadsRoot, { recursive: true });
let count = 0;
for (const [rel, b64] of Object.entries(data.files)) {
  const target = path.join(dataRoot, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.from(b64, 'base64'));
  count += 1;
}
console.log(`✓ 恢复完成：${count} 个文件写入 ${dataRoot}`);
console.log('重启 API 服务后生效（PM2: pm2 restart infinity-api）。');
