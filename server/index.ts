import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import db, { uploadsRoot } from './db.js';
import { defaultKnowledge } from './defaultKnowledge.js';
import { requireUser, tokenFor } from './auth.js';
import type { AttachmentMeta, AttachmentRow, EntryRow, LinkRow, UserRow, VersionRow } from './domain.js';

const app = express();
const port = Number(process.env.PORT || 8787);

// CORS 白名单：未配置 CLIENT_ORIGIN 时不发送跨域头（仅允许同源）。
// 开发模式下 Vite 已代理 /api，浏览器视角是同源，无需放宽。
const allowedOrigins = (process.env.CLIENT_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false }));
app.use(express.json({ limit: '1mb' }));

const id = (): string => crypto.randomUUID();
const now = () => Date.now();
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const parse = <T,>(value: unknown, fallback: T): T => {
  try { return JSON.parse(String(value)) as T; } catch { return fallback; }
};

// node:sqlite 返回 Record<string, SQLOutputValue>，行转换函数统一接收通用记录再转强类型
type SqlRow = Record<string, unknown>;

const rowToEntry = (row: SqlRow) => row && ({
  ...row,
  isDefault: !!row.is_default,
  primaryVoid: row.primary_void,
  secondaryVoids: parse<string[]>(row.secondary_voids, []),
  tags: parse<string[]>(row.tags, []),
  emotion: parse<Record<string, unknown>>(row.emotion, {}),
  encoding: parse<Record<string, unknown>>(row.encoding, {}),
  knowledge: parse<Record<string, unknown>>(row.knowledge, {}),
  privacy: parse<Record<string, unknown>>(row.privacy, {}),
  attachments: parse<AttachmentMeta[]>(row.attachments, []),
  sensory: parse<Record<string, unknown>>(row.sensory, {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

const rowToLink = (row: SqlRow) => row && ({
  id: row.id,
  sourceId: row.source_id,
  targetId: row.target_id,
  relationType: row.relation_type,
  description: row.description,
  strength: row.strength,
  source: row.source,
  status: row.status,
  createdAt: row.created_at,
});

const rowToVersion = (row: SqlRow) => row && ({
  id: row.id,
  entryId: row.entry_id,
  version: row.version,
  snapshot: parse<Record<string, unknown>>(row.snapshot, {}),
  createdAt: row.created_at,
});

function audit(ownerId: string, action: string, metadata: Record<string, unknown> = {}): void {
  db.prepare('INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?)').run(id(), ownerId, action, JSON.stringify(metadata), now());
}

// 认证接口限流：同一 IP 15 分钟内最多 10 次登录/注册尝试
const authWindows = new Map<string, { start: number; count: number }>();
function authLimiter(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const win = authWindows.get(ip);
  const t = now();
  if (win && t - win.start < 15 * 60 * 1000 && win.count >= 10) {
    res.status(429).json({ error: '认证尝试次数过多，请 15 分钟后再试' });
    return;
  }
  if (!win || t - win.start >= 15 * 60 * 1000) authWindows.set(ip, { start: t, count: 0 });
  authWindows.get(ip)!.count += 1;
  next();
}

function seedDefaults(userId: string): void {
  const insert = db.prepare(`INSERT OR IGNORE INTO entries (id,owner_id,kind,title,content,primary_void,tags,is_default,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const t = now();
  for (const [key, title, kind, voidType, tags, content] of defaultKnowledge) {
    insert.run(String(key + '-' + userId), userId, kind, title, content, voidType, JSON.stringify(tags), 1, t, t);
  }
}

// ---------- 认证 ----------
app.get('/api/health', (_req, res) => res.json({ ok: true, time: now() }));
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { email, password, displayName } = (req.body ?? {}) as { email?: string; password?: string; displayName?: string };
  if (!email || !password || password.length < 8) {
    res.status(400).json({ error: '邮箱和至少 8 位密码为必填项' });
    return;
  }
  try {
    const user = { id: id(), email: email.trim().toLowerCase(), displayName: displayName?.trim() || '探索者' };
    db.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run(user.id, user.email, await bcrypt.hash(password, 12), user.displayName, now());
    seedDefaults(user.id);
    audit(user.id, 'register');
    res.status(201).json({ user, token: tokenFor(user) });
  } catch {
    res.status(409).json({ error: '该邮箱已注册' });
  }
});
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const email = (req.body?.email ?? '').toString().trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email) as UserRow | undefined;
  if (!user || !(await bcrypt.compare(String(req.body?.password ?? ''), user.password_hash))) {
    res.status(401).json({ error: '邮箱或密码错误' });
    return;
  }
  audit(user.id, 'login');
  res.json({ user: { id: user.id, email: user.email, displayName: user.display_name }, token: tokenFor(user) });
});
app.get('/api/me', requireUser, (req, res) => {
  const u = db.prepare('SELECT id,email,display_name FROM users WHERE id=?').get(req.user!.sub) as UserRow | undefined;
  if (!u) { res.status(404).json({ error: '用户不存在' }); return; }
  res.json({ id: u.id, email: u.email, displayName: u.display_name });
});

// ---------- 条目 ----------
app.get('/api/entries', requireUser, (req, res) => {
  const q = String(req.query.q || '').trim();
  const kind = req.query.kind;
  const voidType = req.query.void;
  let sql = 'SELECT * FROM entries WHERE owner_id=? AND deleted_at IS NULL';
  const args: string[] = [req.user!.sub];
  if (kind) { sql += ' AND kind=?'; args.push(String(kind)); }
  if (voidType) { sql += ' AND (primary_void=? OR secondary_voids LIKE ?)'; args.push(String(voidType), `%${String(voidType)}%`); }
  if (q) { sql += ' AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)'; args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  sql += ' ORDER BY updated_at DESC';
  res.json(db.prepare(sql).all(...args).map(rowToEntry));
});
app.get('/api/entries/:id', requireUser, (req, res) => {
  const e = db.prepare('SELECT * FROM entries WHERE id=? AND owner_id=? AND deleted_at IS NULL').get(req.params.id, req.user!.sub) as EntryRow | undefined;
  if (!e) { res.status(404).json({ error: '未找到条目' }); return; }
  res.json(rowToEntry(e));
});
app.post('/api/entries', requireUser, (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  if (!(b.title as string | undefined)?.trim() || !b.kind || !b.primaryVoid) {
    res.status(400).json({ error: '标题、类型和主空为必填项' });
    return;
  }
  // 接受客户端生成的 UUID（离线创建同步时幂等：重推同一 id 不产生重复）
  const entryId = uuidRe.test(String(b.id || '')) ? String(b.id) : id();
  const entry = {
    id: entryId,
    ownerId: req.user!.sub,
    kind: String(b.kind),
    title: String(b.title).trim(),
    content: String(b.content || ''),
    primaryVoid: String(b.primaryVoid),
    secondaryVoids: (b.secondaryVoids as unknown[]) || [],
    tags: (b.tags as unknown[]) || [],
    emotion: (b.emotion as Record<string, unknown>) || {},
    encoding: (b.encoding as Record<string, unknown>) || {},
    knowledge: (b.knowledge as Record<string, unknown>) || {},
    privacy: { aiVisible: false, ...((b.privacy as Record<string, unknown>) || {}) },
    attachments: (b.attachments as unknown[]) || [],
    sensory: (b.sensory as Record<string, unknown>) || {},
    source: (b.source as string | null | undefined) || null,
    t: now(),
  };
  try {
    db.prepare(`INSERT INTO entries (id,owner_id,kind,title,content,primary_void,secondary_voids,tags,emotion,encoding,knowledge,privacy,attachments,sensory,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(entry.id, entry.ownerId, entry.kind, entry.title, entry.content, entry.primaryVoid, JSON.stringify(entry.secondaryVoids), JSON.stringify(entry.tags), JSON.stringify(entry.emotion), JSON.stringify(entry.encoding), JSON.stringify(entry.knowledge), JSON.stringify(entry.privacy), JSON.stringify(entry.attachments), JSON.stringify(entry.sensory), entry.source, entry.t, entry.t);
    audit(entry.ownerId, 'entry.create', { entryId: entry.id });
    res.status(201).json(rowToEntry(db.prepare('SELECT * FROM entries WHERE id=?').get(entry.id) as EntryRow));
  } catch (err) {
    const existing = db.prepare('SELECT * FROM entries WHERE id=? AND owner_id=?').get(entry.id, entry.ownerId) as EntryRow | undefined;
    if (existing) { res.status(200).json(rowToEntry(existing)); return; } // 重复推送：返回已存在条目
    throw err;
  }
});
app.put('/api/entries/:id', requireUser, (req, res) => {
  const old = db.prepare('SELECT * FROM entries WHERE id=? AND owner_id=? AND deleted_at IS NULL').get(req.params.id, req.user!.sub) as EntryRow | undefined;
  if (!old) { res.status(404).json({ error: '未找到条目' }); return; }
  const b = (req.body ?? {}) as Record<string, unknown>;
  if (b.version && Number(b.version) !== old.version) {
    res.status(409).json({ error: '此条目已在另一端变更，请先刷新并合并', current: rowToEntry(old) });
    return;
  }
  // 保存历史版本（更新前的快照）
  db.prepare('INSERT INTO entry_versions (id,entry_id,owner_id,version,snapshot,created_at) VALUES (?,?,?,?,?,?)')
    .run(id(), old.id, req.user!.sub, old.version, JSON.stringify(rowToEntry(old)), now());
  const next = { ...rowToEntry(old), ...b } as unknown as {
    kind: string; title: string; content: string; primaryVoid: string;
    secondaryVoids: unknown; tags: unknown; emotion: unknown; encoding: unknown;
    knowledge: unknown; privacy: unknown; attachments: unknown; sensory: unknown; source: string | null;
  };
  const t = now();
  db.prepare(`UPDATE entries SET kind=?,title=?,content=?,primary_void=?,secondary_voids=?,tags=?,emotion=?,encoding=?,knowledge=?,privacy=?,attachments=?,sensory=?,source=?,updated_at=?,version=version+1 WHERE id=? AND owner_id=?`)
    .run(next.kind, next.title, next.content, next.primaryVoid, JSON.stringify(next.secondaryVoids || []), JSON.stringify(next.tags || []), JSON.stringify(next.emotion || {}), JSON.stringify(next.encoding || {}), JSON.stringify(next.knowledge || {}), JSON.stringify(next.privacy || {}), JSON.stringify(next.attachments || []), JSON.stringify(next.sensory || {}), next.source || null, t, req.params.id, req.user!.sub);
  audit(req.user!.sub, 'entry.update', { entryId: req.params.id });
  res.json(rowToEntry(db.prepare('SELECT * FROM entries WHERE id=?').get(req.params.id) as EntryRow));
});
app.delete('/api/entries/:id', requireUser, (req, res) => {
  const r = db.prepare('UPDATE entries SET deleted_at=?,version=version+1 WHERE id=? AND owner_id=? AND deleted_at IS NULL').run(now(), req.params.id, req.user!.sub);
  if (!r.changes) { res.status(404).json({ error: '未找到条目' }); return; }
  audit(req.user!.sub, 'entry.delete', { entryId: req.params.id });
  res.status(204).end();
});
app.get('/api/entries/:id/versions', requireUser, (req, res) => {
  const rows = db.prepare('SELECT * FROM entry_versions WHERE entry_id=? AND owner_id=? ORDER BY version DESC LIMIT 100').all(req.params.id, req.user!.sub) as VersionRow[];
  res.json(rows.map(rowToVersion));
});

// ---------- 关系 ----------
app.get('/api/links', requireUser, (req, res) => {
  res.json(db.prepare('SELECT * FROM links WHERE owner_id=? AND status=?').all(req.user!.sub, 'accepted').map(rowToLink));
});
app.post('/api/links', requireUser, (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  if (!b.sourceId || !b.targetId || b.sourceId === b.targetId) {
    res.status(400).json({ error: '请选择两个不同条目' });
    return;
  }
  const link = {
    id: uuidRe.test(String(b.id || '')) ? String(b.id) : id(),
    owner: req.user!.sub,
    source: String(b.sourceId),
    target: String(b.targetId),
    type: String(b.relationType || 'similar'),
    desc: String(b.description || ''),
    strength: Math.max(0, Math.min(1, Number(b.strength ?? 0.5))),
    t: now(),
  };
  try {
    db.prepare('INSERT INTO links VALUES (?,?,?,?,?,?,?,?,?,?)').run(link.id, link.owner, link.source, link.target, link.type, link.desc, link.strength, 'user', 'accepted', link.t);
    res.status(201).json({ id: link.id, sourceId: link.source, targetId: link.target, relationType: link.type, description: link.desc, strength: link.strength, source: 'user', status: 'accepted', createdAt: link.t });
  } catch {
    const existing = db.prepare('SELECT * FROM links WHERE id=? AND owner_id=?').get(link.id, req.user!.sub) as LinkRow | undefined;
    if (existing) { res.status(200).json(rowToLink(existing)); return; }
    res.status(409).json({ error: '此关系已存在' });
  }
});
app.delete('/api/links/:id', requireUser, (req, res) => {
  db.prepare('DELETE FROM links WHERE id=? AND owner_id=?').run(req.params.id, req.user!.sub);
  res.status(204).end();
});

// ---------- 附件 ----------
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/x-m4a']);
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsRoot,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '');
      cb(null, crypto.randomUUID() + ext);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error('仅支持图片与音频附件'));
  },
});

app.post('/api/attachments', requireUser, upload.single('file'), (req, res) => {
  const f = req.file;
  if (!f) { res.status(400).json({ error: '请选择要上传的图片或音频文件' }); return; }
  const att = { id: id(), owner: req.user!.sub, filename: f.filename, mime: f.mimetype, size: f.size, t: now() };
  db.prepare('INSERT INTO attachments (id,owner_id,filename,mime,size,created_at) VALUES (?,?,?,?,?,?)').run(att.id, att.owner, att.filename, att.mime, att.size, att.t);
  audit(att.owner, 'attachment.upload', { attachmentId: att.id, size: att.size });
  res.status(201).json({ id: att.id, name: f.originalname, mime: f.mimetype, size: f.size, url: '/api/attachments/' + att.id, createdAt: att.t });
});
app.get('/api/attachments/:id', requireUser, (req, res) => {
  const a = db.prepare('SELECT * FROM attachments WHERE id=? AND owner_id=? AND deleted_at IS NULL').get(req.params.id, req.user!.sub) as AttachmentRow | undefined;
  if (!a) { res.status(404).json({ error: '附件不存在' }); return; }
  res.type(a.mime);
  res.sendFile(path.join(uploadsRoot, a.filename));
});

// ---------- AI 建议（本地启发式） ----------
function heuristic(entry: Record<string, unknown>): { primaryVoid: string; tags: string[]; color: string; emotionLabel?: string; reason: string } {
  const text = String((entry.title || '') + ' ' + (entry.content || '')).toLowerCase();
  const tags: string[] = [];
  if (/学习|知识|概念|课程|阅读/.test(text)) tags.push('学习');
  if (/难过|焦虑|愤怒|开心|害怕/.test(text)) tags.push('情绪观察');
  const primaryVoid = /矛盾|冲突|撕裂/.test(text) ? 'fracture' : /反思|我发现|自己/.test(text) ? 'mirror' : /联系|关联|像/.test(text) ? 'nexus' : /正在|过程|学习/.test(text) ? 'flow' : String(entry.primaryVoid || 'void');
  const color = primaryVoid === 'fracture' ? '胭脂' : primaryVoid === 'flow' ? '竹青' : primaryVoid === 'mirror' ? '月白' : '黛蓝';
  let emotionLabel: string | undefined;
  if (/难过|伤心|悲伤|哭/.test(text)) emotionLabel = '悲伤';
  else if (/焦虑|担心|不安/.test(text)) emotionLabel = '焦虑';
  else if (/愤怒|生气|火大/.test(text)) emotionLabel = '愤怒';
  else if (/开心|高兴|兴奋|愉快/.test(text)) emotionLabel = '愉悦';
  else if (/平静|放松|安心/.test(text)) emotionLabel = '平静';
  return { primaryVoid, tags, color, emotionLabel, reason: '基于文本关键词的本地建议；请由你确认或修改。' };
}
app.post('/api/ai/suggest/:entryId', requireUser, (req, res) => {
  const e = db.prepare('SELECT * FROM entries WHERE id=? AND owner_id=?').get(req.params.entryId, req.user!.sub) as EntryRow | undefined;
  if (!e) { res.status(404).json({ error: '未找到条目' }); return; }
  const entry = rowToEntry(e) as Record<string, unknown>;
  if (!(entry.privacy as { aiVisible?: boolean })?.aiVisible) {
    res.status(403).json({ error: '该条目未授权 AI 分析' });
    return;
  }
  const payload = heuristic(entry);
  const entryId = String(entry.id);
  const suggestion = { id: id(), owner: req.user!.sub, entryId, payload, status: 'pending', t: now() };
  db.prepare('INSERT INTO ai_suggestions VALUES (?,?,?,?,?,?)').run(suggestion.id, suggestion.owner, suggestion.entryId, JSON.stringify(payload), suggestion.status, suggestion.t);
  audit(req.user!.sub, 'ai.suggest', { entryId, provider: 'local-heuristic' });
  res.json({ ...suggestion, createdAt: suggestion.t });
});

// ---------- 导出 ----------
app.get('/api/export', requireUser, (req, res) => {
  const entries = db.prepare('SELECT * FROM entries WHERE owner_id=? AND deleted_at IS NULL').all(req.user!.sub).map(rowToEntry);
  const links = db.prepare('SELECT * FROM links WHERE owner_id=?').all(req.user!.sub).map(rowToLink);
  audit(req.user!.sub, 'data.export');
  res.json({ exportedAt: now(), entries, links });
});

// ---------- 错误处理 ----------
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: '文件上传失败：' + err.message });
    return;
  }
  if (err.message === '仅支持图片与音频附件') {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: '服务器发生错误' });
});

app.listen(port, '0.0.0.0', () => console.log(`INFINITY API: http://0.0.0.0:${port}`));
