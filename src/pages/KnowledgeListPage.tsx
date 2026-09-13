import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import KnowledgeCard from '../components/KnowledgeCard';
import { VOIDS } from '../data';
import { importVaultFiles } from '../obsidianImport';
import { importKnowledge } from '../store';
import type { KnowledgeEntry, VoidId } from '../types';

/**
 * 知识库页（第 4 轮独立化）：
 * 默认知识包 + 个人知识条目；支持搜索、领域/七空/来源筛选；
 * 导入导出走本地 JSON（离线可用，导入时自动重写前置/相关引用保持链接关系）。
 */
export default function KnowledgeListPage({ knowledge, refresh }: { knowledge: KnowledgeEntry[]; refresh: () => Promise<void> }) {
  const [q, setQ] = useState('');
  const [domain, setDomain] = useState('');
  const [voidFilter, setVoidFilter] = useState('');
  const [origin, setOrigin] = useState(''); // '' 全部 | default | mine
  const [importMsg, setImportMsg] = useState('');
  const [vaultOpen, setVaultOpen] = useState(false);
  const [vaultDomain, setVaultDomain] = useState('心理健康');
  const [vaultVoid, setVaultVoid] = useState<VoidId>('silence');

  const domains = useMemo(() => [...new Set(knowledge.map(k => k.domain).filter(Boolean))].sort(), [knowledge]);

  const rows = knowledge.filter(k =>
    (!domain || k.domain === domain) &&
    (!voidFilter || k.voidType === voidFilter) &&
    (origin === '' || (origin === 'default' ? !!k.isDefault : !k.isDefault)) &&
    `${k.title} ${k.content} ${k.tags.join(' ')} ${k.taxonomy.join(' ')}`.toLowerCase().includes(q.toLowerCase())
  );

  const exportFile = () => {
    const payload = {
      exportedAt: Date.now(),
      format: 'infinity-knowledge',
      knowledge: rows.map(({ conflict, serverCopy, ...rest }) => rest),
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    a.download = `infinity-knowledge-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setImportMsg('');
    try {
      const data = JSON.parse(await f.text());
      const list = Array.isArray(data) ? data : data.knowledge;
      if (!Array.isArray(list) || list.length === 0) {
        setImportMsg('文件里没有可导入的知识条目');
        return;
      }
      const count = await importKnowledge(list as KnowledgeEntry[]);
      await refresh();
      setImportMsg(`已导入 ${count} 条知识（前置/相关引用已重新连接）。`);
    } catch {
      setImportMsg('导入失败：请选择本系统导出的知识库 JSON 文件');
    }
  };

  const importVault = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setImportMsg('');
    try {
      const r = await importVaultFiles(files, { domain: vaultDomain || '未分类', voidType: vaultVoid });
      await refresh();
      setVaultOpen(false);
      setImportMsg(`已从 Obsidian 文件夹导入 ${r.imported} 条知识（跳过 ${r.skipped} 个重复/无效文件，双链保留）。`);
    } catch {
      setImportMsg('文件夹导入失败：请选择 Obsidian vault 文件夹');
    }
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">默认知识包与个人知识</p>
          <h1>知识库</h1>
        </div>
        <div className="actions">
          <button className="secondary" onClick={() => setVaultOpen(!vaultOpen)}>导入 Obsidian 文件夹</button>
          <label className="secondary file-btn">
            导入 JSON
            <input type="file" accept="application/json,.json" onChange={importFile} />
          </label>
          <button className="secondary" onClick={exportFile}>导出 JSON</button>
          <Link className="primary" to="/knowledge/new">+ 新建知识</Link>
        </div>
      </header>
      {vaultOpen && (
        <div className="vault-import">
          <label>领域
            <input placeholder="如：心理健康" value={vaultDomain} onChange={e => setVaultDomain(e.target.value)} />
          </label>
          <label>七空归属
            <select value={vaultVoid} onChange={e => setVaultVoid(e.target.value as VoidId)}>
              {VOIDS.map(v => <option key={v.id} value={v.id}>{v.symbol} {v.name}</option>)}
            </select>
          </label>
          <label className="secondary file-btn">
            选择 vault 文件夹（读取 .md，保留双链，按内容去重）
            <input type="file" onChange={importVault} {...({ webkitdirectory: '' } as object)} />
          </label>
        </div>
      )}
      {importMsg && <p className="notice">{importMsg}</p>}
      <div className="filters">
        <input placeholder="搜索标题、正文或标签" value={q} onChange={e => setQ(e.target.value)} />
        <select value={domain} onChange={e => setDomain(e.target.value)}>
          <option value="">全部领域</option>
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={voidFilter} onChange={e => setVoidFilter(e.target.value)}>
          <option value="">全部空</option>
          {VOIDS.map(v => <option key={v.id} value={v.id}>{v.symbol} {v.name}</option>)}
        </select>
        <select value={origin} onChange={e => setOrigin(e.target.value)}>
          <option value="">全部来源</option>
          <option value="default">默认知识包</option>
          <option value="mine">我的知识</option>
        </select>
      </div>
      <div className="cards">
        {rows.map(k => <KnowledgeCard key={k.id} k={k} />)}
        {!rows.length && <p className="muted">没有匹配的知识条目。</p>}
      </div>
      <p className="muted" style={{ marginTop: 16 }}>
        共 {knowledge.length} 条（默认 {knowledge.filter(k => k.isDefault).length} 条 · 我的 {knowledge.filter(k => !k.isDefault).length} 条）。
        默认知识包离线可用；导出文件可重新导入，前置/相关引用会自动重新连接。
      </p>
    </>
  );
}
