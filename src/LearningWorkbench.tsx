import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { getVoid, VOIDS, knowledgeColor, type KnowledgeEntry, type KnowledgeRelation, type LearningMaterial, type LearningProject, type LearningSuggestion, type LearningTask, type VoidId } from './domain';
import LearningMaterialForm from './LearningMaterialForm';
import type { ConfirmationTaskPlan } from './learning';
import './learning.css';
import './graph.css';

type Props = {
  projects: LearningProject[];
  materials: LearningMaterial[];
  suggestions: LearningSuggestion[];
  tasks: LearningTask[];
  knowledge: KnowledgeEntry[];
  knowledgeRelations: KnowledgeRelation[];
  onClose: () => void;
  onCreateProject: (value: Omit<LearningProject, 'id' | 'createdAt'>) => string;
  onIngestMaterial: (material: LearningMaterial, suggestions: LearningSuggestion[]) => void;
  onUpdateSuggestion: (id: string, patch: Pick<LearningSuggestion, 'title' | 'summary'> | Pick<LearningSuggestion, 'reviewState'>) => void;
  onConfirm: (id: string, primary: VoidId, secondary: VoidId[], plan: ConfirmationTaskPlan) => void;
  onToggleTask: (id: string) => void;
  onAddKnowledgeRelation: (value: Omit<KnowledgeRelation, 'id' | 'createdAt'>) => void;
};

export default function LearningWorkbench(props: Props) {
  const [tab, setTab] = useState<'map' | 'import' | 'tasks' | 'links'>('map');
  const [projectId, setProjectId] = useState(props.projects[0]?.id ?? '');
  const [newProject, setNewProject] = useState(false);
  const project = props.projects.find(item => item.id === projectId) ?? null;
  const projectMaterials = props.materials.filter(item => item.projectId === projectId);
  const projectSuggestions = props.suggestions.filter(item => projectMaterials.some(material => material.id === item.materialId));
  const projectTasks = props.tasks.filter(item => item.projectId === projectId);
  const projectKnowledge = props.knowledge.filter(item => projectSuggestions.some(suggestion => suggestion.confirmedAt && suggestion.knowledgeEntryId === item.id));
  const confirmedCount = projectSuggestions.filter(item => item.confirmedAt).length;
  const switchProject = (id: string) => { setProjectId(id); setNewProject(false); setTab('map'); };
  useEffect(() => { if (!projectId && props.projects[0]) setProjectId(props.projects[0].id); }, [projectId, props.projects]);

  return <main className="app-shell"><header className="topbar"><button className="wordmark" onClick={props.onClose}><i>∞</i><span>心智宇宙</span><small>返回宇宙</small></button><div className="top-actions"><span className="local-dot">离线学习工作台</span><button className="text-btn" onClick={props.onClose}>回到宇宙</button></div></header>
    <div className="learning-workbench">
      <section className="learning-hero"><div><p className="overline">LEARNING, MADE LEGIBLE</p><h1>把陌生资料，变成<br/><em>能走下去的路径。</em></h1><p>先看清未知、冲突、过程与连接；系统只给候选结构，分类、理解与下一步始终由你确认。</p></div><div className="learning-actions"><button className="text-btn" onClick={()=>{setNewProject(true);setTab('map');}}>＋ 新建学习项目</button>{project&&<button className="capture-button" onClick={()=>setTab('import')}>导入一份材料 ↗</button>}</div></section>
      <section className="learning-layout"><aside className="learning-sidebar"><p className="overline">LEARNING PROJECTS</p>{props.projects.map(item=><button key={item.id} className={item.id===projectId?'active':''} onClick={()=>switchProject(item.id)}><strong>{item.title}</strong><small>{item.goal || '尚未写下学习目标'}</small></button>)}{!props.projects.length&&<p className="empty-learning">先创建一个真实要学习的主题，资料和任务才会有归处。</p>}</aside>
        <section className="learning-panel">{newProject ? <ProjectForm onCancel={()=>setNewProject(false)} onSubmit={value=>{switchProject(props.onCreateProject(value));}}/> : !project ? <div className="empty-learning"><h2>从一个真实主题开始</h2><p>例如：理解认知负荷理论、学习 React、读懂一门课程。首版先帮你跑通一次完整学习闭环。</p><button className="capture-button" onClick={()=>setNewProject(true)}>创建学习项目 ↗</button></div> : <>
          <nav className="learning-actions"><button className={tab==='map'?'capture-button':'text-btn'} onClick={()=>setTab('map')}>学习地图</button><button className={tab==='import'?'capture-button':'text-btn'} onClick={()=>setTab('import')}>资料导入</button><button className={tab==='tasks'?'capture-button':'text-btn'} onClick={()=>setTab('tasks')}>下一步</button><button className={tab==='links'?'capture-button':'text-btn'} onClick={()=>setTab('links')}>知识连接</button></nav>
          {tab==='map' && <LearningMap project={project} suggestions={projectSuggestions} materials={projectMaterials} confirmedCount={confirmedCount} onConfirm={props.onConfirm} onUpdate={props.onUpdateSuggestion}/>}
          {tab==='import' && <LearningMaterialForm project={project} onAdd={(material,suggestions)=>{props.onIngestMaterial(material,suggestions);setTab('map');}}/>}
          {tab==='tasks' && <TaskList tasks={projectTasks} suggestions={projectSuggestions} onToggle={props.onToggleTask}/>} 
          {tab==='links' && <KnowledgeConnections knowledge={projectKnowledge} relations={props.knowledgeRelations.filter(relation=>projectKnowledge.some(item=>item.id===relation.from)&&projectKnowledge.some(item=>item.id===relation.to))} onAdd={props.onAddKnowledgeRelation}/>} 
        </>}</section>
      </section>
    </div>
  </main>;
}

function ProjectForm({onCancel,onSubmit}:{onCancel:()=>void;onSubmit:(value:Omit<LearningProject,'id'|'createdAt'>)=>void}) { const [title,setTitle]=useState('');const [goal,setGoal]=useState('');const [currentLevel,setLevel]=useState<LearningProject['currentLevel']>('new');const submit=(event:FormEvent)=>{event.preventDefault();if(title.trim())onSubmit({title:title.trim(),goal:goal.trim(),currentLevel});};return <><p className="overline">NEW LEARNING PROJECT</p><h2>你想真正理解什么？</h2><p>一个项目对应一个明确的学习目标。不要从“所有知识”开始。</p><form className="learning-form" onSubmit={submit}><label>主题<input autoFocus value={title} onChange={event=>setTitle(event.target.value)} placeholder="如：认知负荷理论"/></label><label>完成后希望能做到什么？<textarea value={goal} onChange={event=>setGoal(event.target.value)} placeholder="如：能用自己的话解释核心概念，并把它用于课程设计。"/></label><label>当前基础<select value={currentLevel} onChange={event=>setLevel(event.target.value as LearningProject['currentLevel'])}><option value="new">完全陌生</option><option value="building">正在建立基础</option><option value="familiar">已有一些基础</option></select></label><div className="learning-actions"><button type="button" className="text-btn" onClick={onCancel}>取消</button><button className="capture-button">创建学习项目 ↗</button></div></form></>; }

function LearningMap({project,suggestions,materials,confirmedCount,onConfirm,onUpdate}:{project:LearningProject;suggestions:LearningSuggestion[];materials:LearningMaterial[];confirmedCount:number;onConfirm:Props['onConfirm'];onUpdate:Props['onUpdateSuggestion']}) {
  const [editing,setEditing]=useState<Record<string,{primary:VoidId|null;secondary:VoidId[]}>>({});
  const stats=useMemo(()=>({materials:materials.length,pending:suggestions.filter(item=>!item.confirmedAt && (!item.reviewState || item.reviewState==='pending')).length,deferred:suggestions.filter(item=>item.reviewState==='deferred').length,confirmed:confirmedCount}),[materials.length,suggestions,confirmedCount]);
  const unitLabels={concept:'概念',claim:'主张',method:'方法',example:'例子',evidence:'证据',limit:'限制',question:'问题'};
  return <>
    <p className="overline">COGNITIVE MAP · {project.currentLevel==='new'?'从未知开始':project.currentLevel==='building'?'正在建立':'已有基础'}</p>
    <h2>{project.title}</h2><p>{project.goal || '给这个项目补充一个学习目标，会更容易判断每一步是否有效。'}</p>
    <div className="learning-meta"><span>{stats.materials} 份材料</span><span>{stats.pending} 个待核对片段</span>{stats.deferred>0&&<span>{stats.deferred} 个暂缓</span>}<span>{stats.confirmed} 个已确认知识条目</span></div>
    {!suggestions.length?<div className="empty-learning"><p>还没有分析材料。导入一段资料后，本地模式会按句段给出可逐条核对的候选；它不能代替你理解原文。</p></div>:
      <div className="suggestion-list">{suggestions.map(item=>{
        const current=editing[item.id]??{primary:item.primaryVoid,secondary:item.secondaryVoids};
        const v=current.primary?getVoid(current.primary):null;
        const material=materials.find(source=>source.id===item.materialId);
        return <article className="suggestion-card" key={item.id}>
          <p className="overline">{item.confirmedAt?'CONFIRMED KNOWLEDGE':item.reviewState==='deferred'?'CANDIDATE · 已暂缓':item.reviewState==='ignored'?'CANDIDATE · 已忽略':'CANDIDATE · 等待你的确认'}</p>
          <CandidateEditor key={item.id} item={item} onUpdate={onUpdate} onConfirm={(primary,secondary,plan)=>onConfirm(item.id,primary,secondary,plan)} primary={current.primary} secondary={current.secondary}/>
          {item.evidence&&<div className="unit-evidence"><small>原文片段 · {item.evidence.page?`PDF 第 ${item.evidence.page} 页 · `:''}提取文字第 {item.evidence.start+1} 字起 · {item.unitType?`${unitLabels[item.unitType]}候选`:'类型未判定'}</small><p>{item.evidence.excerpt}</p></div>}
          {material&&<p className="candidate-source">资料来源：{material.source||material.title}</p>}
          <div className="learning-meta">{item.keywords.map(word=><span key={word}>{word}</span>)}</div>
          <p className="rationale">为什么这样建议：{item.rationale}</p>
          {item.analysisMode==='ai'&&<p className="candidate-source">AI 知识单元候选 · 原文定位已核对，摘要与分类仍需你审阅</p>}
          {item.nextAction&&<p><strong>建议下一步（未自动创建任务）：</strong>{item.nextAction}</p>}
          {item.references&&item.references.length>0&&<details className="learning-references"><summary>领域包参考 · {item.references.length} 条暂行素材（非材料原文证据）</summary>
            <p>以下仅按词面匹配，未自动建立知识关系。来源与定位为素材包登记信息，本次没有重新核查论文全文。</p>
            {item.references.map(reference=><section key={reference.id}>
              <strong>{reference.title}</strong><small>暂行 / 待复核 · 匹配词：{reference.matchedTerms.join('、')}</small>
              <p>{reference.summary}</p><p>可选动作：{reference.suggestedAction}</p>
              <p>来源：{reference.source}</p><p>登记定位：{reference.evidenceLocator}</p><p>适用限制：{reference.evidenceLimit}</p>
            </section>)}
          </details>}
          {item.voidAssessments&&<div className="void-assessments" aria-label="七空逐项判断">{item.voidAssessments.map(assessment=><span key={assessment.voidType} className={assessment.status==='candidate'?'has-cue':''} title={assessment.cue||'该片段未发现明确字面线索'}>{getVoid(assessment.voidType).symbol} {getVoid(assessment.voidType).name} · {assessment.status==='candidate'?'有线索':assessment.status==='needs-input'?'需补充':'依据不足'}{assessment.cue?`（${assessment.cue}）`:''}</span>)}</div>}
          <div className="suggestion-controls"><label>主空（可暂不分类）<select disabled={!!item.confirmedAt || item.reviewState==='deferred' || item.reviewState==='ignored'} value={current.primary??''} onChange={event=>setEditing(old=>({...old,[item.id]:{primary:event.target.value?event.target.value as VoidId:null,secondary:current.secondary.filter(id=>id!==event.target.value)}}))}><option value="">暂不分类</option>{VOIDS.map(voidItem=><option key={voidItem.id} value={voidItem.id}>{voidItem.symbol} {voidItem.name}</option>)}</select></label><SecondaryVoidPicker primary={current.primary} selected={current.secondary} disabled={!!item.confirmedAt || item.reviewState==='deferred' || item.reviewState==='ignored'} onChange={secondary=>setEditing(old=>({...old,[item.id]:{...current,secondary}}))}/></div>
          <p><strong>前置检查：</strong>{item.prerequisites.length?item.prerequisites.join('；'):'材料中没有明确的前置知识线索，可由你补充。'}</p>
          <span style={{display:'block',marginTop:10,color:v?.soft??'#aab8d7'}}>{v?`当前主空：${v.symbol} ${v.name}`:'尚未选择主空；这段内容仍留作候选。'}</span>
        </article>;
      })}</div>}
  </>;
}

function CandidateEditor({item,onUpdate,onConfirm,primary,secondary}:{item:LearningSuggestion;onUpdate:Props['onUpdateSuggestion'];onConfirm:(primary:VoidId,secondary:VoidId[],plan:ConfirmationTaskPlan)=>void;primary:VoidId|null;secondary:VoidId[]}) {
  const [title,setTitle]=useState(item.title);
  const [summary,setSummary]=useState(item.summary);
  const [taskMode,setTaskMode]=useState<ConfirmationTaskPlan['mode']>('none');
  const [action,setAction]=useState(item.nextAction ?? '');
  const dirty=title.trim()!==item.title || summary.trim()!==item.summary;
  if(item.confirmedAt) return <><h3>{item.title}</h3><p>{item.summary}</p><small>已进入知识库；这里不再修改已确认条目。</small></>;
  const active=!item.reviewState || item.reviewState==='pending';
  return <div className="candidate-editor">
    <label>候选标题<input value={title} onChange={event=>setTitle(event.target.value)} disabled={!active}/></label>
    <label>我的理解 / 改写<textarea value={summary} onChange={event=>setSummary(event.target.value)} disabled={!active}/></label>
    <div className="learning-actions">
      {active&&<><button type="button" className="text-btn" disabled={!dirty || !title.trim() || !summary.trim()} onClick={()=>onUpdate(item.id,{title:title.trim(),summary:summary.trim()})}>保存改写</button><button type="button" className="text-btn" disabled={dirty} onClick={()=>onUpdate(item.id,{reviewState:'deferred'})}>暂缓判断</button><button type="button" className="text-btn" disabled={dirty} onClick={()=>onUpdate(item.id,{reviewState:'ignored'})}>忽略候选</button></>}
      {!active&&<button type="button" className="text-btn" onClick={()=>onUpdate(item.id,{reviewState:'pending'})}>重新纳入核对</button>}
    </div>
    {dirty&&<small>改写尚未保存；保存后才能暂缓、忽略或确认。</small>}
    {active&&<fieldset><legend>确认后要添加任务吗？（可选）</legend>
      <label><input type="radio" name={`task-${item.id}`} checked={taskMode==='none'} onChange={()=>setTaskMode('none')}/>只确认知识，不添加任务</label>
      <label><input type="radio" name={`task-${item.id}`} checked={taskMode==='starter'} onChange={()=>setTaskMode('starter')}/>添加基础练习：辨认未知、主动回忆、回顾</label>
      <label><input type="radio" name={`task-${item.id}`} checked={taskMode==='action'} onChange={()=>setTaskMode('action')}/>自己编辑下一步，添加一项任务</label>
      {taskMode==='action'&&<label>下一步任务<textarea maxLength={500} value={action} onChange={event=>setAction(event.target.value)} placeholder="写下可执行的一步，例如：不看资料，用自己的话解释这个概念。"/><small>建议只是起点，请核对并改写；确认入库时才创建任务。</small></label>}
    </fieldset>}
    {active&&<button type="button" className="capture-button" disabled={!primary || dirty || !title.trim() || !summary.trim() || (taskMode==='action'&&!action.trim())} onClick={()=>{if(primary)onConfirm(primary,secondary,{mode:taskMode,action})}}>确认这段内容，进入知识库 ↗</button>}
    {!active&&<small>{item.reviewState==='ignored'?'这条候选不会入库或生成任务，仍可恢复。':'这条候选稍后再看，不会入库或生成任务。'}</small>}
  </div>;
}

function SecondaryVoidPicker({primary,selected,disabled,onChange}:{primary:VoidId|null;selected:VoidId[];disabled:boolean;onChange:(next:VoidId[])=>void}) {
  const choices = VOIDS.filter(item => item.id !== primary);
  const toggle = (id:VoidId) => onChange(selected.includes(id) ? selected.filter(item => item !== id) : [...selected,id].slice(0,2));
  return <div className="secondary-void-picker">
    <span>次要关联（可选，最多 2 个）</span>
    <div className="secondary-void-options" role="group" aria-label="次要关联空域">
      {choices.map(item => <button type="button" key={item.id} aria-pressed={selected.includes(item.id)}
        disabled={disabled || !primary || (selected.length >= 2 && !selected.includes(item.id))}
        onClick={() => toggle(item.id)} style={{'--void':item.color} as CSSProperties}>
        {item.symbol} {item.name}
      </button>)}
    </div>
    <small>已选 {selected.length}/2；再次点击可移除。</small>
  </div>;
}

function TaskList({tasks,suggestions,onToggle}:{tasks:LearningTask[];suggestions:LearningSuggestion[];onToggle:(id:string)=>void}) { const labels={preview:'先看清',recall:'主动回忆',practice:'应用练习',review:'间隔回顾'};const unfinished=tasks.filter(task=>!task.doneAt);const unconfirmed=suggestions.filter(item=>!item.confirmedAt && (!item.reviewState || item.reviewState==='pending'));const fractures=suggestions.filter(item=>item.confirmedAt && item.primaryVoid==='fracture');const unknowns=suggestions.filter(item=>item.confirmedAt && item.primaryVoid==='void');const guidance=unconfirmed.length?`先核对 ${unconfirmed.length} 个候选片段；未经你确认，它们不会成为学习路径的一部分。`:unknowns.length?`优先补齐 ${unknowns.length} 个“未知”条目的定义或前置知识。`:fractures.length?`当前有 ${fractures.length} 个冲突/易混淆条目，下一步适合做对比和辨析。`:unfinished.length?`今天只完成一项：${unfinished[0].title}`:'这一轮任务已完成。可以用自己的话回忆一次，再导入下一份相关资料。';return <><p className="overline">NEXT ACTIONS</p><h2>不要只收藏，完成一个下一步。</h2><p>这些任务从你确认的知识条目生成。勾选只表示你完成了这一步；它不代表已经学会，系统也不会检查答案。</p><div className="learning-note"><strong>此刻建议：</strong>{guidance}</div>{!tasks.length?<div className="empty-learning">还没有任务。核对候选知识时，可选择基础练习，或编辑下一步并添加一项任务；只确认知识不会自动生成任务。</div>:<div className="task-list">{tasks.slice().sort((a,b)=>Number(!!a.doneAt)-Number(!!b.doneAt)).map(task=><label className={`task-card ${task.doneAt?'done':''}`} key={task.id}><input type="checkbox" checked={!!task.doneAt} onChange={()=>onToggle(task.id)}/><span><small>{labels[task.kind]}</small><strong>{task.title}</strong><p>{task.note}</p><small className="task-action-status">{task.doneAt?'已标记完成 · 仍可继续练习':'完成这一步后再勾选'}</small></span></label>)}</div>}</>; }

function KnowledgeConnections({knowledge,relations,onAdd}:{knowledge:KnowledgeEntry[];relations:KnowledgeRelation[];onAdd:Props['onAddKnowledgeRelation']}) { const [from,setFrom]=useState(knowledge[0]?.id??'');const [to,setTo]=useState(knowledge[1]?.id??'');const [type,setType]=useState<KnowledgeRelation['type']>('prerequisite');const [reason,setReason]=useState('');const [focused,setFocused]=useState<string|null>(null);const labels={prerequisite:'前置',contains:'包含',contrast:'对比',conflict:'冲突',analogy:'类比',application:'应用'};if(knowledge.length<2)return <div className="empty-learning"><h2>连接需要至少两条已确认知识</h2><p>先在“学习地图”确认两个候选条目。之后你可以说明它们为什么相关，而不是让系统暗中替你建立关系。</p></div>;return <><p className="overline">CONFIRMED KNOWLEDGE LINKS</p><h2>让关系有理由，而不只是连线。</h2><p>这是知识图谱的第一层：每条边由你确认，并保留它为什么成立。AI 未来也只能提出同样等待确认的候选边。</p><KnowledgeGraph knowledge={knowledge} relations={relations} focused={focused} onFocus={setFocused}/><form className="learning-form" onSubmit={event=>{event.preventDefault();onAdd({from,to,type,reason:reason.trim()});setReason('');}}><div className="two-col"><label>从<select value={from} onChange={event=>setFrom(event.target.value)}>{knowledge.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>连接到<select value={to} onChange={event=>setTo(event.target.value)}>{knowledge.map(item=>item.id!==from&&<option key={item.id} value={item.id}>{item.title}</option>)}</select></label></div><div className="two-col"><label>关系类型<select value={type} onChange={event=>setType(event.target.value as KnowledgeRelation['type'])}>{Object.entries(labels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>为什么相连？<input value={reason} onChange={event=>setReason(event.target.value)} placeholder="如：理解 A 是学习 B 的前提"/></label></div><button className="capture-button" disabled={!from||!to||from===to}>确认这条知识连接 ↗</button></form><div className="suggestion-list">{relations.map(relation=>{const left=knowledge.find(item=>item.id===relation.from);const right=knowledge.find(item=>item.id===relation.to);return <article className="suggestion-card" key={relation.id}><p className="overline">USER-CONFIRMED · {labels[relation.type]}</p><h3>{left?.title} <span aria-hidden="true">→</span> {right?.title}</h3><p>{relation.reason||'用户确认的知识关系。'}</p></article>})}</div></>; }

function KnowledgeGraph({knowledge,relations,focused,onFocus}:{knowledge:KnowledgeEntry[];relations:KnowledgeRelation[];focused:string|null;onFocus:(id:string|null)=>void}) { const points=useMemo(()=>knowledge.map((item,index)=>{const angle=(Math.PI*2*index)/knowledge.length-Math.PI/2;return {id:item.id,x:50+36*Math.cos(angle),y:50+36*Math.sin(angle),item};}),[knowledge]);const getPoint=(id:string)=>points.find(point=>point.id===id);const related=new Set(focused?relations.filter(item=>item.from===focused||item.to===focused).flatMap(item=>[item.from,item.to]):[]);return <section className="knowledge-graph"><div><p className="overline">YOUR CONFIRMED MAP</p><small>{relations.length?`已确认 ${relations.length} 条关系；点击节点聚焦。`:'还没有关系线。先确认一条你能说明理由的连接。'}</small><button className="text-btn" onClick={()=>onFocus(null)}>显示全部</button></div><svg viewBox="0 0 100 100" role="img" aria-label="已确认知识关系图">{relations.map(relation=>{const a=getPoint(relation.from),b=getPoint(relation.to);if(!a||!b)return null;const dimmed=!!focused&&!related.has(relation.from)&&!related.has(relation.to);return <line key={relation.id} className={dimmed?'dim':''} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>})}{points.map(point=>{const dimmed=!!focused&&point.id!==focused&&!related.has(point.id);return <g key={point.id} className={dimmed?'dim':''} onClick={()=>onFocus(point.id===focused?null:point.id)}><circle cx={point.x} cy={point.y} r={point.id===focused?6:4.2} fill={knowledgeColor(point.item)}/><text x={point.x} y={point.y+.9}>{point.item.title.slice(0,6)}</text></g>})}</svg></section>; }
