import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import UniverseCanvas from './UniverseCanvas';
import { AuthorizationAuditEvent, defaultPrivacy, DiscoverySuggestion, getVoid, Relation, Entry, ExperienceKind, KnowledgeEntry, KnowledgeRelation, LearningMaterial, LearningProject, LearningSuggestion, LearningTask, ShareGrant, Transition, VOIDS, VoidId } from './domain';
import { Atlas, hydrateAtlas, hydrateHiddenReflections, loadAtlas, saveAtlas, saveHiddenReflections } from './storage';
import { buildReflections } from './reflections';
import './review.css';
import { buildQuestionThreads, pathFor, type QuestionThread } from './paths';
import './paths.css';
import './library.css';
import { askMirror, askModel, localProposal, type AiConfig, type DialogueMessage, type DialogueProposal, type MirrorResponse } from './ai';
import './dialogue.css';
import './explorer.css';
import './mobile.css';
import './ui.css';
import './atmosphere.css';
import './structure.css';
import './cosmos-motion.css';
import './record-inspector.css';
import LearningWorkbench from './LearningWorkbench';
import NotesWorkspace from './NotesWorkspace';
import DiscoveryPanel from './DiscoveryPanel';
import { discoverLocal } from './discovery';
import AuthorizationCenter from './AuthorizationCenter';
import AccountCenter from './AccountCenter';
import { starterTasks } from './learning';
import { defaultKnowledgePack } from './defaultKnowledge';

const colors = [['靛青','#5968d9'],['青碧','#2dbb9c'],['朱砂','#ef5b61'],['月白','#bac8dd'],['明黄','#f3c75f'],['紫檀','#ad69e5']];
const emotions = ['好奇','平静','迷茫','欣喜','焦虑','悲伤','愤怒','松动','笃定'];
type TimeRange = 'all' | '7d' | '30d' | '90d' | 'year';
type UniverseLens = 'atlas' | 'connections' | 'path' | 'knowledge';
const rangeLabels: Record<TimeRange,string> = { all:'所有时间', '7d':'近 7 天', '30d':'近 30 天', '90d':'近 90 天', year:'今年' };
function inRange(createdAt:number, range:TimeRange) { if(range==='all') return true; const now=Date.now(); if(range==='year') return new Date(createdAt).getFullYear()===new Date(now).getFullYear(); const days=range==='7d'?7:range==='30d'?30:90; return createdAt>=now-days*86400000; }
function includesQuery(value:string, query:string) { return value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()); }
function monthKey(createdAt:number) { const date=new Date(createdAt); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; }
function monthLabel(key:string) { const [year,month]=key.split('-'); return `${year} 年 ${Number(month)} 月`; }

function App() {
  const initial = loadAtlas();
  const [entries, setEntries] = useState<Entry[]>(initial.entries);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>(initial.knowledge);
  const [learningProjects, setLearningProjects] = useState<LearningProject[]>(initial.learningProjects);
  const [learningMaterials, setLearningMaterials] = useState<LearningMaterial[]>(initial.learningMaterials);
  const [learningSuggestions, setLearningSuggestions] = useState<LearningSuggestion[]>(initial.learningSuggestions);
  const [learningTasks, setLearningTasks] = useState<LearningTask[]>(initial.learningTasks);
  const [knowledgeRelations, setKnowledgeRelations] = useState<KnowledgeRelation[]>(initial.knowledgeRelations);
  const [discoverySuggestions, setDiscoverySuggestions] = useState<DiscoverySuggestion[]>(initial.discoverySuggestions);
  const [authorizationAudit, setAuthorizationAudit] = useState<AuthorizationAuditEvent[]>(initial.authorizationAudit);
  const [learningOpen, setLearningOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeEntry | null>(null);
  const [relations, setRelations] = useState<Relation[]>(initial.relations);
  const [transitions, setTransitions] = useState<Transition[]>(initial.transitions);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [composer, setComposer] = useState(false);
  const [dialogue, setDialogue] = useState(false);
  const [knowledgeStudio, setKnowledgeStudio] = useState(false);
  const [relationStudio, setRelationStudio] = useState(false);
  const [transitionStudio, setTransitionStudio] = useState(false);
  const [filter, setFilter] = useState<VoidId | null>(null);
  const [query, setQuery] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [universeLens, setUniverseLens] = useState<UniverseLens>('atlas');
  const [universeZoom, setUniverseZoom] = useState(0);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [hiddenReflections, setHiddenReflections] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [aiConfig, setAiConfig] = useState<AiConfig>({mode:'local',endpoint:'https://api.deepseek.com',model:'deepseek-flash',apiKey:''});
  const openAccount = () => { setPrivacyOpen(true); window.setTimeout(() => document.getElementById('account')?.scrollIntoView({ block: 'center' }), 0); };
  useEffect(() => {
    let active = true;
    void Promise.all([hydrateAtlas(), hydrateHiddenReflections()]).then(([atlas, hidden]) => {
      if (!active) return;
      setEntries(atlas.entries); setKnowledge(atlas.knowledge); setRelations(atlas.relations); setTransitions(atlas.transitions);
      setLearningProjects(atlas.learningProjects); setLearningMaterials(atlas.learningMaterials); setLearningSuggestions(atlas.learningSuggestions); setLearningTasks(atlas.learningTasks); setKnowledgeRelations(atlas.knowledgeRelations); setDiscoverySuggestions(atlas.discoverySuggestions); setAuthorizationAudit(atlas.authorizationAudit);
      setSelected(current => current ? (atlas.entries.find(e => e.id === current.id) ?? null) : null);
      setHiddenReflections(hidden); setStorageReady(true);
    }).catch(() => { if (active) setStorageReady(true); });
    return () => { active = false; };
  }, []);
  const visible = useMemo(() => entries.filter(entry => (!filter || entry.primaryVoid===filter) && (!monthFilter || monthKey(entry.createdAt)===monthFilter) && inRange(entry.createdAt,timeRange) && includesQuery(`${entry.title} ${entry.body} ${entry.signal.emotion||''} ${entry.signal.texture||''}`,query)).sort((a,b)=>b.createdAt-a.createdAt), [entries, filter, timeRange, monthFilter, query]);
  const visibleKnowledge = useMemo(() => knowledge.filter(item => (!filter || item.voidType===filter) && (!monthFilter || monthKey(item.createdAt)===monthFilter) && inRange(item.createdAt,timeRange) && includesQuery(`${item.title} ${item.summary} ${item.source||''} ${item.tags.join(' ')}`,query)).sort((a,b)=>b.createdAt-a.createdAt), [knowledge, filter, timeRange, monthFilter, query]);
  const months = useMemo(() => Array.from(new Set([...entries,...knowledge].map(item=>monthKey(item.createdAt)))).sort((a,b)=>b.localeCompare(a)).slice(0,12), [entries,knowledge]);
  const persist = (nextEntries: Entry[], nextRelations = relations, nextTransitions = transitions, nextKnowledge = knowledge, nextProjects = learningProjects, nextMaterials = learningMaterials, nextSuggestions = learningSuggestions, nextTasks = learningTasks, nextKnowledgeRelations = knowledgeRelations, nextDiscovery = discoverySuggestions, nextAudit = authorizationAudit) => {
    setEntries(nextEntries); setRelations(nextRelations); setTransitions(nextTransitions); setKnowledge(nextKnowledge);
    setLearningProjects(nextProjects); setLearningMaterials(nextMaterials); setLearningSuggestions(nextSuggestions); setLearningTasks(nextTasks); setKnowledgeRelations(nextKnowledgeRelations); setDiscoverySuggestions(nextDiscovery); setAuthorizationAudit(nextAudit);
    void saveAtlas({ entries: nextEntries, knowledge: nextKnowledge, relations: nextRelations, transitions: nextTransitions, learningProjects: nextProjects, learningMaterials: nextMaterials, learningSuggestions: nextSuggestions, learningTasks: nextTasks, knowledgeRelations: nextKnowledgeRelations, discoverySuggestions: nextDiscovery, authorizationAudit: nextAudit });
  };
  const create = (draft: Omit<Entry, 'id' | 'createdAt'>) => {
    const entry: Entry = { ...draft, privacy: draft.privacy ?? defaultPrivacy(), id: crypto.randomUUID(), createdAt: Date.now() };
    const nextEntries = [entry, ...entries];
    const near = entries.filter(item => item.primaryVoid === entry.primaryVoid).slice(0, 1);
    const nextRelations = near.length ? [...relations, { id: crypto.randomUUID(), from: entry.id, to: near[0].id, type: 'resonance' as const, reason: '在同一空域里出现的相近经历' }] : relations;
    persist(nextEntries, nextRelations); setSelected(entry); setComposer(false);
  };
  const saveNote = (note: Entry) => {
    const next = entries.some(entry => entry.id === note.id) ? entries.map(entry => entry.id === note.id ? note : entry) : [note, ...entries];
    persist(next);
  };
  const deleteNote = (entry: Entry) => {
    const nextEntries = entries.filter(item => item.id !== entry.id);
    const nextRelations = relations.filter(item => item.from !== entry.id && item.to !== entry.id);
    const nextTransitions = transitions.filter(item => item.entryId !== entry.id);
    const nextDiscovery = discoverySuggestions.filter(item => item.from !== entry.id && item.to !== entry.id);
    persist(nextEntries, nextRelations, nextTransitions, knowledge, learningProjects, learningMaterials, learningSuggestions, learningTasks, knowledgeRelations, nextDiscovery);
    setSelected(current => current?.id === entry.id ? (nextEntries[0] ?? null) : current);
  };
  const addRelation = (target: Entry, type: Relation['type'], reason: string) => {
    if (!selected || relations.some(r => (r.from === selected.id && r.to === target.id) || (r.to === selected.id && r.from === target.id))) return;
    persist(entries, [...relations, { id: crypto.randomUUID(), from: selected.id, to: target.id, type, reason }]); setRelationStudio(false);
  };
  const addTransition = (to: VoidId, reason: string) => {
    if (!selected || to === selected.primaryVoid) return;
    const transition: Transition = { id: crypto.randomUUID(), entryId: selected.id, from: selected.primaryVoid, to, reason, createdAt: Date.now() };
    const moved = { ...selected, primaryVoid: to };
    const nextEntries = entries.map(e => e.id === selected.id ? moved : e);
    persist(nextEntries, relations, [...transitions, transition]); setSelected(moved); setTransitionStudio(false);
  };
  const addKnowledge = (item: Omit<KnowledgeEntry, 'id' | 'createdAt'>) => {
    const next = [{ ...item, id: crypto.randomUUID(), createdAt: Date.now() }, ...knowledge];
    persist(entries, relations, transitions, next); setKnowledgeStudio(false);
  };
  const addDefaultKnowledge = () => {
    const existing = new Set(knowledge.map(item => item.id));
    const additions = defaultKnowledgePack.filter(item => !existing.has(item.id));
    if (!additions.length) return;
    persist(entries, relations, transitions, [...knowledge, ...additions]);
  };
  const createLearningProject = (draft: Omit<LearningProject, 'id' | 'createdAt'>) => {
    const project: LearningProject = { ...draft, id: crypto.randomUUID(), createdAt: Date.now() };
    persist(entries, relations, transitions, knowledge, [project, ...learningProjects]);
  };
  const ingestLearningMaterial = (material: LearningMaterial, suggestions: LearningSuggestion[]) => {
    persist(entries, relations, transitions, knowledge, learningProjects, [material, ...learningMaterials], [...suggestions, ...learningSuggestions]);
  };
  const confirmLearningSuggestion = (id: string, primaryVoid: VoidId, secondaryVoids: VoidId[]) => {
    const suggestion = learningSuggestions.find(item => item.id === id);
    const material = suggestion && learningMaterials.find(item => item.id === suggestion.materialId);
    if (!suggestion || !material || suggestion.confirmedAt) return;
    const project = learningProjects.find(item => item.id === material.projectId);
    if (!project) return;
    const knowledgeEntry: KnowledgeEntry = { id: crypto.randomUUID(), title: suggestion.title, summary: suggestion.summary, voidType: primaryVoid, source: material.source, tags: suggestion.keywords, linkedEntryIds: [], createdAt: Date.now() };
    const confirmed = learningSuggestions.map(item => item.id === id ? { ...item, primaryVoid, secondaryVoids, confirmedAt: Date.now(), knowledgeEntryId: knowledgeEntry.id } : item);
    const tasks = [...starterTasks(project, { ...suggestion, primaryVoid, secondaryVoids }), ...learningTasks];
    persist(entries, relations, transitions, [knowledgeEntry, ...knowledge], learningProjects, learningMaterials, confirmed, tasks);
  };
  const toggleLearningTask = (id: string) => {
    const tasks = learningTasks.map(task => task.id === id ? { ...task, doneAt: task.doneAt ? undefined : Date.now() } : task);
    persist(entries, relations, transitions, knowledge, learningProjects, learningMaterials, learningSuggestions, tasks);
  };
  const addKnowledgeRelation = (draft: Omit<KnowledgeRelation, 'id' | 'createdAt'>) => {
    if (draft.from === draft.to || knowledgeRelations.some(item => item.from === draft.from && item.to === draft.to && item.type === draft.type)) return;
    persist(entries, relations, transitions, knowledge, learningProjects, learningMaterials, learningSuggestions, learningTasks, [...knowledgeRelations, { ...draft, id: crypto.randomUUID(), createdAt: Date.now() }]);
  };
  const runDiscovery = () => {
    const candidates = discoverLocal(entries, relations).filter(item => !discoverySuggestions.some(old => old.from === item.from && old.to === item.to));
    persist(entries, relations, transitions, knowledge, learningProjects, learningMaterials, learningSuggestions, learningTasks, knowledgeRelations, [...candidates, ...discoverySuggestions]);
  };
  const addDiscoverySuggestions = (candidates: DiscoverySuggestion[]) => {
    const additions = candidates.filter(item => !discoverySuggestions.some(old => (old.from === item.from && old.to === item.to) || (old.from === item.to && old.to === item.from)) && !relations.some(relation => (relation.from === item.from && relation.to === item.to) || (relation.from === item.to && relation.to === item.from)));
    if (additions.length) persist(entries, relations, transitions, knowledge, learningProjects, learningMaterials, learningSuggestions, learningTasks, knowledgeRelations, [...additions, ...discoverySuggestions]);
  };
  const acceptDiscovery = (item: DiscoverySuggestion) => {
    const nextRelations = [...relations, { id: crypto.randomUUID(), from: item.from, to: item.to, type: item.type, reason: item.reason }];
    const nextDiscovery = discoverySuggestions.map(candidate => candidate.id === item.id ? { ...candidate, status: 'accepted' as const } : candidate);
    persist(entries, nextRelations, transitions, knowledge, learningProjects, learningMaterials, learningSuggestions, learningTasks, knowledgeRelations, nextDiscovery);
  };
  const dismissDiscovery = (id: string) => persist(entries, relations, transitions, knowledge, learningProjects, learningMaterials, learningSuggestions, learningTasks, knowledgeRelations, discoverySuggestions.map(item=>item.id===id?{...item,status:'dismissed' as const}:item));
  const createGrant = (entryId: string, grant: ShareGrant) => {
    const nextEntries = entries.map(entry => entry.id === entryId ? { ...entry, privacy: { ...entry.privacy, shareGrants: [...entry.privacy.shareGrants, grant] } } : entry);
    const nextAudit = [...authorizationAudit, { id: crypto.randomUUID(), entryId, grantId: grant.id, action: 'created' as const, createdAt: Date.now() }];
    persist(nextEntries, relations, transitions, knowledge, learningProjects, learningMaterials, learningSuggestions, learningTasks, knowledgeRelations, discoverySuggestions, nextAudit);
  };
  const revokeGrant = (entryId: string, grantId: string) => {
    const nextEntries = entries.map(entry => entry.id === entryId ? { ...entry, privacy: { ...entry.privacy, shareGrants: entry.privacy.shareGrants.map(grant => grant.id === grantId ? { ...grant, revokedAt: Date.now() } : grant) } } : entry);
    const nextAudit = [...authorizationAudit, { id: crypto.randomUUID(), entryId, grantId, action: 'revoked' as const, createdAt: Date.now() }];
    persist(nextEntries, relations, transitions, knowledge, learningProjects, learningMaterials, learningSuggestions, learningTasks, knowledgeRelations, discoverySuggestions, nextAudit);
  };
  const reflections = buildReflections(entries, relations, transitions).filter(item => !hiddenReflections.includes(item.id));
  const questionThreads = buildQuestionThreads(entries, relations);
  const hideReflection = (id: string) => { const next = [...hiddenReflections, id]; setHiddenReflections(next); void saveHiddenReflections(next); };
  const restoreBackup = (atlas: Atlas, hidden: string[]) => {
    persist(atlas.entries, atlas.relations, atlas.transitions, atlas.knowledge, atlas.learningProjects, atlas.learningMaterials, atlas.learningSuggestions, atlas.learningTasks, atlas.knowledgeRelations, atlas.discoverySuggestions, atlas.authorizationAudit);
    setSelected(null); setSelectedKnowledge(null);
    setHiddenReflections(hidden); void saveHiddenReflections(hidden);
  };
  if (learningOpen) return <LearningWorkbench projects={learningProjects} materials={learningMaterials} suggestions={learningSuggestions} tasks={learningTasks} knowledge={knowledge} knowledgeRelations={knowledgeRelations} onClose={()=>setLearningOpen(false)} onCreateProject={createLearningProject} onIngestMaterial={ingestLearningMaterial} onConfirm={confirmLearningSuggestion} onToggleTask={toggleLearningTask} onAddKnowledgeRelation={addKnowledgeRelation}/>;
  if (notesOpen) return <NotesWorkspace entries={entries} onClose={()=>setNotesOpen(false)} onSave={saveNote} onDelete={deleteNote} onSelect={entry=>{setSelected(entry);setNotesOpen(false);}}/>;
  return <main className="app-shell"><div className="cosmic-meteors" aria-hidden="true" />
    <header className="topbar"><a className="wordmark" href="#top"><i>∞</i><span>心智宇宙</span><small>个人认知工作台</small></a><div className="top-actions"><span className="local-dot">{storageReady ? '已离线保存' : '准备本地宇宙'}</span><button className="text-btn" onClick={()=>setNotesOpen(true)}>笔记</button><button className="text-btn" onClick={()=>setLearningOpen(true)}>学习</button><button className="text-btn account-trigger" onClick={openAccount}><span className="account-long">登录同步</span><span className="account-short">同步</span></button><button className="text-btn privacy-trigger" onClick={()=>setPrivacyOpen(true)}>隐私</button><button className="capture-button" onClick={() => setDialogue(true)}>记录此刻 <b>＋</b></button></div></header>
    <section className="hero" id="top"><div className="hero-copy"><p className="overline">PERSONAL COGNITIVE ATLAS</p><h1>让经历，<em>有地方生长。</em></h1><p className="intro">这里不是把人生装进文件夹。每一段经历会成为星尘，在七种看待世界的方式之间，慢慢显出它的意义。</p><div className="hero-cta"><button className="capture-button" onClick={()=>setDialogue(true)}>记录此刻 <b>＋</b></button><button className="hero-secondary" onClick={()=>setNotesOpen(true)}>浏览笔记 <span>↗</span></button></div><div className="hero-meta"><span>{entries.length} 颗星尘</span><span>{knowledge.length} 枚知识晶体</span><span>{relations.length} 条已看见的联系</span><span>{transitions.length} 次自我确认的变化</span></div></div><div className="universe-stage"><UniverseCanvas entries={visible} knowledge={visibleKnowledge} knowledgeRelations={knowledgeRelations.filter(relation=>visibleKnowledge.some(item=>item.id===relation.from)&&visibleKnowledge.some(item=>item.id===relation.to))} relations={relations.filter(r => visible.some(e => e.id === r.from) && visible.some(e => e.id === r.to))} transitions={transitions} selectedId={selected?.id} lens={universeLens} zoom={universeZoom} onSelect={setSelected} onSelectKnowledge={setSelectedKnowledge}/><div className="universe-lenses"><button className={universeLens==='atlas'?'active':''} onClick={()=>setUniverseLens('atlas')}>全景</button><button className={universeLens==='connections'?'active':''} onClick={()=>setUniverseLens('connections')}>关系</button><button className={universeLens==='path'?'active':''} onClick={()=>setUniverseLens('path')}>路径</button><button className={universeLens==='knowledge'?'active':''} onClick={()=>setUniverseLens('knowledge')}>知识</button></div><div className="universe-zoom" aria-label="星图视角控制"><button onClick={()=>setUniverseZoom(value=>Math.max(-6,value-2))} aria-label="拉近星图">＋</button><button onClick={()=>setUniverseZoom(value=>Math.min(6,value+2))} aria-label="拉远星图">－</button><button className="zoom-reset" onClick={()=>{setUniverseZoom(0);setUniverseLens('atlas');}} aria-label="重置星图视角">重置</button></div><div className="universe-status"><i style={{background:selected?getVoid(selected.primaryVoid).color:'#f3c75f'}}/>{selected?<><span>正在观察</span><strong>{selected.title}</strong></>:<><span>当前视野</span><strong>从一颗星尘开始</strong></>}<small>{visible.length} 段经历在此刻可见</small></div><div className="canvas-note">{universeLens==='atlas'?'圆形＝经历 · 晶体＝资料 · 拖拽改变视角':universeLens==='connections'?'展示已确认的经历联系':universeLens==='path'?'展示已确认的空域迁移':'展示经历与知识素材的关联'}</div></div></section>
    <section className="atlas-nav"><div><p className="overline">SEVEN EMPTIES</p><h2>从哪里，找回一段痕迹？</h2></div><div className="void-list">{VOIDS.map(v => <button key={v.id} className={filter === v.id ? 'active' : ''} style={{ '--void': v.color } as CSSProperties} onClick={() => setFilter(filter === v.id ? null : v.id)}><i>{v.symbol}</i><span>{v.name}</span></button>)}</div><div className="explorer-tools"><label className="search-box"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索经历、资料、情绪或标签"/></label><RangePicker value={timeRange} onChange={value=>{setTimeRange(value);setMonthFilter(null);}}/>{(filter||query||timeRange!=='all'||monthFilter)&&<button className="text-btn" onClick={()=>{setFilter(null);setQuery('');setTimeRange('all');setMonthFilter(null);}}>清除筛选</button>}<small>当前显示 {visible.length} 段经历 · {visibleKnowledge.length} 条资料</small></div>{months.length>1&&<div className="month-rail"><span>时间轨道</span><button className={!monthFilter?'active':''} onClick={()=>setMonthFilter(null)}>全部</button>{months.map(month=><button key={month} className={monthFilter===month? 'active':''} onClick={()=>{setMonthFilter(monthFilter===month?null:month);setTimeRange('all');}}>{monthLabel(month)}</button>)}</div>}</section>
    {reflections.length > 0 && <section className="review"><div className="section-head"><div><p className="overline">LOOKING BACK, GENTLY</p><h2>从已经发生的事里，看见一点线索</h2><p>每张卡都只依据你已经记录和确认过的内容；它不是诊断，也不要求你同意。</p></div></div><div className="review-grid">{reflections.map(item => <article key={item.id}><p className="overline">{item.eyebrow}</p><h3>{item.title}</h3><p>{item.body}</p><div className="evidence">{item.entryIds.map(id => { const entry = entries.find(e => e.id === id); return entry ? <button key={id} onClick={() => setSelected(entry)}>↗ {entry.title}</button> : null; })}</div><button className="dismiss" onClick={() => hideReflection(item.id)}>暂不看这条观察</button></article>)}</div></section>}
    <AiMirror config={aiConfig} entries={entries} relations={relations} transitions={transitions} onSelect={setSelected}/>
    {selected && <PathSection entry={selected} transitions={transitions} threads={questionThreads} entries={entries} onSelect={setSelected}/>} 
    {selected && <RecordInspector entry={selected} entries={entries} relations={relations} transitions={transitions} onClose={() => setSelected(null)} onWrite={() => setComposer(true)} onRelate={() => setRelationStudio(true)} onMove={() => setTransitionStudio(true)} onSelect={setSelected} />}
    <Library knowledge={visibleKnowledge} entries={entries} focus={selectedKnowledge} onSelect={setSelectedKnowledge} onCreate={() => setKnowledgeStudio(true)} onSeedDefaults={addDefaultKnowledge} />
    <DiscoveryPanel entries={entries} suggestions={discoverySuggestions} onRun={runDiscovery} onAdd={addDiscoverySuggestions} onAccept={acceptDiscovery} onDismiss={dismissDiscovery} onOpen={setSelected}/>
    <section className="timeline"><div className="section-head"><div><p className="overline">TIME, MADE VISIBLE</p><h2>沿时间，回到发生的地方</h2><p>显示条件：{filter?getVoid(filter).name:'全部空域'} · {monthFilter?monthLabel(monthFilter):rangeLabels[timeRange]}{query?` · “${query}”`:''}</p></div><button className="text-btn" onClick={() => setDialogue(true)}>写下一段新的经历 →</button></div>{visible.length?<div className="trace-list">{visible.slice(0, 12).map(e => { const v = getVoid(e.primaryVoid); return <button className={selected?.id === e.id ? 'trace active' : 'trace'} key={e.id} onClick={() => setSelected(e)}><i style={{ background: v.color }}/><time>{new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'short',day:'numeric'}).format(e.createdAt)}</time><span>{v.symbol} {v.name}</span><strong>{e.title}</strong><small>{e.signal.emotion || '未命名的感受'}</small></button>; })}</div>:<div className="timeline-empty">这个筛选下还没有经历。<button className="text-btn" onClick={()=>{setFilter(null);setQuery('');setTimeRange('all');setMonthFilter(null);}}>查看全部记录 →</button></div>}</section>
    <button className="mobile-capture" aria-label="记录此刻" onClick={()=>setDialogue(true)}><span>＋</span>记录此刻</button>{privacyOpen && <PrivacySheet entries={entries} audit={authorizationAudit} atlas={{entries, knowledge, relations, transitions, learningProjects, learningMaterials, learningSuggestions, learningTasks, knowledgeRelations, discoverySuggestions, authorizationAudit}} hiddenReflections={hiddenReflections} onRestoreBackup={restoreBackup} onCreateGrant={createGrant} onRevokeGrant={revokeGrant} onClose={()=>setPrivacyOpen(false)}/>} {dialogue && <DialogueStudio config={aiConfig} onConfig={setAiConfig} onClose={() => setDialogue(false)} onCreate={create} onManual={() => { setDialogue(false); setComposer(true); }}/>} {composer && <Composer onClose={() => setComposer(false)} onCreate={create} seed={selected}/>} {knowledgeStudio && <KnowledgeStudio entries={entries} onClose={() => setKnowledgeStudio(false)} onSave={addKnowledge}/>} {relationStudio && selected && <RelationStudio current={selected} entries={entries} onClose={() => setRelationStudio(false)} onSave={addRelation}/>} {transitionStudio && selected && <TransitionStudio current={selected} onClose={() => setTransitionStudio(false)} onSave={addTransition}/>}
  </main>;
}

function RangePicker({value,onChange}:{value:TimeRange;onChange:(value:TimeRange)=>void}) {
  const [open,setOpen]=useState(false);
  return <div className="range-picker"><button type="button" className="range-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(old=>!old)}><span>时间范围</span><strong>{rangeLabels[value]}</strong><i aria-hidden="true">⌄</i></button>{open&&<div className="range-menu" role="listbox" aria-label="选择时间范围">{(Object.keys(rangeLabels) as TimeRange[]).map(item=><button type="button" key={item} role="option" aria-selected={item===value} className={item===value?'active':''} onClick={()=>{onChange(item);setOpen(false);}}><span>{rangeLabels[item]}</span>{item===value&&<b>✓</b>}</button>)}</div>}</div>
}

function DialogueStudio({config,onConfig,onClose,onCreate,onManual}:{config:AiConfig;onConfig:(config:AiConfig)=>void;onClose:()=>void;onCreate:(d:Omit<Entry,'id'|'createdAt'>)=>void;onManual:()=>void}) {
  const [messages,setMessages]=useState<DialogueMessage[]>([{role:'assistant',content:'我在。先说说此刻发生了什么，或有什么让你停下来？'}]);
  const [text,setText]=useState(''); const [proposal,setProposal]=useState<DialogueProposal|null>(null); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [settings,setSettings]=useState(false);
  const send=async(e:FormEvent)=>{e.preventDefault();const content=text.trim();if(!content||busy)return;const next=[...messages,{role:'user' as const,content}];setMessages(next);setText('');setBusy(true);setError('');try{const result=config.mode==='managed'||(config.mode==='personal'&&config.apiKey.trim())?await askModel(config,next):localProposal(next);setProposal(result);setMessages(old=>[...old,{role:'assistant',content:result.reply}]);}catch(reason){setError(reason instanceof Error?reason.message:'暂时无法连接模型');setProposal(localProposal(next));setMessages(old=>[...old,{role:'assistant',content:'模型暂时没有回应，我先依据你的原话整理了一份本地草案。'}]);}finally{setBusy(false);}};
  const patchDraft=(part:Partial<DialogueProposal['draft']>)=>setProposal(old=>old?{...old,draft:{...old.draft,...part}}:old);
  return <Modal title="先说说发生了什么。" eyebrow="A CONVERSATION, NOT A FORM" onClose={onClose}>
    <div className="dialogue-intro"><span>对话陪伴者只帮你整理候选记录；写入宇宙前，始终由你决定。</span><button type="button" className="text-btn" onClick={()=>setSettings(value=>!value)}>模型设置</button></div>
    {settings&&<div className="model-settings"><p>本地引导不连接外部模型；托管 AI 使用网站的安全代理；个人 Key 不会保存进数据库或备份。</p><div className="ai-mode"><label><input type="radio" checked={config.mode==='local'} onChange={()=>onConfig({...config,mode:'local'})}/>本地引导</label><label><input type="radio" checked={config.mode==='managed'} onChange={()=>onConfig({...config,mode:'managed',endpoint:'/api'})}/>托管 AI</label><label><input type="radio" checked={config.mode==='personal'} onChange={()=>onConfig({...config,mode:'personal',endpoint:'https://api.deepseek.com'})}/>个人 Key</label></div>{config.mode==='personal'&&<><Field label="兼容 OpenAI 的接口地址"><input value={config.endpoint} onChange={e=>onConfig({...config,endpoint:e.target.value})}/></Field><div className="signal-grid"><Field label="模型名称"><input value={config.model} onChange={e=>onConfig({...config,model:e.target.value})}/></Field><Field label="API Key（本次会话）"><input type="password" autoComplete="off" value={config.apiKey} onChange={e=>onConfig({...config,apiKey:e.target.value})} placeholder="不会保存"/></Field></div></>}</div>}
    <div className="dialogue-log">{messages.map((message,index)=><div className={`bubble ${message.role}`} key={`${message.role}-${index}`}>{message.content}</div>)}{busy&&<div className="bubble assistant loading">正在安静地整理…</div>}</div>{error&&<p className="dialogue-error">{error}</p>}
    <form className="dialogue-input" onSubmit={send}><textarea autoFocus value={text} onChange={e=>setText(e.target.value)} placeholder="不用组织好语言，先从一句话开始。" rows={3}/><div><button type="button" className="text-btn" onClick={onManual}>改用表单记录</button><button className="capture-button" disabled={!text.trim()||busy}>继续说 ↗</button></div></form>
    {proposal&&<div className="proposal"><p className="overline">YOUR DRAFT · 等待你的确认</p><Field label="暂时的名字"><input value={proposal.draft.title} onChange={e=>patchDraft({title:e.target.value})}/></Field><Field label="保留的原话与整理"><textarea value={proposal.draft.body} onChange={e=>patchDraft({body:e.target.value})} rows={4}/></Field><div className="signal-grid"><Field label="此刻较接近的空域"><select value={proposal.draft.primaryVoid} onChange={e=>patchDraft({primaryVoid:e.target.value as VoidId})}>{VOIDS.map(v=><option key={v.id} value={v.id}>{v.symbol} {v.name}</option>)}</select></Field><Field label="感受（可留空）"><input value={proposal.draft.signal.emotion || ''} onChange={e=>patchDraft({signal:{...proposal.draft.signal,emotion:e.target.value}})} placeholder="如：松动、迷茫、平静"/></Field></div><button className="capture-button" type="button" disabled={!proposal.draft.title.trim()} onClick={()=>onCreate(proposal.draft)}>确认，让它进入宇宙 ↗</button></div>}
  </Modal>;
}

function Composer({onClose,onCreate,seed}:{onClose:()=>void;onCreate:(d:Omit<Entry,'id'|'createdAt'>)=>void;seed:Entry|null}) {
  const [title,setTitle] = useState(seed ? `回应：${seed.title}` : ''); const [body,setBody] = useState(''); const [kind,setKind]=useState<ExperienceKind>(seed?.kind||'daily'); const [voidId,setVoid] = useState<VoidId>(seed?.primaryVoid || 'void'); const [emotion,setEmotion] = useState(''); const [color,setColor] = useState(colors[0]); const [texture,setTexture] = useState(''); const [importance,setImportance] = useState(3); const [aiVisible,setAiVisible]=useState(true);
  const submit=(e:FormEvent)=>{e.preventDefault();if(!title.trim())return;onCreate({kind,title:title.trim(),body:body.trim(),primaryVoid:voidId,secondaryVoids:[],signal:{emotion,colorName:color[0],colorHex:color[1],texture},importance,privacy:{aiVisible,shareGrants:[]}});};
  return <Modal title="先把它写下来。" eyebrow="CAPTURE A TRACE" onClose={onClose}><form onSubmit={submit}><Field label="这是什么类型的记录？"><select value={kind} onChange={event=>setKind(event.target.value as ExperienceKind)}><option value="emotional">情感经历：感受、关系与心理事件</option><option value="knowledge">知识经历：阅读、概念与学习心得</option><option value="daily">日常经历：事件、观察与时间痕迹</option></select></Field><label className="title-input"><span>这一刻，想给它什么名字？</span><input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="不用完美，先给它一个临时名字"/></label><label><span>{kind==='knowledge'?'你学到了什么、它和什么相连？':'发生了什么，或你正在想什么？'}</span><textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="可以从一句话开始。这里没有正确的表达方式。" rows={6}/></label><div className="encoding"><div><span>它此刻最接近哪一种世界？</span><div className="void-choices">{VOIDS.map(v=><button type="button" className={voidId===v.id?'chosen':''} key={v.id} style={{'--void':v.color} as CSSProperties} onClick={()=>setVoid(v.id)}><i>{v.symbol}</i>{v.name}</button>)}</div></div><div className="signal-grid"><Field label="感受"><select value={emotion} onChange={e=>setEmotion(e.target.value)}><option value="">尚未命名</option>{emotions.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="色块"><select value={color[0]} onChange={e=>setColor(colors.find(x=>x[0]===e.target.value)??colors[0])}>{colors.map(c=><option key={c[0]}>{c[0]}</option>)}</select></Field><Field label="感官线索"><input value={texture} onChange={e=>setTexture(e.target.value)} placeholder="雾、水、尖角、回声…"/></Field><Field label="这段经历的重量"><input type="range" min="1" max="5" value={importance} onChange={e=>setImportance(Number(e.target.value))}/></Field></div></div><label className="privacy-choice"><input type="checkbox" checked={aiVisible} onChange={event=>setAiVisible(event.target.checked)}/>允许 AI 在我主动请求分析时读取这条记录；未经我单独授权，任何第三方均不可见。</label><ModalFoot text="保存后，它会成为一颗星尘。联系和洞见由你慢慢确认。" label="让它进入宇宙 ↗"/></form></Modal>;
}

function RelationStudio({current,entries,onClose,onSave}:{current:Entry;entries:Entry[];onClose:()=>void;onSave:(target:Entry,type:Relation['type'],reason:string)=>void}) { const [targetId,setTargetId]=useState(entries.find(e=>e.id!==current.id)?.id||''); const [type,setType]=useState<Relation['type']>('resonance');const [reason,setReason]=useState(''); const target=entries.find(e=>e.id===targetId); return <Modal title="让两颗星尘相互照亮。" eyebrow="CONFIRM A CONNECTION" onClose={onClose}><p className="modal-note">系统不会替你判定关系。选择真正相关的经历，并用自己的话说明为什么。</p><Field label="从「当前经历」连向"><select value={targetId} onChange={e=>setTargetId(e.target.value)}>{entries.filter(e=>e.id!==current.id).map(e=><option key={e.id} value={e.id}>{getVoid(e.primaryVoid).symbol} {e.title}</option>)}</select></Field><Field label="这是什么关系？"><select value={type} onChange={e=>setType(e.target.value as Relation['type'])}><option value="resonance">共鸣：它们彼此呼应</option><option value="tension">张力：它们彼此矛盾或拉扯</option><option value="thread">线索：它们构成一条值得追踪的线</option></select></Field><Field label="为什么要连接？"><textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="例如：它们都指向同一个还没解决的问题。" rows={4}/></Field><div className="modal-actions"><button className="capture-button" onClick={()=>target&&onSave(target,type,reason)} disabled={!target}>确认这条联系 ↗</button></div></Modal>; }

function TransitionStudio({current,onClose,onSave}:{current:Entry;onClose:()=>void;onSave:(to:VoidId,reason:string)=>void}) { const [to,setTo]=useState<VoidId>(current.primaryVoid); const [reason,setReason]=useState('');return <Modal title="这段经历正在改变吗？" eyebrow="MARK A COGNITIVE MOVEMENT" onClose={onClose}><p className="modal-note">迁移不是“升级”。它只是你对这段经历在此刻位置的重新理解。</p><div className="void-choices">{VOIDS.map(v=><button type="button" className={to===v.id?'chosen':''} key={v.id} style={{'--void':v.color} as CSSProperties} onClick={()=>setTo(v.id)}><i>{v.symbol}</i>{v.name}</button>)}</div><Field label="是什么让它从这里走向那里？"><textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="写下你的理解；未来也可以再次修订。" rows={4}/></Field><div className="modal-actions"><button className="capture-button" disabled={to===current.primaryVoid} onClick={()=>onSave(to,reason)}>确认这次变化 ↗</button></div></Modal>; }

function RecordInspector({entry, entries, relations, transitions, onClose, onWrite, onRelate, onMove, onSelect}:{entry:Entry;entries:Entry[];relations:Relation[];transitions:Transition[];onClose:()=>void;onWrite:()=>void;onRelate:()=>void;onMove:()=>void;onSelect:(entry:Entry)=>void}) {
  const currentVoid = getVoid(entry.primaryVoid);
  const linked = relations.filter(relation => relation.from === entry.id || relation.to === entry.id).map(relation => entries.find(item => item.id === (relation.from === entry.id ? relation.to : relation.from))).filter((item): item is Entry => Boolean(item));
  const movement = transitions.filter(transition => transition.entryId === entry.id);
  return <aside className="record-inspector" aria-label="记录详情">
    <header className="inspector-head"><div><p className="overline">SELECTED STAR</p><p className="inspector-void"><i style={{background:currentVoid.color}} />{currentVoid.symbol} {currentVoid.name}</p></div><button className="inspector-close" onClick={onClose} aria-label="关闭详情">×</button></header>
    <div className="inspector-body"><h2>{entry.title}</h2><p className="inspector-copy">{entry.body || '这是一条尚未写下内容的记录。你可以先补充一个片段，之后再决定它要去往哪里。'}</p>{(entry.signal.emotion || entry.signal.colorName || entry.signal.texture) && <div className="inspector-signals">{entry.signal.emotion && <span>{entry.signal.emotion}</span>}{entry.signal.colorName && <span><i style={{background:entry.signal.colorHex}} />{entry.signal.colorName}</span>}{entry.signal.texture && <span>{entry.signal.texture}</span>}</div>}</div>
    <nav className="inspector-actions" aria-label="记录操作"><button onClick={onWrite}>继续书写 <b>↗</b></button><button onClick={onRelate}>建立联系 <b>⌁</b></button><button onClick={onMove}>标记变化 <b>→</b></button></nav>
    {(linked.length > 0 || movement.length > 0) && <section className="inspector-evidence"><p className="overline">已有线索</p>{linked.length > 0 && <div><span>关联记录</span>{linked.slice(0,3).map(item => <button key={item.id} onClick={() => onSelect(item)}>{item.title}</button>)}</div>}{movement.length > 0 && <div><span>已确认变化</span><strong>{movement.length} 条</strong></div>}</section>}
  </aside>
}

function PathSection({entry,transitions,threads,entries,onSelect}:{entry:Entry;transitions:Transition[];threads:QuestionThread[];entries:Entry[];onSelect:(entry:Entry)=>void}) {
  const path = pathFor(entry.id, entry, transitions);
  const stops = [path.origin, ...path.moves.map(m => m.to)];
  const inThread = threads.filter(thread => thread.entryIds.includes(entry.id));
  return <section className="paths"><div className="section-head"><div><p className="overline">A PATH, NOT A LABEL</p><h2>「{entry.title}」的认知路径</h2><p>路径只记录你亲自确认过的变化；没有迁移也完全没关系。</p></div></div><div className="paths-grid"><article className="journey"><p className="overline">JOURNEY THROUGH THE EMPTIES</p><div className="journey-rail">{stops.map((id,index)=>{const v=getVoid(id);const move=path.moves[index-1];return <><div className="journey-stop" key={`${id}-${index}`}><i style={{'--stop':v.color} as CSSProperties}>{v.symbol}</i><b>{v.name}</b><small>{index===0?'最初记录':index===stops.length-1?'此刻所在':'一次回望'}</small></div>{index<stops.length-1&&<span className="journey-line" key={`line-${index}`}/>} {move && index>0 && null}</>;})}</div>{path.moves.length ? <div className="journey-reason">最近一次重新理解：{path.moves[path.moves.length-1].reason || '你确认它抵达了新的空域。'}</div> : <p className="empty">现在它停在「{getVoid(entry.primaryVoid).name}」。等你准备好时，再决定它是否发生了变化。</p>}</article><article className="threads"><p className="overline">LIVING QUESTION THREADS</p><h2>它参与的问题线</h2>{inThread.length ? <div className="threads-list">{inThread.map(thread=><ThreadCard key={thread.id} thread={thread} entries={entries} onSelect={onSelect}/>)}</div> : <p className="empty">这颗星尘暂未进入一条已确认的问题线。可以从“看见联系”开始。</p>}</article></div></section>;
}
function ThreadCard({thread,entries,onSelect}:{thread:QuestionThread;entries:Entry[];onSelect:(entry:Entry)=>void}) { const others=thread.entryIds.map(id=>entries.find(e=>e.id===id)).filter((e):e is Entry=>!!e);return <button className="thread" onClick={()=>others[0]&&onSelect(others[0])}><strong>围绕「{thread.title}」</strong><span>{thread.relationCount} 条联系</span><small>{others.map(e=>e.title).join(' · ')}</small></button>; }

function Library({knowledge,entries,focus,onSelect,onCreate,onSeedDefaults}:{knowledge:KnowledgeEntry[];entries:Entry[];focus:KnowledgeEntry|null;onSelect:(item:KnowledgeEntry)=>void;onCreate:()=>void;onSeedDefaults:()=>void}) {
  const [showDefaults,setShowDefaults]=useState(false); const personal=knowledge.filter(item=>!item.isDefault); const defaults=knowledge.filter(item=>item.isDefault);
  const renderItem=(item:KnowledgeEntry)=>{const v=getVoid(item.voidType);return <button className={focus?.id===item.id?'knowledge-card active':'knowledge-card'} key={item.id} onClick={()=>onSelect(item)}><i className="library-dot" style={{background:v.color}}/><small>{v.symbol} {v.name} · {item.source || '个人资料'}</small><h3>{item.title}</h3><p>{item.summary}</p><div>{item.linkedEntryIds.map(id=>entries.find(e=>e.id===id)).filter((e):e is Entry=>!!e).map(e=><span key={e.id}>↗ {e.title}</span>)}</div></button>};
  return <section className="library"><div className="section-head"><div><p className="overline">PERSONAL SOURCE LIBRARY</p><h2>让资料成为可被理解的星图素材</h2><p>资料不是堆在外面的链接。给它一个空域，并让它与真实经历发生联系。</p></div><div className="learning-actions">{defaults.length>0?<button className="text-btn" onClick={()=>setShowDefaults(value=>!value)}>{showDefaults?'收起基础包':'浏览基础包'} →</button>:<button className="text-btn" onClick={onSeedDefaults}>启用默认知识包</button>}<button className="text-btn" onClick={onCreate}>沉淀一条资料 →</button></div></div>{knowledge.length ? <>{personal.length>0&&<div className="library-grid">{personal.slice(0,6).map(renderItem)}</div>}{defaults.length>0&&!showDefaults&&<div className="default-library-teaser"><div><p className="overline">OFFLINE FOUNDATION</p><b>{defaults.length} 条离线基础知识已在星图中</b><span>它们不会默认占据主页；需要时再展开、编辑或关联到你的经历。</span></div><button className="hero-secondary" onClick={()=>setShowDefaults(true)}>查看基础包 <span>↗</span></button></div>}{showDefaults&&<div className="library-grid default-knowledge-grid">{defaults.map(renderItem)}</div>}{focus&&<div className="knowledge-focus"><p className="overline">KNOWLEDGE CRYSTAL IN FOCUS</p><h3>{focus.title}</h3><p>{focus.summary || '这枚知识晶体还在等待你的解释。'}</p><small>{getVoid(focus.voidType).symbol} {getVoid(focus.voidType).name} · {focus.tags.join(' · ') || '未设置标签'}</small></div>}</> : <div className="library-empty"><b>资料库还没有条目。</b><p>先启用离线默认知识包，或从一本书、一个概念、一段课程开始。它们都是可编辑、可导出的个人知识库起点。</p><button className="capture-button" onClick={onSeedDefaults}>启用默认知识包 ↗</button></div>}</section>
}

function KnowledgeStudio({entries,onClose,onSave}:{entries:Entry[];onClose:()=>void;onSave:(item:Omit<KnowledgeEntry,'id'|'createdAt'>)=>void}) { const [title,setTitle]=useState('');const [summary,setSummary]=useState('');const [source,setSource]=useState('');const [voidType,setVoid]=useState<VoidId>('silence');const [linked,setLinked]=useState<string[]>([]);const [tags,setTags]=useState('');return <Modal title="把一份资料沉淀进你的宇宙。" eyebrow="ADD A KNOWLEDGE STAR" onClose={onClose}><p className="modal-note">它不需要是完整笔记。先留下“它为什么对我重要”，再慢慢补足来源和关联。</p><Field label="资料或概念的名字"><input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="如：认知负荷理论 / 一本书 / 一段课程"/></Field><Field label="你自己的理解"><textarea value={summary} onChange={e=>setSummary(e.target.value)} placeholder="它说了什么？它为什么与你有关？" rows={4}/></Field><div className="signal-grid"><Field label="来源（可选）"><input value={source} onChange={e=>setSource(e.target.value)} placeholder="书名、作者、链接或课程"/></Field><Field label="它此刻属于哪一空？"><select value={voidType} onChange={e=>setVoid(e.target.value as VoidId)}>{VOIDS.map(v=><option key={v.id} value={v.id}>{v.symbol} {v.name}</option>)}</select></Field></div><Field label="它与哪些经历相连？"><div className="link-picker">{entries.map(e=><label key={e.id}><input type="checkbox" checked={linked.includes(e.id)} onChange={()=>setLinked(old=>old.includes(e.id)?old.filter(id=>id!==e.id):[...old,e.id])}/>{getVoid(e.primaryVoid).symbol} {e.title}</label>)}</div></Field><Field label="标签（用逗号分隔）"><input value={tags} onChange={e=>setTags(e.target.value)} placeholder="学习、心理学、问题线…"/></Field><div className="modal-actions"><button className="capture-button" disabled={!title.trim()} onClick={()=>onSave({title:title.trim(),summary:summary.trim(),source:source.trim()||undefined,voidType,tags:tags.split(',').map(x=>x.trim()).filter(Boolean),linkedEntryIds:linked})}>让它成为知识星尘 ↗</button></div></Modal>; }

type BackupFile = { version: 2; exportedAt: string; atlas: Atlas; hiddenReflections?: string[] };
function DataCare({atlas,hiddenReflections,onRestore}:{atlas:Atlas;hiddenReflections:string[];onRestore:(atlas:Atlas,hidden:string[])=>void}) {
  const input = useRef<HTMLInputElement>(null);
  const download = () => { const payload: BackupFile = { version: 2, exportedAt: new Date().toISOString(), atlas, hiddenReflections }; const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'})); const link = document.createElement('a'); link.href=url; link.download=`心智宇宙备份-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url); };
  const upload = async (file?: File) => { if (!file) return; try { const parsed = JSON.parse(await file.text()) as Partial<BackupFile>; const next = parsed.atlas; if (parsed.version !== 2 || !next || !Array.isArray(next.entries) || !Array.isArray(next.knowledge) || !Array.isArray(next.relations) || !Array.isArray(next.transitions)) throw new Error('格式不匹配'); if (window.confirm('恢复会替换这台设备当前保存的心智宇宙内容。确认继续吗？')) onRestore(next, Array.isArray(parsed.hiddenReflections) ? parsed.hiddenReflections : []); } catch { window.alert('无法读取这份备份。请选择由心智宇宙 V2 导出的 JSON 文件。'); } finally { if (input.current) input.current.value=''; } };
  return <span className="data-care"><button className="text-btn" type="button" onClick={download}>备份</button><button className="text-btn" type="button" onClick={()=>input.current?.click()}>恢复</button><input ref={input} type="file" accept="application/json,.json" onChange={e=>void upload(e.target.files?.[0])}/></span>;
}

function AiMirror({config,entries,relations,transitions,onSelect}:{config:AiConfig;entries:Entry[];relations:Relation[];transitions:Transition[];onSelect:(entry:Entry)=>void}) {
  const [result,setResult]=useState<MirrorResponse|null>(null); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const reflect=async()=>{if(config.mode==='local'){setError('请先在“记录此刻 → 模型设置”选择托管 AI 或个人 Key。');return;}setBusy(true);setError('');try{setResult(await askMirror(config,entries,relations,transitions));}catch(reason){setError(reason instanceof Error?reason.message:'这次回望暂时无法完成');}finally{setBusy(false);}};
  if (entries.length < 2) return null;
  return <section className="ai-mirror"><div className="section-head"><div><p className="overline">ASK FOR A GENTLE MIRROR</p><h2>只回望已经发生的事</h2><p>它只会参考最近 {Math.min(entries.length,24)} 条经历、已确认的联系和迁移；不保存这次对话，不替你下结论。</p></div><button className="text-btn" onClick={()=>void reflect()} disabled={busy}>{busy?'正在回望…':'请求一次回望 →'}</button></div>{error&&<p className="mirror-error">{error}</p>}{result&&<div className="mirror-result"><p className="mirror-opening">{result.opening}</p><div className="review-grid">{result.cards.map((card,index)=><article key={`${card.title}-${index}`}><p className="overline">AI MIRROR · 可忽略</p><h3>{card.title}</h3><p>{card.body}</p><div className="evidence">{card.evidenceIds.map(id=>{const entry=entries.find(item=>item.id===id);return entry?<button key={id} onClick={()=>onSelect(entry)}>↗ {entry.title}</button>:null;})}</div><button className="dismiss" onClick={()=>setResult(old=>old?{...old,cards:old.cards.filter((_,cardIndex)=>cardIndex!==index)}:old)}>暂不看这条观察</button></article>)}</div></div>}</section>;
}

function PrivacySheet({onClose,entries,audit,atlas,hiddenReflections,onRestoreBackup,onCreateGrant,onRevokeGrant}:{onClose:()=>void;entries:Entry[];audit:AuthorizationAuditEvent[];atlas:Atlas;hiddenReflections:string[];onRestoreBackup:(atlas:Atlas,hidden:string[])=>void;onCreateGrant:(entryId:string,grant:ShareGrant)=>void;onRevokeGrant:(entryId:string,grantId:string)=>void}) {
  return <Modal title="你的宇宙，先属于你。" eyebrow="PRIVACY, MADE VISIBLE" onClose={onClose}><div className="privacy-sheet"><article><b>默认只在这台设备</b><p>经历、关系、资料与偏好保存在浏览器本地数据库。备份与恢复也都收在这个窗口中。</p></article><article><b>AI 只在你主动请求时参与</b><p>对话记录和 AI 回望只有在你点击发送或请求时才会传给已选择的模型服务；AI 的候选内容不会自动写入宇宙。</p></article><article><b>个人 Key 不会保存</b><p>个人 API Key 只存在当前页面会话，不会进入备份、本地数据库或项目代码。</p></article><article><b>云同步是可选的</b><p>云同步必须由你主动发起；下载云端快照会明确提醒覆盖本机数据。</p></article></div><DataCare atlas={atlas} hiddenReflections={hiddenReflections} onRestore={onRestoreBackup}/><AuthorizationCenter entries={entries} audit={audit} onCreate={onCreateGrant} onRevoke={onRevokeGrant}/><AccountCenter atlas={atlas} onRestore={next=>onRestoreBackup(next,hiddenReflections)}/><div className="modal-actions"><button className="capture-button" onClick={onClose}>我明白了</button></div></Modal>;
}

function Field({label,children}:{label:string;children:ReactNode}) { return <label><span>{label}</span>{children}</label>; }
function Modal({title,eyebrow,onClose,children}:{title:string;eyebrow:string;onClose:()=>void;children:ReactNode}) { useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[onClose]);return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><section className="composer" onMouseDown={event=>event.stopPropagation()}><div className="composer-head"><div><p className="overline">{eyebrow}</p><h2>{title}</h2></div><button type="button" className="close" aria-label="关闭窗口" onClick={onClose}>×</button></div><div className="modal-scroll">{children}</div></section></div>; }
function ModalFoot({text,label}:{text:string;label:string}) { return <div className="composer-foot"><p>{text}</p><button className="capture-button">{label}</button></div>; }
export default App;
