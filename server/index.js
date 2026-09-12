import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import db from './db.js';
import { defaultKnowledge } from './defaultKnowledge.js';
import { requireUser, tokenFor } from './auth.js';

const app = express();
const port = Number(process.env.PORT || 8787);
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || true }));
app.use(express.json({ limit: '1mb' }));
const id = () => crypto.randomUUID();
const now = () => Date.now();
const parse = (value, fallback = {}) => { try { return JSON.parse(value); } catch { return fallback; } };
const rowToEntry = row => row && ({ ...row, isDefault: !!row.is_default, primaryVoid: row.primary_void, secondaryVoids: parse(row.secondary_voids, []), tags: parse(row.tags, []), emotion: parse(row.emotion), encoding: parse(row.encoding), knowledge: parse(row.knowledge), privacy: parse(row.privacy), createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at });
function audit(ownerId, action, metadata = {}) { db.prepare('INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?)').run(id(), ownerId, action, JSON.stringify(metadata), now()); }
function seedDefaults(userId) {
  const insert = db.prepare(`INSERT OR IGNORE INTO entries (id,owner_id,kind,title,content,primary_void,tags,is_default,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const t = now();
  for (const [key,title,kind,voidType,tags,content] of defaultKnowledge) insert.run(key + '-' + userId, userId, kind, title, content, voidType, JSON.stringify(tags), 1, t, t);
}

app.get('/api/health', (_, res) => res.json({ ok: true, time: now() }));
app.post('/api/auth/register', async (req, res) => {
  const { email, password, displayName } = req.body || {};
  if (!email || !password || password.length < 8) return res.status(400).json({ error: '邮箱和至少 8 位密码为必填项' });
  try {
    const user = { id: id(), email: email.trim().toLowerCase(), displayName: displayName?.trim() || '探索者' };
    db.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run(user.id, user.email, await bcrypt.hash(password, 12), user.displayName, now());
    seedDefaults(user.id); audit(user.id, 'register'); res.status(201).json({ user, token: tokenFor(user) });
  } catch { res.status(409).json({ error: '该邮箱已注册' }); }
});
app.post('/api/auth/login', async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(req.body?.email?.trim().toLowerCase());
  if (!user || !(await bcrypt.compare(req.body?.password || '', user.password_hash))) return res.status(401).json({ error: '邮箱或密码错误' });
  audit(user.id, 'login'); res.json({ user: { id:user.id,email:user.email,displayName:user.display_name }, token: tokenFor(user) });
});
app.get('/api/me', requireUser, (req,res) => { const u=db.prepare('SELECT id,email,display_name FROM users WHERE id=?').get(req.user.sub); res.json({ id:u.id,email:u.email,displayName:u.display_name }); });

app.get('/api/entries', requireUser, (req,res) => {
  const q = String(req.query.q || '').trim(); const kind = req.query.kind; const voidType = req.query.void;
  let sql = 'SELECT * FROM entries WHERE owner_id=? AND deleted_at IS NULL'; const args=[req.user.sub];
  if (kind) { sql += ' AND kind=?'; args.push(kind); } if (voidType) { sql += ' AND (primary_void=? OR secondary_voids LIKE ?)'; args.push(voidType, `%${voidType}%`); }
  if (q) { sql += ' AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)'; args.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  sql += ' ORDER BY updated_at DESC'; res.json(db.prepare(sql).all(...args).map(rowToEntry));
});
app.get('/api/entries/:id', requireUser, (req,res) => { const e=db.prepare('SELECT * FROM entries WHERE id=? AND owner_id=? AND deleted_at IS NULL').get(req.params.id,req.user.sub); if(!e)return res.status(404).json({error:'未找到条目'}); res.json(rowToEntry(e)); });
app.post('/api/entries', requireUser, (req,res) => {
  const b=req.body||{}; if (!b.title?.trim() || !b.kind || !b.primaryVoid) return res.status(400).json({error:'标题、类型和主空为必填项'});
  const entry={ id:id(), ownerId:req.user.sub, kind:b.kind, title:b.title.trim(), content:b.content||'', primaryVoid:b.primaryVoid, secondaryVoids:b.secondaryVoids||[], tags:b.tags||[], emotion:b.emotion||{}, encoding:b.encoding||{}, knowledge:b.knowledge||{}, privacy:{aiVisible:false,...b.privacy}, source:b.source||null, t:now() };
  db.prepare(`INSERT INTO entries (id,owner_id,kind,title,content,primary_void,secondary_voids,tags,emotion,encoding,knowledge,privacy,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(entry.id,entry.ownerId,entry.kind,entry.title,entry.content,entry.primaryVoid,JSON.stringify(entry.secondaryVoids),JSON.stringify(entry.tags),JSON.stringify(entry.emotion),JSON.stringify(entry.encoding),JSON.stringify(entry.knowledge),JSON.stringify(entry.privacy),entry.source,entry.t,entry.t);
  audit(req.user.sub,'entry.create',{entryId:entry.id}); res.status(201).json(rowToEntry(db.prepare('SELECT * FROM entries WHERE id=?').get(entry.id)));
});
app.put('/api/entries/:id', requireUser, (req,res) => {
  const old=db.prepare('SELECT * FROM entries WHERE id=? AND owner_id=? AND deleted_at IS NULL').get(req.params.id,req.user.sub); if(!old)return res.status(404).json({error:'未找到条目'});
  const b=req.body||{}; if (b.version && Number(b.version)!==old.version) return res.status(409).json({error:'此条目已在另一端变更，请先刷新并合并', current:rowToEntry(old)});
  const next={...rowToEntry(old),...b}; const t=now();
  db.prepare(`UPDATE entries SET kind=?,title=?,content=?,primary_void=?,secondary_voids=?,tags=?,emotion=?,encoding=?,knowledge=?,privacy=?,source=?,updated_at=?,version=version+1 WHERE id=? AND owner_id=?`).run(next.kind,next.title,next.content,next.primaryVoid,JSON.stringify(next.secondaryVoids||[]),JSON.stringify(next.tags||[]),JSON.stringify(next.emotion||{}),JSON.stringify(next.encoding||{}),JSON.stringify(next.knowledge||{}),JSON.stringify(next.privacy||{}),next.source||null,t,req.params.id,req.user.sub);
  audit(req.user.sub,'entry.update',{entryId:req.params.id}); res.json(rowToEntry(db.prepare('SELECT * FROM entries WHERE id=?').get(req.params.id)));
});
app.delete('/api/entries/:id', requireUser, (req,res) => { const r=db.prepare('UPDATE entries SET deleted_at=?,version=version+1 WHERE id=? AND owner_id=? AND deleted_at IS NULL').run(now(),req.params.id,req.user.sub); if(!r.changes)return res.status(404).json({error:'未找到条目'}); audit(req.user.sub,'entry.delete',{entryId:req.params.id}); res.status(204).end(); });

app.get('/api/links', requireUser, (req,res) => res.json(db.prepare('SELECT * FROM links WHERE owner_id=? AND status=?').all(req.user.sub,'accepted').map(x=>({...x,createdAt:x.created_at}))));
app.post('/api/links', requireUser, (req,res) => { const b=req.body||{}; if(!b.sourceId||!b.targetId||b.sourceId===b.targetId)return res.status(400).json({error:'请选择两个不同条目'}); try { const link={id:id(),owner:req.user.sub,source:b.sourceId,target:b.targetId,type:b.relationType||'similar',desc:b.description||'',strength:Math.max(0,Math.min(1,Number(b.strength??.5))),t:now()}; db.prepare('INSERT INTO links VALUES (?,?,?,?,?,?,?,?,?,?)').run(link.id,link.owner,link.source,link.target,link.type,link.desc,link.strength,'user','accepted',link.t); res.status(201).json({...link,sourceId:link.source,targetId:link.target,relationType:link.type,description:link.desc,createdAt:link.t}); } catch {res.status(409).json({error:'此关系已存在'});} });
app.delete('/api/links/:id', requireUser, (req,res) => { db.prepare('DELETE FROM links WHERE id=? AND owner_id=?').run(req.params.id,req.user.sub);res.status(204).end(); });

function heuristic(entry) { const text=(entry.title+' '+entry.content).toLowerCase(); const tags=[]; if(/学习|知识|概念|课程|阅读/.test(text))tags.push('学习'); if(/难过|焦虑|愤怒|开心|害怕/.test(text))tags.push('情绪观察'); const primaryVoid=/矛盾|冲突|撕裂/.test(text)?'fracture':/反思|我发现|自己/.test(text)?'mirror':/联系|关联|像/.test(text)?'nexus':/正在|过程|学习/.test(text)?'flow':entry.primaryVoid; return {primaryVoid,tags,color: primaryVoid==='fracture'?'朱砂':primaryVoid==='flow'?'青碧':'靛青',reason:'基于文本关键词的本地建议；请由你确认或修改。'}; }
app.post('/api/ai/suggest/:entryId', requireUser, (req,res) => { const e=db.prepare('SELECT * FROM entries WHERE id=? AND owner_id=?').get(req.params.entryId,req.user.sub); if(!e)return res.status(404).json({error:'未找到条目'}); const entry=rowToEntry(e); if(!entry.privacy.aiVisible)return res.status(403).json({error:'该条目未授权 AI 分析'}); const payload=heuristic(entry); const suggestion={id:id(),owner:req.user.sub,entryId:entry.id,payload,status:'pending',t:now()}; db.prepare('INSERT INTO ai_suggestions VALUES (?,?,?,?,?,?)').run(suggestion.id,suggestion.owner,suggestion.entryId,JSON.stringify(payload),suggestion.status,suggestion.t);audit(req.user.sub,'ai.suggest',{entryId:entry.id,provider:'local-heuristic'});res.json({...suggestion,createdAt:suggestion.t}); });
app.get('/api/export', requireUser, (req,res) => { const entries=db.prepare('SELECT * FROM entries WHERE owner_id=? AND deleted_at IS NULL').all(req.user.sub).map(rowToEntry); const links=db.prepare('SELECT * FROM links WHERE owner_id=?').all(req.user.sub); audit(req.user.sub,'data.export');res.json({exportedAt:now(),entries,links}); });

app.use((err,_,res,__)=>(console.error(err),res.status(500).json({error:'服务器发生错误'})));
app.listen(port,'0.0.0.0',()=>console.log(`INFINITY API: http://0.0.0.0:${port}`));
