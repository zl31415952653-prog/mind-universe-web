import { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { TYPES, VOIDS, voidById } from '../data';
import { RELATION_TYPES, relationById } from '../relations';
import { addLink } from '../store';
import type { Discovery, Entry, Link as LinkItem } from '../types';

/**
 * 关系图谱（第 5 轮）：Cytoscape 力导向布局。
 * 节点=经历（色=主空），边=八类关系（线型区分），支持类型/七空/关键词筛选，
 * 点击节点跳转详情，点击边查看关系说明。AI 建议边（source='ai'）以脉冲虚线区分。
 */
export default function GraphPage({ entries, links, discoveries, refresh, refreshDiscoveries }: {
  entries: Entry[];
  links: LinkItem[];
  discoveries: Discovery[];
  refresh: () => Promise<void>;
  refreshDiscoveries: () => Promise<void>;
}) {
  const nav = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [kind, setKind] = useState('');
  const [voidF, setVoidF] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<{ link: LinkItem; sourceTitle: string; targetTitle: string } | null>(null);
  const [discoverBusy, setDiscoverBusy] = useState(false);
  const [discoverMsg, setDiscoverMsg] = useState('');

  const runDiscover = async () => {
    setDiscoverBusy(true);
    setDiscoverMsg('');
    try {
      const r = await api.discover();
      setDiscoverMsg(r.payload.links.length > 0
        ? `发现 ${r.payload.links.length} 条候选关系（${r.provider === 'local-heuristic' ? '本地启发式' : 'AI 模型'}）`
        : (r.reason ?? '没有发现候选关系'));
      await refreshDiscoveries();
    } catch (err) {
      setDiscoverMsg(err instanceof Error ? err.message : '发现失败（需要联网）');
    } finally {
      setDiscoverBusy(false);
    }
  };

  const acceptCandidate = async (d: Discovery, index: number) => {
    const c = d.payload.links[index];
    try {
      await addLink({ sourceId: c.sourceId, targetId: c.targetId, relationType: c.relationType, strength: c.strength, description: c.reason, source: 'ai' });
      await api.suggestStatus(d.id, 'accepted');
      await Promise.all([refresh(), refreshDiscoveries()]);
    } catch (err) {
      setDiscoverMsg(err instanceof Error ? err.message : '接受失败');
    }
  };

  const rejectCandidate = async (d: Discovery) => {
    try {
      await api.suggestStatus(d.id, 'rejected');
      await refreshDiscoveries();
    } catch {
      /* 离线时忽略 */
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const cy = cytoscape({
      container: containerRef.current,
      wheelSensitivity: 0.2,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            label: 'data(label)',
            color: '#eaf0ff',
            'font-size': 10,
            'text-valign': 'bottom',
            'text-margin-y': 4,
            'text-wrap': 'ellipsis',
            'text-max-width': '72px',
            width: 12,
            height: 12,
            'border-width': 1,
            'border-color': '#22315c',
          },
        },
        {
          selector: 'edge',
          style: {
            'line-color': 'data(color)',
            'target-arrow-color': 'data(color)',
            'source-arrow-color': 'data(color)',
            'curve-style': 'data(curve)' as unknown as 'bezier' | 'taxi' | 'straight' | 'haystack' | 'unbundled-bezier' | 'segments',
            'line-style': 'data(lineStyle)' as unknown as cytoscape.Css.LineStyle,
            'target-arrow-shape': 'data(tArrow)' as unknown as cytoscape.Css.ArrowShape,
            'source-arrow-shape': 'data(sArrow)' as unknown as cytoscape.Css.ArrowShape,
            width: '1.5',
            opacity: 0.75,
            label: 'data(label)',
            'font-size': 9,
            color: '#93a1c8',
            'text-background-color': '#070b1c',
            'text-background-opacity': 0.85,
            'text-background-padding': '2',
          },
        },
        {
          selector: 'edge.ai',
          style: { 'line-style': 'dashed', 'line-color': '#f3c969', opacity: 1, 'line-dash-pattern': [4, 3] },
        },
        {
          selector: ':selected',
          style: { 'border-width': 2, 'border-color': '#f3c969', width: 16, height: 16 },
        },
      ],
      layout: { name: 'cose', animate: false, nodeRepulsion: () => 9000, idealEdgeLength: () => 90, padding: 40 },
    });
    cy.on('tap', 'node', evt => {
      const node = evt.target as cytoscape.NodeSingular;
      nav('/experience/' + node.id());
    });
    cy.on('tap', 'edge', evt => {
      const edge = evt.target as cytoscape.EdgeSingular;
      const l = links.find(x => x.id === edge.id());
      if (l) {
        setSelected({
          link: l,
          sourceTitle: entries.find(e => e.id === l.sourceId)?.title ?? '（已删除条目）',
          targetTitle: entries.find(e => e.id === l.targetId)?.title ?? '（已删除条目）',
        });
      }
    });
    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const mine = entries.filter(e => !e.isDefault);
    const visible = mine.filter(e =>
      (!kind || e.kind === kind) &&
      (!voidF || e.primaryVoid === voidF) &&
      (!q || `${e.title} ${e.content} ${e.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase()))
    );
    const ids = new Set(visible.map(e => e.id));
    const elLinks = links.filter(l => ids.has(l.sourceId) && ids.has(l.targetId));
    const aiEdges = discoveries.flatMap(d => d.payload.links.map((c, i) => ({ d, i, c })))
      .filter(x => ids.has(x.c.sourceId) && ids.has(x.c.targetId));
    cy.elements().remove();
    cy.add(visible.map(e => ({ group: 'nodes', data: { id: e.id, label: e.title, color: voidById(e.primaryVoid).color } })));
    cy.add(elLinks.map(l => {
      const def = relationById(l.relationType);
      return {
        group: 'edges',
        classes: l.source === 'ai' ? 'ai' : '',
        data: {
          id: l.id,
          source: l.sourceId,
          target: l.targetId,
          label: def.label,
          color: def.color,
          curve: def.curveStyle,
          lineStyle: def.lineStyle,
          tArrow: def.targetArrow ? 'triangle' : 'none',
          sArrow: def.sourceArrow ? 'triangle' : 'none',
        },
      };
    }));
    // AI 候选边（金色脉冲虚线，未确认）
    cy.add(aiEdges.map(({ d, i, c }) => ({
      group: 'edges',
      classes: 'ai',
      data: {
        id: 'ai-' + d.id + '-' + i,
        source: c.sourceId,
        target: c.targetId,
        label: 'AI建议',
        color: '#f3c969',
        curve: 'bezier',
        lineStyle: 'dashed',
        tArrow: 'none',
        sArrow: 'none',
      },
    })));
    cy.layout({ name: 'cose', animate: false, nodeRepulsion: () => 9000, idealEdgeLength: () => 90, padding: 40 }).run();
  }, [entries, links, discoveries, kind, voidF, q]);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">已确认的关系</p>
          <h1>关系图谱</h1>
          <p>节点是星尘，线是关系；点击节点进入条目，点击线查看说明。</p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={runDiscover} disabled={discoverBusy}>
            {discoverBusy ? '发现中…' : 'AI 发现关系'}
          </button>
        </div>
      </header>
      {discoverMsg && <p className="notice">{discoverMsg}</p>}
      <div className="filters">
        <input placeholder="搜索标题、正文或标签" value={q} onChange={e => setQ(e.target.value)} />
        <select value={kind} onChange={e => setKind(e.target.value)}>
          <option value="">全部类型</option>
          {(Object.entries(TYPES) as [string, string][]).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        <select value={voidF} onChange={e => setVoidF(e.target.value)}>
          <option value="">全部空</option>
          {VOIDS.map(v => <option key={v.id} value={v.id}>{v.symbol} {v.name}</option>)}
        </select>
      </div>
      <div className="graph-wrap">
        <div className="graph-canvas" ref={containerRef} />
        <div className="graph-legend">
          <b>关系图例</b>
          {RELATION_TYPES.map(r => (
            <span key={r.id} style={{ color: r.color }}>
              <i style={{ borderTopColor: r.color, borderTopStyle: r.lineStyle === 'double' ? 'double' : r.lineStyle }} />
              {r.label}
            </span>
          ))}
          <small>AI 建议边以金色脉冲虚线显示（第 7 轮接入后启用）。</small>
        </div>
      </div>
      {selected && (
        <div className="notice" style={{ marginTop: 12 }}>
          <b>{selected.sourceTitle} → {selected.targetTitle}</b>
          <p>关系类型：{relationById(selected.link.relationType).label}（{relationById(selected.link.relationType).desc}）· 强度 {Math.round(selected.link.strength * 100)}%{selected.link.description ? ` · ${selected.link.description}` : ''}</p>
        </div>
      )}
      {discoveries.length > 0 && (
        <section className="panel" style={{ marginTop: 14 }}>
          <h2>AI 候选关系（待你确认）</h2>
          <p className="muted">确认前只以金色虚线显示在图谱中，不会写入你的宇宙；接受后才成为正式关系。</p>
          {discoveries.map(d => d.payload.links.map((c, i) => {
            const st = entries.find(e => e.id === c.sourceId)?.title ?? '（已删除）';
            const tt = entries.find(e => e.id === c.targetId)?.title ?? '（已删除）';
            return (
              <div key={d.id + '-' + i} className="candidate-row">
                <b>{st}</b>
                <span style={{ color: relationById(c.relationType).color }}>{relationById(c.relationType).label}</span>
                <b>{tt}</b>
                <small>强度 {Math.round(c.strength * 100)}% · {c.reason}</small>
                <div className="actions">
                  <button className="secondary" onClick={() => acceptCandidate(d, i)}>接受</button>
                  <button className="text" onClick={() => rejectCandidate(d)}>拒绝</button>
                </div>
              </div>
            );
          }))}
        </section>
      )}
      <p className="muted">当前显示 {entries.filter(e => !e.isDefault).length} 个星尘与 {links.length} 条关系。建立/删除关系请在各条目的编辑页"关联条目"面板操作。</p>
    </>
  );
}
