// Run locally; terminal output contains a bearer invitation. Never commit or share publicly.
import { randomBytes, createHash } from 'node:crypto';
const days = Number(process.argv[2] || 7);
if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('有效期为 1–30 天，例如 node scripts/create-invite.mjs 7');
const code = randomBytes(32).toString('hex');
const hash = createHash('sha256').update(code).digest('hex');
console.log('仅在将下方 SQL 写入目标数据库后邀请才生效。请勿把凭证发给 AI 或提交仓库。');
console.log(`邀请凭证（私下交给一位体验者）：${code}`);
console.log(`INSERT INTO account_invites(code_hash,expires_at) VALUES('${hash}',${Date.now()+days*86400000});`);
