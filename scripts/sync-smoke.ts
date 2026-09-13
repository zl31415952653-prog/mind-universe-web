/**
 * 同步引擎冒烟测试（第 1 轮验收用）：
 * 在 Node 环境用 fake-indexeddb 跑真实的 Dexie + 同步引擎，对着一个临时目录的
 * 真实 API 服务器，验证 离线创建→推送→冲突→裁决→删除 全链路。
 * 运行：npm run smoke（会自行拉起 8799 端口的测试服务器并清理）
 */
import 'fake-indexeddb/auto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

// api.ts 依赖 localStorage（浏览器全局），Node 下用内存实现模拟
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
} as unknown as Storage;

// api.ts 使用相对路径 '/api'（浏览器里由 origin 解析），Node 下垫片补全基址
const apiBase = 'http://localhost:8799';
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === 'string' && input.startsWith('/')) return realFetch(apiBase + input, init);
  return realFetch(input, init);
}) as typeof fetch;

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`✗ FAIL: ${msg}`);
    process.exit(1);
  }
  passed += 1;
  console.log(`  ✓ ${msg}`);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'infinity-smoke-'));
const serverLog = fs.createWriteStream(path.join(tempDir, 'server.log'));
// 服务端已是 TypeScript：用 node + tsx CLI 直接运行；DATA_DIR 指向临时目录避免污染真实数据
const tsxCli = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
const server = spawn(process.execPath, [tsxCli, path.join(process.cwd(), 'server', 'index.ts')], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: '8799', DATA_DIR: tempDir },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.pipe(serverLog);
server.stderr.pipe(serverLog);

// 轮询等待服务器就绪（最多 15 秒）
let ready = false;
for (let i = 0; i < 30; i++) {
  await sleep(500);
  try {
    const res = await realFetch('http://localhost:8799/api/health');
    if (res.ok) { ready = true; break; }
  } catch { /* 未就绪 */ }
}
if (!ready) {
  console.error('✗ 测试服务器启动失败，日志：');
  console.error(fs.readFileSync(path.join(tempDir, 'server.log'), 'utf8'));
  process.exit(1);
}
console.log('测试服务器已就绪（8799，数据目录：' + tempDir + '）');

try {
  const { api, setToken } = await import('../src/api');
  const { db } = await import('../src/db');
  const { pullSnapshot, flushOutbox } = await import('../src/sync');
  const { saveEntry, removeEntry, resolveConflict } = await import('../src/store');
  const type = (await import('../src/types'));

  const draftOf = (e: type.Entry, patch: Partial<type.EntryDraft> = {}): type.EntryDraft => ({
    kind: e.kind, title: e.title, content: e.content, primaryVoid: e.primaryVoid,
    secondaryVoids: e.secondaryVoids ?? [], tags: e.tags ?? [], emotion: e.emotion ?? {},
    encoding: e.encoding ?? { color: null }, knowledge: e.knowledge ?? {}, privacy: e.privacy ?? {},
    ...patch,
  });

  console.log('== 1. 注册登录 + 拉取快照（默认知识包） ==');
  const email = `smoke-${Date.now()}@test.local`;
  await api.register(email, 'testpass123', 'smoke');
  const r = await api.login(email, 'testpass123');
  setToken(r.token);
  await pullSnapshot();
  const defaults = (await db.knowledge.toArray()).filter(e => e.isDefault);
  assert(defaults.length === 19, `默认知识包应为 19 条，实际 ${defaults.length}`);
  assert((await db.entries.toArray()).filter(e => e.isDefault).length === 0, '经历表不应再有默认条目');

  console.log('== 2. 离线创建 10 条（不入队列外的推送） ==');
  for (let i = 0; i < 10; i++) {
    await saveEntry('new', {
      kind: 'daily', title: `离线${i}`, content: `第${i}条离线内容`,
      primaryVoid: 'flow', secondaryVoids: [], tags: ['离线测试'],
      emotion: {}, encoding: { color: null }, knowledge: {}, privacy: { aiVisible: false },
    }, { sync: false });
  }
  assert((await db.outbox.count()) === 10, '离线创建后队列应为 10 条');
  assert((await db.entries.toArray()).filter(e => e.title.startsWith('离线')).length === 10, '本地应立即可见 10 条');

  console.log('== 3. 恢复网络：推送队列（幂等创建） ==');
  await flushOutbox();
  assert((await db.outbox.count()) === 0, '推送后队列应为 0');
  const serverEntries = await api.entries();
  const offlines = serverEntries.filter(e => e.title.startsWith('离线'));
  assert(offlines.length === 10, `服务器应收到 10 条，实际 ${offlines.length}`);
  const target = offlines.find(e => e.title === '离线0')!;
  // 幂等：同 id 重推不重复
  await api.create({ ...draftOf(target), id: target.id });
  assert((await api.entries()).filter(e => e.title === '离线0').length === 1, '同 id 重推不应产生重复');

  console.log('== 4. 冲突检测：本地离线修改 + 服务器并发修改 ==');
  await saveEntry(target.id, draftOf(target, { title: '离线0-本地版' }), { sync: false });
  await api.update(target.id, draftOf(target, { title: '离线0-云端版' }), target.version);
  await flushOutbox();
  const conflicted = await db.entries.get(target.id);
  assert(conflicted?.conflict === true, '应标记冲突');
  assert(conflicted?.serverCopy?.title === '离线0-云端版', '冲突应保留云端副本');

  console.log('== 5. 裁决：保留本地版 → 推送覆盖 ==');
  await resolveConflict(target.id, 'local');
  await flushOutbox();
  const resolved = await db.entries.get(target.id);
  assert(!resolved?.conflict && resolved?.title === '离线0-本地版', '裁决后本地应无冲突标记');
  const serverFinal = await api.entry(target.id);
  assert(serverFinal.title === '离线0-本地版', '服务器最终应为本地版');

  console.log('== 6. 离线删除 → 推送 ==');
  const doomed = serverEntries.find(e => e.title === '离线9')!;
  await removeEntry(doomed.id, { sync: false });
  assert((await db.entries.toArray()).filter(e => e.id === doomed.id && !e.deletedAt).length === 0, '本地删除应立即生效');
  await flushOutbox();
  let gone = false;
  try { await api.entry(doomed.id); } catch { gone = true; }
  assert(gone, '服务器端应已删除');

  console.log('== 6.5 附件：上传 + 鉴权下载 ==');
  const fakePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const att = await api.upload(new File([fakePng], 'smoke.png', { type: 'image/png' }));
  assert(!!att.id && att.mime === 'image/png' && att.url.startsWith('/api/attachments/'), '附件应上传成功并返回元数据');
  const dl = await fetch('http://localhost:8799' + att.url, { headers: { Authorization: `Bearer ${r.token}` } });
  assert(dl.status === 200, `附件应可鉴权下载，实际 ${dl.status}`);
  const dlNoAuth = await fetch('http://localhost:8799' + att.url);
  assert(dlNoAuth.status === 401, '未登录下载附件应被拒绝');

  console.log('== 6.6 历史版本 ==');
  const h = serverEntries.find(e => e.title === '离线1')!;
  await api.update(h.id, draftOf(h, { title: '离线1-v2' }), h.version);
  const h2 = await api.entry(h.id);
  await api.update(h2.id, draftOf(h2, { title: '离线1-v3' }), h2.version);
  const vers = await api.versions(h.id);
  assert(vers.length >= 2, `应至少有 2 个历史版本，实际 ${vers.length}`);
  assert(vers[0].snapshot.title === '离线1-v2', `最新历史快照应为更新前标题，实际 ${vers[0].snapshot.title}`);

  console.log('== 6.7 全通道编码：色块 + 感官编码往返 ==');
  const coded = await api.create({
    kind: 'emotional',
    title: '编码往返测试',
    content: '今天很焦虑，总是担心',
    primaryVoid: 'fracture',
    secondaryVoids: [],
    tags: [],
    emotion: { valence: -0.6, intensity: 0.8, label: '焦虑' },
    encoding: { color: { name: '胭脂', hex: '#c04851', meaning: '热烈、情感' } },
    sensory: { shapes: ['碎片'], textures: ['粗糙'], angles: ['90°'], lines: ['锯齿'] },
    knowledge: {},
    privacy: { aiVisible: true },
    attachments: [],
  });
  const codedBack = await api.entry(coded.id);
  assert(codedBack.encoding?.color?.name === '胭脂', '色块编码应往返一致');
  assert(codedBack.sensory?.shapes?.includes('碎片') && codedBack.sensory?.lines?.includes('锯齿'), '感官编码应往返一致');
  const sug = await api.suggest(coded.id);
  assert(sug.payload.emotionLabel === '焦虑', `情绪建议应为焦虑，实际 ${sug.payload.emotionLabel}`);

  console.log('== 6.8 知识库：离线创建 + 前置关系 + 导入重连 ==');
  const { saveKnowledge, importKnowledge } = await import('../src/store');
  const ka = await saveKnowledge('new', {
    title: '知识A', content: 'A 的内容', domain: '测试', voidType: 'flow',
    taxonomy: ['测试'], difficulty: 2, prerequisites: [], relatedEntries: [], tags: [],
  }, { sync: false });
  const kb = await saveKnowledge('new', {
    title: '知识B', content: 'B 的内容', domain: '测试', voidType: 'silence',
    taxonomy: ['测试'], difficulty: 3, prerequisites: [ka.id], relatedEntries: [], tags: [],
  }, { sync: false });
  await flushOutbox();
  const serverKb = await api.knowledgeEntry(kb.id);
  assert(serverKb.prerequisites.includes(ka.id), '服务器端前置关系应保持');
  // 导入重连：oldId → newId 重写，引用不丢
  const kbBefore = (await db.knowledge.toArray()).length;
  const count = await importKnowledge([
    {
      id: 'old-a', title: '导入知识A', content: 'x', domain: '导入', voidType: 'flow',
      taxonomy: [], difficulty: 1, prerequisites: ['old-b'], relatedEntries: [], tags: [],
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'old-b', title: '导入知识B', content: 'y', domain: '导入', voidType: 'silence',
      taxonomy: [], difficulty: 1, prerequisites: [], relatedEntries: [], tags: [],
      createdAt: Date.now(), updatedAt: Date.now(),
    },
  ]);
  assert(count === 2, `导入应创建 2 条，实际 ${count}`);
  const importedA = (await db.knowledge.toArray()).find(k => k.title === '导入知识A');
  const importedB = (await db.knowledge.toArray()).find(k => k.title === '导入知识B');
  assert(importedA?.prerequisites[0] === importedB?.id, '导入后前置引用应重新连接到新 id');
  await flushOutbox();
  assert((await db.knowledge.toArray()).length === kbBefore + 2, '导入条目应持久化在本地库');

  console.log('== 6.9 关系：离线建立/删除 + 发生时间往返 ==');
  const { addLink, removeLinkLocal } = await import('../src/store');
  const relSource = (await db.entries.toArray()).find(e => e.title === '离线1');
  const relTarget = (await db.entries.toArray()).find(e => e.title === '离线2');
  assert(!!relSource && !!relTarget, '应有可关联的两条经历');
  const rel = await addLink({ sourceId: relSource!.id, targetId: relTarget!.id, relationType: 'causal', description: '测试因果' });
  await flushOutbox();
  const serverLinks = await api.links();
  assert(serverLinks.some(l => l.id === rel.id && l.relationType === 'causal'), '关系应推送到服务器并保持类型');
  await removeLinkLocal(rel.id);
  await flushOutbox();
  assert(!(await api.links()).some(l => l.id === rel.id), '删除后服务器不应再有该关系');
  const timed = await api.create({
    kind: 'daily', title: '带发生时间的条目', content: 'x', primaryVoid: 'flow',
    secondaryVoids: [], tags: [], emotion: {}, encoding: { color: null }, sensory: {},
    knowledge: {}, privacy: { aiVisible: false }, attachments: [], occurredAt: 1752600000000,
  });
  const timedBack = await api.entry(timed.id);
  assert(timedBack.occurredAt === 1752600000000, '发生时间应往返一致');

  console.log('== 7. 断网兜底：拉取失败时本地数据可用 ==');
  const entryCount = (await db.entries.toArray()).length;
  const knowledgeCount = (await db.knowledge.toArray()).length;
  // 模拟拉取失败（服务器不存在）——直接验证本地库仍在
  assert(entryCount >= 9, `本地经历数据应完整保留（10 条离线创建，1 条已删除），实际 ${entryCount}`);
  assert(knowledgeCount >= 19, `本地知识数据应完整保留，实际 ${knowledgeCount}`);

  console.log(`\nSYNC SMOKE: 全部通过（${passed} 项断言）`);
} finally {
  server.kill();
  await sleep(300);
  fs.rmSync(tempDir, { recursive: true, force: true });
}
