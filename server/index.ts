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
import { chatJson, getAiConfig } from './ai.js';
import type { AttachmentMeta, AttachmentRow, EntryRow, KnowledgeRow, LinkRow, UserRow, VersionRow } from './domain.js';

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
  occurredAt: row.occurred_at ?? null,
  insight: !!row.insight,
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

const rowToKnowledge = (row: SqlRow) => row && ({
  ...row,
  isDefault: !!row.is_default,
  voidType: row.void_type,
  taxonomy: parse<string[]>(row.taxonomy, []),
  prerequisites: parse<string[]>(row.prerequisites, []),
  relatedEntries: parse<string[]>(row.related_entries, []),
  tags: parse<string[]>(row.tags, []),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
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

/** 新用户预置默认知识包（knowledge_entries 表，可升级：INSERT OR IGNORE 幂等） */
function seedKnowledgeDefaults(userId: string): void {
  const insert = db.prepare(`INSERT OR IGNORE INTO knowledge_entries (id,owner_id,title,content,domain,void_type,taxonomy,difficulty,tags,is_default,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const t = now();
  for (const item of defaultKnowledge) {
    insert.run(String(item.key + '-' + userId), userId, item.title, item.content, item.domain, item.voidType, JSON.stringify(item.taxonomy), item.difficulty, JSON.stringify(item.tags), 1, t, t);
  }
}

/** 旧数据迁移：把早期版本存在 entries 表里的默认条目搬进知识库（幂等，启动时执行一次） */
function migrateOldDefaults(): void {
  const olds = db.prepare('SELECT * FROM entries WHERE is_default=1').all() as EntryRow[];
  if (olds.length === 0) return;
  const insert = db.prepare(`INSERT OR IGNORE INTO knowledge_entries (id,owner_id,title,content,domain,void_type,taxonomy,difficulty,tags,is_default,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const del = db.prepare('DELETE FROM entries WHERE id=?');
  for (const o of olds) {
    insert.run(o.id, o.owner_id ?? '', o.title, o.content, '知识库', o.primary_void, '[]', 1, JSON.stringify(parse<string[]>(o.tags, [])), 1, o.created_at, o.updated_at);
    del.run(o.id);
  }
}
migrateOldDefaults();

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
    seedKnowledgeDefaults(user.id);
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
    occurredAt: (b.occurredAt as number | null | undefined) ?? null,
    insight: b.insight ? 1 : 0,
    source: (b.source as string | null | undefined) || null,
    t: now(),
  };
  try {
    db.prepare(`INSERT INTO entries (id,owner_id,kind,title,content,primary_void,secondary_voids,tags,emotion,encoding,knowledge,privacy,attachments,sensory,occurred_at,insight,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(entry.id, entry.ownerId, entry.kind, entry.title, entry.content, entry.primaryVoid, JSON.stringify(entry.secondaryVoids), JSON.stringify(entry.tags), JSON.stringify(entry.emotion), JSON.stringify(entry.encoding), JSON.stringify(entry.knowledge), JSON.stringify(entry.privacy), JSON.stringify(entry.attachments), JSON.stringify(entry.sensory), entry.occurredAt, entry.insight, entry.source, entry.t, entry.t);
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
    knowledge: unknown; privacy: unknown; attachments: unknown; sensory: unknown;
    occurredAt: number | null; insight: unknown; source: string | null;
  };
  const t = now();
  db.prepare(`UPDATE entries SET kind=?,title=?,content=?,primary_void=?,secondary_voids=?,tags=?,emotion=?,encoding=?,knowledge=?,privacy=?,attachments=?,sensory=?,occurred_at=?,insight=?,source=?,updated_at=?,version=version+1 WHERE id=? AND owner_id=?`)
    .run(next.kind, next.title, next.content, next.primaryVoid, JSON.stringify(next.secondaryVoids || []), JSON.stringify(next.tags || []), JSON.stringify(next.emotion || {}), JSON.stringify(next.encoding || {}), JSON.stringify(next.knowledge || {}), JSON.stringify(next.privacy || {}), JSON.stringify(next.attachments || []), JSON.stringify(next.sensory || {}), next.occurredAt ?? null, next.insight ? 1 : 0, next.source || null, t, req.params.id, req.user!.sub);
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
  const RELATION_TYPES = new Set(['causal', 'similar', 'conflict', 'inspiration', 'transform', 'contrast', 'contains', 'prerequisite']);
  const link = {
    id: uuidRe.test(String(b.id || '')) ? String(b.id) : id(),
    owner: req.user!.sub,
    source: String(b.sourceId),
    target: String(b.targetId),
    type: RELATION_TYPES.has(String(b.relationType)) ? String(b.relationType) : 'similar',
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

// ---------- 知识库 ----------
app.get('/api/knowledge', requireUser, (req, res) => {
  const q = String(req.query.q || '').trim();
  const domain = String(req.query.domain || '').trim();
  const voidType = req.query.void;
  let sql = 'SELECT * FROM knowledge_entries WHERE owner_id=? AND deleted_at IS NULL';
  const args: string[] = [req.user!.sub];
  if (domain) { sql += ' AND domain=?'; args.push(domain); }
  if (voidType) { sql += ' AND void_type=?'; args.push(String(voidType)); }
  if (q) { sql += ' AND (title LIKE ? OR content LIKE ? OR tags LIKE ? OR taxonomy LIKE ?)'; args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  sql += ' ORDER BY is_default DESC, updated_at DESC';
  res.json(db.prepare(sql).all(...args).map(rowToKnowledge));
});
app.get('/api/knowledge/:id', requireUser, (req, res) => {
  const k = db.prepare('SELECT * FROM knowledge_entries WHERE id=? AND owner_id=? AND deleted_at IS NULL').get(req.params.id, req.user!.sub) as KnowledgeRow | undefined;
  if (!k) { res.status(404).json({ error: '未找到知识条目' }); return; }
  res.json(rowToKnowledge(k));
});
app.post('/api/knowledge', requireUser, (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  if (!(b.title as string | undefined)?.trim() || !b.voidType) {
    res.status(400).json({ error: '标题和七空归属为必填项' });
    return;
  }
  const entryId = uuidRe.test(String(b.id || '')) ? String(b.id) : id();
  const k = {
    id: entryId,
    ownerId: req.user!.sub,
    title: String(b.title).trim(),
    content: String(b.content || ''),
    domain: String(b.domain || ''),
    voidType: String(b.voidType),
    taxonomy: (b.taxonomy as unknown[]) || [],
    difficulty: Math.max(1, Math.min(5, Number(b.difficulty ?? 2))),
    prerequisites: (b.prerequisites as unknown[]) || [],
    relatedEntries: (b.relatedEntries as unknown[]) || [],
    tags: (b.tags as unknown[]) || [],
    t: now(),
  };
  try {
    db.prepare(`INSERT INTO knowledge_entries (id,owner_id,title,content,domain,void_type,taxonomy,difficulty,prerequisites,related_entries,tags,is_default,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(k.id, k.ownerId, k.title, k.content, k.domain, k.voidType, JSON.stringify(k.taxonomy), k.difficulty, JSON.stringify(k.prerequisites), JSON.stringify(k.relatedEntries), JSON.stringify(k.tags), 0, k.t, k.t);
    audit(k.ownerId, 'knowledge.create', { knowledgeId: k.id });
    res.status(201).json(rowToKnowledge(db.prepare('SELECT * FROM knowledge_entries WHERE id=?').get(k.id) as KnowledgeRow));
  } catch (err) {
    const existing = db.prepare('SELECT * FROM knowledge_entries WHERE id=? AND owner_id=?').get(k.id, k.ownerId) as KnowledgeRow | undefined;
    if (existing) { res.status(200).json(rowToKnowledge(existing)); return; }
    throw err;
  }
});
app.put('/api/knowledge/:id', requireUser, (req, res) => {
  const old = db.prepare('SELECT * FROM knowledge_entries WHERE id=? AND owner_id=? AND deleted_at IS NULL').get(req.params.id, req.user!.sub) as KnowledgeRow | undefined;
  if (!old) { res.status(404).json({ error: '未找到知识条目' }); return; }
  const b = (req.body ?? {}) as Record<string, unknown>;
  if (b.version && Number(b.version) !== old.version) {
    res.status(409).json({ error: '此条目已在另一端变更，请先刷新并合并', current: rowToKnowledge(old) });
    return;
  }
  const next = { ...rowToKnowledge(old), ...b } as unknown as {
    title: string; content: string; domain: string; voidType: string;
    taxonomy: unknown; difficulty: number; prerequisites: unknown; relatedEntries: unknown; tags: unknown;
  };
  const t = now();
  db.prepare(`UPDATE knowledge_entries SET title=?,content=?,domain=?,void_type=?,taxonomy=?,difficulty=?,prerequisites=?,related_entries=?,tags=?,updated_at=?,version=version+1 WHERE id=? AND owner_id=?`)
    .run(next.title, next.content, next.domain, next.voidType, JSON.stringify(next.taxonomy || []), Math.max(1, Math.min(5, Number(next.difficulty ?? 2))), JSON.stringify(next.prerequisites || []), JSON.stringify(next.relatedEntries || []), JSON.stringify(next.tags || []), t, req.params.id, req.user!.sub);
  audit(req.user!.sub, 'knowledge.update', { knowledgeId: req.params.id });
  res.json(rowToKnowledge(db.prepare('SELECT * FROM knowledge_entries WHERE id=?').get(req.params.id) as KnowledgeRow));
});
app.delete('/api/knowledge/:id', requireUser, (req, res) => {
  const r = db.prepare('UPDATE knowledge_entries SET deleted_at=?,version=version+1 WHERE id=? AND owner_id=? AND deleted_at IS NULL').run(now(), req.params.id, req.user!.sub);
  if (!r.changes) { res.status(404).json({ error: '未找到知识条目' }); return; }
  audit(req.user!.sub, 'knowledge.delete', { knowledgeId: req.params.id });
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

// ---------- AI 受控接入（方案书 3.3：AI 只提建议，用户逐项确认；每次调用可回溯） ----------

const VOID_IDS = ['void', 'silence', 'fracture', 'flow', 'mirror', 'nexus', 'limit'];
const VOID_BRIEF: Record<string, string> = {
  void: '虚空：未知的世界（模糊感受、陌生领域）',
  silence: '寂空：已理解的世界（已掌握、已放下）',
  fracture: '裂空：冲突的世界（矛盾、认知失调）',
  flow: '流空：变化的世界（进行中、未定型）',
  mirror: '映空：自我的世界（反思、元认知）',
  nexus: '联空：连接的世界（类比、跨域联系）',
  limit: '极空：极限的世界（超越体验、不可言说）',
};
const COLOR_NAMES = ['胭脂', '朱砂', '绯红', '桃红', '银红', '枣红', '石榴红', '海棠红', '藤黄', '鹅黄', '缃色', '秋香', '杏黄', '蜜合', '竹青', '松花', '豆绿', '葱绿', '苍绿', '石绿', '铜绿', '碧色', '黛蓝', '靛青', '月白', '天青', '宝蓝', '藏青', '鸦青', '青白', '黛紫', '青莲', '藕荷', '丁香', '紫檀', '玉色', '缁色', '墨灰', '茶色', '赭石'];
const RELATION_TYPES = new Set(['causal', 'similar', 'conflict', 'inspiration', 'transform', 'contrast', 'contains', 'prerequisite']);
const EMOTION_LABELS = ['愉悦', '兴奋', '期待', '安心', '感激', '好奇', '专注', '满足', '自豪', '温暖', '爱意', '平静', '焦虑', '愤怒', '悲伤', '恐惧', '孤独', '失落', '羞耻', '内疚', '烦躁', '委屈', '矛盾', '迷茫', '空虚', '疲惫', '淡然', '疏离', '惊讶', '疑惑'];

function recordAiRun(ownerId: string, kind: string, provider: string, model: string, temperature: number, inputSummary: string, output: unknown): void {
  db.prepare('INSERT INTO ai_runs (id,owner_id,kind,provider,model,temperature,input_summary,output,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id(), ownerId, kind, provider, model, temperature, inputSummary, JSON.stringify(output), now());
}

/** 本地启发式编码建议（离线降级） */
function heuristic(entry: Record<string, unknown>) {
  const text = String((entry.title || '') + ' ' + (entry.content || '')).toLowerCase();
  const tags: string[] = [];
  const keywords: string[] = [];
  if (/学习|知识|概念|课程|阅读/.test(text)) { tags.push('学习'); keywords.push('学习'); }
  if (/难过|焦虑|愤怒|开心|害怕/.test(text)) tags.push('情绪观察');
  const primaryVoid = /矛盾|冲突|撕裂/.test(text) ? 'fracture' : /反思|我发现|自己/.test(text) ? 'mirror' : /联系|关联|像/.test(text) ? 'nexus' : /正在|过程|学习/.test(text) ? 'flow' : String(entry.primaryVoid || 'void');
  const color = primaryVoid === 'fracture' ? '胭脂' : primaryVoid === 'flow' ? '竹青' : primaryVoid === 'mirror' ? '月白' : '黛蓝';
  let emotionLabel: string | undefined;
  if (/难过|伤心|悲伤|哭/.test(text)) emotionLabel = '悲伤';
  else if (/焦虑|担心|不安/.test(text)) emotionLabel = '焦虑';
  else if (/愤怒|生气|火大/.test(text)) emotionLabel = '愤怒';
  else if (/开心|高兴|兴奋|愉快/.test(text)) emotionLabel = '愉悦';
  else if (/平静|放松|安心/.test(text)) emotionLabel = '平静';
  return { primaryVoid, secondaryVoids: [], tags, color, emotionLabel, emotionValence: emotionLabel === '焦虑' || emotionLabel === '悲伤' || emotionLabel === '愤怒' ? -0.5 : emotionLabel ? 0.5 : 0, emotionIntensity: 0.5, keywords, reason: '基于文本关键词的本地建议；请由你确认或修改。' };
}

function validateEncodePayload(out: Record<string, unknown>, entry: Record<string, unknown>): Record<string, unknown> {
  const primaryVoid = VOID_IDS.includes(String(out.primaryVoid)) ? String(out.primaryVoid) : String(entry.primaryVoid || 'void');
  const secondaryVoids = Array.isArray(out.secondaryVoids) ? out.secondaryVoids.filter(v => VOID_IDS.includes(String(v)) && v !== primaryVoid).slice(0, 6).map(String) : [];
  const color = typeof out.color === 'string' && COLOR_NAMES.includes(out.color) ? out.color : undefined;
  const emotionLabel = typeof out.emotionLabel === 'string' && EMOTION_LABELS.includes(out.emotionLabel) ? out.emotionLabel : undefined;
  const valence = Math.max(-1, Math.min(1, Number(out.emotionValence ?? 0)));
  const intensity = Math.max(0, Math.min(1, Number(out.emotionIntensity ?? 0.5)));
  const tags = Array.isArray(out.tags) ? out.tags.map(String).slice(0, 8) : [];
  const keywords = Array.isArray(out.keywords) ? out.keywords.map(String).slice(0, 8) : [];
  return { primaryVoid, secondaryVoids, tags, color, emotionLabel, emotionValence: valence, emotionIntensity: intensity, keywords, reason: typeof out.reason === 'string' ? out.reason.slice(0, 200) : 'AI 建议；请由你确认或修改。' };
}

app.post('/api/ai/suggest/:entryId', requireUser, async (req, res) => {
  const e = db.prepare('SELECT * FROM entries WHERE id=? AND owner_id=?').get(req.params.entryId, req.user!.sub) as EntryRow | undefined;
  if (!e) { res.status(404).json({ error: '未找到条目' }); return; }
  const entry = rowToEntry(e) as Record<string, unknown>;
  if (!(entry.privacy as { aiVisible?: boolean })?.aiVisible) {
    res.status(403).json({ error: '该条目未授权 AI 分析' });
    return;
  }
  const config = getAiConfig();
  let payload: Record<string, unknown>;
  let provider: string;
  let model: string;
  const temperature = 0.4;
  if (config) {
    try {
      const out = (await chatJson(config, [
        {
          role: 'system',
          content: `你是心智宇宙的编码助手。用户用"七空"框架为经历编码。只输出 JSON，不要输出其他内容。\n七空定义：${VOID_IDS.map(v => `${v}（${VOID_BRIEF[v]}）`).join('；')}\n中式色卡可选：${COLOR_NAMES.join('、')}\n情绪词汇表：${EMOTION_LABELS.join('、')}\n输出格式：{"primaryVoid":"七空id","secondaryVoids":[],"color":"色卡色名或null","emotionLabel":"情绪词或null","emotionValence":-1到1,"emotionIntensity":0到1,"tags":[],"keywords":[],"reason":"一句话理由"}`,
        },
        {
          role: 'user',
          content: `标题：${String(entry.title || '')}\n正文：${String(entry.content || '').slice(0, 2000)}\n当前主空：${String(entry.primaryVoid || '')}`,
        },
      ], temperature)) as Record<string, unknown>;
      payload = validateEncodePayload(out, entry);
      provider = config.baseUrl;
      model = config.model;
    } catch (err) {
      console.error('[ai] 编码建议调用失败，降级本地启发式：', err);
      payload = heuristic(entry);
      provider = 'local-heuristic';
      model = 'keyword';
    }
  } else {
    payload = heuristic(entry);
    provider = 'local-heuristic';
    model = 'keyword';
  }
  recordAiRun(req.user!.sub, 'encode', provider, model, temperature, `entry:${String(entry.id)}`, payload);
  const entryId = String(entry.id);
  const suggestion = { id: id(), owner: req.user!.sub, entryId, payload, status: 'pending', kind: 'encode', t: now() };
  db.prepare('INSERT INTO ai_suggestions (id,owner_id,entry_id,payload,status,kind,created_at) VALUES (?,?,?,?,?,?,?)').run(suggestion.id, suggestion.owner, suggestion.entryId, JSON.stringify(payload), suggestion.status, suggestion.kind, suggestion.t);
  audit(req.user!.sub, 'ai.suggest', { entryId, provider });
  res.json({ ...suggestion, createdAt: suggestion.t, provider });
});

app.post('/api/ai/suggestions/:id/status', requireUser, (req, res) => {
  const status = String((req.body ?? {}).status);
  if (status !== 'accepted' && status !== 'rejected') {
    res.status(400).json({ error: '状态只能是 accepted 或 rejected' });
    return;
  }
  const r = db.prepare('UPDATE ai_suggestions SET status=? WHERE id=? AND owner_id=?').run(status, req.params.id, req.user!.sub);
  if (!r.changes) { res.status(404).json({ error: '建议不存在' }); return; }
  audit(req.user!.sub, 'ai.suggestion.' + status, { suggestionId: req.params.id });
  res.status(204).end();
});

/** 本地启发式关系发现（离线降级）：标签/情绪重叠 → 相似关系 */
function heuristicDiscover(entries: Record<string, unknown>[]) {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < entries.length && out.length < 10; i++) {
    for (let j = i + 1; j < entries.length && out.length < 10; j++) {
      const a = entries[i];
      const b = entries[j];
      const tagsA = (a.tags as string[]) || [];
      const tagsB = (b.tags as string[]) || [];
      const shared = tagsA.filter(t => tagsB.includes(t));
      let strength = 0;
      let reason = '';
      if (shared.length > 0) {
        strength = Math.min(0.8, 0.4 + shared.length * 0.1);
        reason = `本地启发式：共同标签 ${shared.join('、')}`;
      } else if ((a.emotion as { label?: string })?.label && (a.emotion as { label?: string }).label === (b.emotion as { label?: string })?.label) {
        strength = 0.35;
        reason = `本地启发式：相同情绪 ${(a.emotion as { label: string }).label}`;
      }
      if (strength > 0) out.push({ sourceId: a.id, targetId: b.id, relationType: 'similar', strength, reason });
    }
  }
  return out;
}

app.post('/api/ai/discover', requireUser, async (req, res) => {
  const rows = db.prepare('SELECT * FROM entries WHERE owner_id=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 80').all(req.user!.sub) as EntryRow[];
  const allowed = rows.map(rowToEntry).filter(e => (e.privacy as { aiVisible?: boolean })?.aiVisible) as Record<string, unknown>[];
  if (allowed.length < 2) {
    res.json({ id: null, links: [], provider: 'none', reason: '至少需要 2 条开启"允许 AI 分析"的条目', createdAt: now() });
    return;
  }
  const config = getAiConfig();
  let links: Record<string, unknown>[];
  let provider: string;
  let model: string;
  const temperature = 0.5;
  if (config) {
    try {
      const summaries = allowed.map(e => ({ id: String(e.id), title: String(e.title || ''), void: String(e.primaryVoid || ''), tags: (e.tags as string[]) || [], emotion: (e.emotion as { label?: string })?.label || '', snippet: String(e.content || '').slice(0, 120) }));
      const out = (await chatJson(config, [
        {
          role: 'system',
          content: `你是关系发现助手。给出一组经历摘要，发现它们之间隐藏的联系。只输出 JSON。\n输出格式：{"links":[{"source":"条目id","target":"条目id","relationType":"causal|similar|conflict|inspiration|transform|contrast|contains|prerequisite","strength":0到1,"reason":"一句话理由"}]}\n最多 10 条；只使用提供的条目 id；source 与 target 不能相同。`,
        },
        { role: 'user', content: JSON.stringify(summaries) },
      ], temperature)) as { links?: unknown[] };
      const raw = Array.isArray(out.links) ? out.links : [];
      const idSet = new Set(allowed.map(e => String(e.id)));
      links = raw
        .map(x => x as Record<string, unknown>)
        .filter(x => idSet.has(String(x.source)) && idSet.has(String(x.target)) && x.source !== x.target && RELATION_TYPES.has(String(x.relationType)))
        .slice(0, 10)
        .map(x => ({ sourceId: String(x.source), targetId: String(x.target), relationType: String(x.relationType), strength: Math.max(0, Math.min(1, Number(x.strength ?? 0.5))), reason: String(x.reason || '').slice(0, 200) }));
      provider = config.baseUrl;
      model = config.model;
    } catch (err) {
      console.error('[ai] 关系发现调用失败，降级本地启发式：', err);
      links = heuristicDiscover(allowed);
      provider = 'local-heuristic';
      model = 'overlap';
    }
  } else {
    links = heuristicDiscover(allowed);
    provider = 'local-heuristic';
    model = 'overlap';
  }
  recordAiRun(req.user!.sub, 'discover', provider, model, temperature, `entries:${allowed.length}`, { links });
  const suggestion = { id: id(), owner: req.user!.sub, entryId: '', payload: { links }, status: 'pending', kind: 'discover', t: now() };
  db.prepare('INSERT INTO ai_suggestions (id,owner_id,entry_id,payload,status,kind,created_at) VALUES (?,?,?,?,?,?,?)').run(suggestion.id, suggestion.owner, suggestion.entryId, JSON.stringify(suggestion.payload), suggestion.status, suggestion.kind, suggestion.t);
  audit(req.user!.sub, 'ai.discover', { provider, candidates: links.length });
  res.json({ ...suggestion, createdAt: suggestion.t, provider });
});

app.get('/api/ai/discoveries', requireUser, (req, res) => {
  const rows = db.prepare("SELECT * FROM ai_suggestions WHERE owner_id=? AND kind='discover' AND status='pending' ORDER BY created_at DESC LIMIT 20").all(req.user!.sub) as { id: string; payload: string; status: string; created_at: number }[];
  res.json(rows.map(r => ({ id: r.id, payload: parse<Record<string, unknown>>(r.payload, {}), status: r.status, createdAt: r.created_at })));
});

/** 本地规则学习计划（离线降级） */
function heuristicPlan(materials: Record<string, unknown>[]) {
  const chunks = materials.map(m => ({
    title: `学习「${String(m.title || '')}」`,
    description: '阅读并用自己的话复述要点；会了的记入寂空，卡住的记入裂空。',
    days: 1,
  }));
  return {
    chunks,
    reviewAdvice: '按 1/3/7 天间隔复习；每次先回忆再看笔记。',
    cognitiveLoadNote: '每次只学一个分块，复述通过再进入下一个，避免同时啃多个新概念。',
  };
}

app.post('/api/ai/learn', requireUser, async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const goal = String(b.goal || '').trim();
  if (!goal) { res.status(400).json({ error: '请填写学习目标' }); return; }
  const materialIds = Array.isArray(b.materialIds) ? b.materialIds.map(String) : [];
  const materials = materialIds
    .map(mid => db.prepare('SELECT * FROM knowledge_entries WHERE id=? AND owner_id=?').get(mid, req.user!.sub) as KnowledgeRow | undefined)
    .filter((x): x is KnowledgeRow => !!x)
    .map(x => rowToKnowledge(x)) as Record<string, unknown>[];
  const progress = String(b.progress || '');
  const config = getAiConfig();
  let plan: Record<string, unknown>;
  let provider: string;
  let model: string;
  const temperature = 0.5;
  if (config) {
    try {
      const out = (await chatJson(config, [
        {
          role: 'system',
          content: `你是学习规划助手。基于用户目标与学习资料，输出分块学习计划与认知负荷建议。只输出 JSON。\n输出格式：{"chunks":[{"title":"分块标题","description":"学什么、怎么学","days":天数}],"reviewAdvice":"复习建议","cognitiveLoadNote":"认知负荷提示（一句话）"}\n分块不超过 7 个；每天学习量不宜过大。`,
        },
        {
          role: 'user',
          content: `学习目标：${goal}\n学习资料：${JSON.stringify(materials.map(m => ({ title: m.title, difficulty: m.difficulty ?? 2, domain: m.domain ?? '' })))}\n当前进度：${progress || '刚开始'}`,
        },
      ], temperature)) as Record<string, unknown>;
      const chunks = Array.isArray(out.chunks)
        ? out.chunks.slice(0, 7).map(c => {
          const x = c as Record<string, unknown>;
          return { title: String(x.title || '学习分块').slice(0, 60), description: String(x.description || '').slice(0, 300), days: Math.max(1, Math.min(14, Number(x.days ?? 1))) };
        })
        : [];
      plan = {
        chunks,
        reviewAdvice: String(out.reviewAdvice || '').slice(0, 300),
        cognitiveLoadNote: String(out.cognitiveLoadNote || '').slice(0, 200),
      };
      provider = config.baseUrl;
      model = config.model;
    } catch (err) {
      console.error('[ai] 学习计划生成失败，降级本地规则：', err);
      plan = heuristicPlan(materials);
      provider = 'local-heuristic';
      model = 'rule';
    }
  } else {
    plan = heuristicPlan(materials);
    provider = 'local-heuristic';
    model = 'rule';
  }
  recordAiRun(req.user!.sub, 'learn', provider, model, temperature, `goal:${goal};materials:${materials.length}`, plan);
  res.json({ plan, provider, createdAt: now() });
});

// ---------- 导出 ----------
app.get('/api/export', requireUser, (req, res) => {
  const entries = db.prepare('SELECT * FROM entries WHERE owner_id=? AND deleted_at IS NULL').all(req.user!.sub).map(rowToEntry);
  const links = db.prepare('SELECT * FROM links WHERE owner_id=?').all(req.user!.sub).map(rowToLink);
  const knowledge = db.prepare('SELECT * FROM knowledge_entries WHERE owner_id=? AND deleted_at IS NULL').all(req.user!.sub).map(rowToKnowledge);
  audit(req.user!.sub, 'data.export');
  res.json({ exportedAt: now(), entries, links, knowledge });
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
