import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import EntryCard from '../components/EntryCard';
import Universe from '../components/Universe';
import { VOIDS } from '../data';
import type { Entry, Link as LinkItem } from '../types';

/** 七空分布：横向条形图（第 5 轮仪表盘升级） */
function VoidDistribution({ entries }: { entries: Entry[] }) {
  const mine = entries.filter(e => !e.isDefault);
  const total = mine.length || 1;
  return (
    <section className="panel">
      <h2>七空分布</h2>
      {VOIDS.map(v => {
        const n = mine.filter(e => e.primaryVoid === v.id).length;
        return (
          <div key={v.id} className="dist-row">
            <span className="dist-label">{v.symbol} {v.name}</span>
            <div className="dist-track">
              <div className="dist-bar" style={{ width: `${(n / total) * 100}%`, background: v.color }} />
            </div>
            <b>{n}</b>
            <small>{Math.round((n / total) * 100)}%</small>
          </div>
        );
      })}
    </section>
  );
}

const BINS = [
  { label: '-1~-.6', min: -1, max: -0.6 },
  { label: '-.6~-.2', min: -0.6, max: -0.2 },
  { label: '-.2~.2', min: -0.2, max: 0.2 },
  { label: '.2~.6', min: 0.2, max: 0.6 },
  { label: '.6~1', min: 0.6, max: 1.01 },
];

/** 情感热力图：主空 × 情绪效价区间（第 5 轮仪表盘升级） */
function EmotionHeatmap({ entries }: { entries: Entry[] }) {
  const mine = entries.filter(e => !e.isDefault && typeof e.emotion?.valence === 'number');
  let max = 1;
  for (const v of VOIDS) {
    for (const b of BINS) {
      const n = mine.filter(e => e.primaryVoid === v.id && (e.emotion.valence ?? 0) >= b.min && (e.emotion.valence ?? 0) < b.max).length;
      if (n > max) max = n;
    }
  }
  return (
    <section className="panel">
      <h2>情感热力图 <small>主空 × 情绪效价分布</small></h2>
      <div className="heatmap">
        <span className="heat-corner" />
        {BINS.map(b => <span key={b.label} className="heat-head">{b.label}</span>)}
        {VOIDS.map(v => (
          <Fragment key={v.id}>
            <span className="heat-row">{v.symbol} {v.name}</span>
            {BINS.map((b, i) => {
              const n = mine.filter(e => e.primaryVoid === v.id && (e.emotion.valence ?? 0) >= b.min && (e.emotion.valence ?? 0) < b.max).length;
              return (
                <span
                  key={i}
                  className="heat-cell"
                  style={{ background: n ? `rgba(233,186,74,${0.08 + (n / max) * 0.85})` : 'rgba(255,255,255,0.03)' }}
                  title={`${v.name} × 效价${b.label}：${n} 条`}
                >
                  {n || ''}
                </span>
              );
            })}
          </Fragment>
        ))}
      </div>
      <small className="muted">效价来自情绪滑杆（-1 消极 … 1 积极）；颜色越亮条目越多。</small>
    </section>
  );
}

export default function DashboardPage({ entries, links }: { entries: Entry[]; links: LinkItem[] }) {
  const mine = entries.filter(e => !e.isDefault);
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">你的认知数据面貌</p>
          <h1>心智宇宙</h1>
          <p>每颗星尘都是一段被你确认过的经历。</p>
        </div>
        <Link className="primary" to="/experience/new">+ 记录经历</Link>
      </header>
      <Universe entries={entries} links={links} />
      <section className="void-stats">
        {VOIDS.map(v => (
          <div key={v.id} style={{ borderColor: v.color }}>
            <b>{entries.filter(e => e.primaryVoid === v.id).length}</b>
            <span>{v.symbol} {v.name}</span>
            <small>{v.question}</small>
          </div>
        ))}
      </section>
      <div className="dashboard-grid">
        <VoidDistribution entries={entries} />
        <EmotionHeatmap entries={entries} />
      </div>
      <section>
        <h2>最近星尘</h2>
        <div className="cards">
          {mine.slice(0, 6).map(e => <EntryCard key={e.id} entry={e} />)}
          {!mine.length && <p className="muted">从一条经历开始，宇宙会慢慢生长。</p>}
        </div>
      </section>
    </>
  );
}
