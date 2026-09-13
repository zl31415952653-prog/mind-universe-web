import { useEffect, useState } from 'react';
import { api } from '../api';
import { getMeta, setMeta } from '../db';
import type { KnowledgeEntry, LearnPlan } from '../types';

/**
 * AI 学习页（第 7 轮）：学习目标 → 选择资料（知识条目）→ 生成模块化分块计划 →
 * 逐块打勾推进进度 → 认知负荷提示。计划可编辑（删块/加块），不自动改变七空分类。
 * 学习状态保存在本地（meta），未做多设备同步（后续轮次）。
 */

interface Goal {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

interface LearningState {
  goals: Goal[];
  activeGoalId: string | null;
  materialIds: string[];
  plan: LearnPlan | null;
  planDone: boolean[];
  generatedAt: number;
  provider?: string;
}

const EMPTY: LearningState = {
  goals: [],
  activeGoalId: null,
  materialIds: [],
  plan: null,
  planDone: [],
  generatedAt: 0,
};

export default function LearnPage({ knowledge }: { knowledge: KnowledgeEntry[] }) {
  const [state, setState] = useState<LearningState | null>(null);
  const [goalInput, setGoalInput] = useState('');
  const [matQ, setMatQ] = useState('');
  const [manualChunk, setManualChunk] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      const saved = await getMeta<LearningState>('learning-state');
      setState(saved ?? EMPTY);
    })();
  }, []);

  const update = (fn: (s: LearningState) => LearningState) => setState(prev => {
    if (!prev) return prev;
    const next = fn(prev);
    void setMeta('learning-state', next);
    return next;
  });

  const activeGoal = state?.goals.find(g => g.id === state.activeGoalId) ?? null;
  const doneCount = state?.planDone.filter(Boolean).length ?? 0;
  const totalChunks = state?.plan?.chunks.length ?? 0;

  const addGoal = () => {
    const text = goalInput.trim();
    if (!text) return;
    update(s => {
      const g: Goal = { id: crypto.randomUUID(), text, done: false, createdAt: Date.now() };
      return { ...s, goals: [...s.goals, g], activeGoalId: s.activeGoalId ?? g.id };
    });
    setGoalInput('');
  };

  const generate = async () => {
    if (!state) return;
    if (!activeGoal) {
      setError('请先添加并选择一个学习目标');
      return;
    }
    if (state.materialIds.length === 0) {
      setError('请先选择至少一份学习资料');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const progress = `${doneCount}/${totalChunks} 分块已完成`;
      const r = await api.learn(activeGoal.text, state.materialIds, progress);
      update(s => ({ ...s, plan: r.plan, planDone: r.plan.chunks.map(() => false), generatedAt: r.createdAt, provider: r.provider }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败（需要联网）');
    } finally {
      setBusy(false);
    }
  };

  const materials = knowledge.filter(k => !k.deletedAt && `${k.title} ${k.domain}`.includes(matQ));

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">可控的学习辅助</p>
          <h1>AI 学习</h1>
          <p>把目标拆小、关联已有知识，并由你决定路径——AI 只生成建议计划，不替你分类。</p>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      <div className="learn-grid">
        <section className="panel">
          <h2>学习目标</h2>
          <div className="learn-input-row">
            <input placeholder="如：两个月内掌握认知负荷理论" value={goalInput} onChange={e => setGoalInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGoal(); } }} />
            <button className="secondary" onClick={addGoal}>添加</button>
          </div>
          {state?.goals.map(g => (
            <div key={g.id} className="goal-row">
              <input type="radio" name="active-goal" checked={state.activeGoalId === g.id} onChange={() => update(s => ({ ...s, activeGoalId: g.id }))} />
              <span style={{ textDecoration: g.done ? 'line-through' : 'none', opacity: g.done ? 0.55 : 1 }}>{g.text}</span>
              <button type="button" className="text" onClick={() => update(s => ({ ...s, goals: s.goals.map(x => x.id === g.id ? { ...x, done: !x.done } : x) }))}>{g.done ? '恢复' : '完成'}</button>
              <button type="button" className="text danger" onClick={() => update(s => ({ ...s, goals: s.goals.filter(x => x.id !== g.id), activeGoalId: s.activeGoalId === g.id ? null : s.activeGoalId }))}>删除</button>
            </div>
          ))}
          {!state?.goals.length && <small className="muted">还没有目标；添加一个，例如"两个月内掌握认知负荷理论"。</small>}
        </section>

        <section className="panel">
          <h2>学习资料 <small>已选 {state?.materialIds.length ?? 0} 条</small></h2>
          <input placeholder="搜索知识条目…" value={matQ} onChange={e => setMatQ(e.target.value)} />
          <div className="link-picker" style={{ maxHeight: 200 }}>
            {materials.slice(0, 40).map(k => (
              <label key={k.id}>
                <input type="checkbox" checked={state?.materialIds.includes(k.id) ?? false} onChange={() => update(s => ({ ...s, materialIds: s.materialIds.includes(k.id) ? s.materialIds.filter(x => x !== k.id) : [...s.materialIds, k.id] }))} />
                {k.title} <small>{k.domain} · 难度 {k.difficulty}</small>
              </label>
            ))}
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: 0 }}>学习计划 {state?.provider && <small>{state.provider === 'local-heuristic' ? '本地规则版' : 'AI 生成'}</small>}</h2>
          <button className="primary" onClick={generate} disabled={busy}>{busy ? '生成中…' : '生成学习计划'}</button>
        </div>
        {state?.plan ? (
          <>
            <div className="progress-track" style={{ marginTop: 14 }}>
              <div className="progress-bar" style={{ width: `${totalChunks ? (doneCount / totalChunks) * 100 : 0}%` }} />
            </div>
            <small className="muted">进度：{doneCount}/{totalChunks} 分块 · 生成于 {new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(state.generatedAt)}</small>
            {state.plan.chunks.map((c, i) => (
              <div key={i} className="chunk-row">
                <input type="checkbox" checked={state.planDone[i] ?? false} onChange={() => update(s => ({ ...s, planDone: s.planDone.map((d, j) => (j === i ? !d : d)) }))} />
                <div>
                  <b>{c.title}</b>
                  <small>约 {c.days} 天</small>
                  <p>{c.description}</p>
                </div>
                <button type="button" className="text danger" onClick={() => update(s => ({ ...s, plan: s.plan ? { ...s.plan, chunks: s.plan.chunks.filter((_, j) => j !== i) } : s.plan, planDone: s.planDone.filter((_, j) => j !== i) }))}>删</button>
              </div>
            ))}
            <div className="learn-input-row" style={{ marginTop: 10 }}>
              <input placeholder="手动加分块（计划可编辑）" value={manualChunk} onChange={e => setManualChunk(e.target.value)} />
              <button className="secondary" onClick={() => {
                const t = manualChunk.trim();
                if (!t) return;
                update(s => ({ ...s, plan: s.plan ? { ...s.plan, chunks: [...s.plan.chunks, { title: t, description: '手动添加的分块', days: 1 }] } : s.plan, planDone: [...s.planDone, false] }));
                setManualChunk('');
              }}>加分块</button>
            </div>
            {state.plan.reviewAdvice && (
              <div className="notice" style={{ marginTop: 12 }}><b>复习建议</b><p>{state.plan.reviewAdvice}</p></div>
            )}
            {state.plan.cognitiveLoadNote && (
              <div className="notice" style={{ marginTop: 8 }}><b>认知负荷提示</b><p>{state.plan.cognitiveLoadNote}</p></div>
            )}
          </>
        ) : (
          <p className="muted" style={{ marginTop: 10 }}>选择目标和资料后生成模块化计划。断网时使用本地规则版；接入 AI 模型后使用个性化计划。</p>
        )}
      </section>
    </>
  );
}
