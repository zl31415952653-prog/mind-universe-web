import type { DiscoverySuggestion, Entry } from './domain';
import { discoverWithModel, type AiConfig } from './ai';
import { useState } from 'react';
import './discovery.css';

export default function DiscoveryPanel({entries,suggestions,onRun,onAdd,onAccept,onDismiss,onOpen}:{entries:Entry[];suggestions:DiscoverySuggestion[];onRun:()=>void;onAdd:(items:DiscoverySuggestion[])=>void;onAccept:(item:DiscoverySuggestion)=>void;onDismiss:(id:string)=>void;onOpen:(entry:Entry)=>void}) {
  const pending=suggestions.filter(item=>item.status==='pending');
  const [config,setConfig]=useState<AiConfig>({mode:'local',endpoint:'https://api.deepseek.com',model:'deepseek-flash',apiKey:''});
  const [settings,setSettings]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const runAi=async()=>{
    if(config.mode==='local'){setSettings(true);setError('先选择托管 AI 或填写本次会话使用的个人 Key。');return;}
    setBusy(true);setError('');try{onAdd(await discoverWithModel(config,entries));}catch(reason){setError(reason instanceof Error?reason.message:'AI 发现暂时不可用。');}finally{setBusy(false);}
  };
  return <section className={`discovery-panel ${pending.length?'has-results':'is-idle'}`}>
    <div className="section-head"><div><p className="overline">DISCOVERY · YOUR CONFIRMATION</p><h2>{pending.length?'等待你确认的联系':'发现可能相连的地方'}</h2><p>{pending.length?'每一条只是候选；只有你确认后，它才会成为宇宙中的联系。':'从你已经写下的内容中找可检查的线索，不会自动建立关系。'}</p></div><div className="discovery-tools"><button className="text-btn" disabled={entries.length<2} onClick={onRun}>本地扫描 →</button><button className="text-btn" disabled={busy||entries.length<2} onClick={()=>void runAi()}>{busy?'正在提出候选…':'AI 发现 →'}</button></div></div>
    {settings&&<div className="discovery-config"><label>AI 发现方式<select value={config.mode} onChange={event=>setConfig(old=>({...old,mode:event.target.value as AiConfig['mode'],endpoint:event.target.value==='managed'?'/api':old.endpoint}))}><option value="local">请选择</option><option value="managed">托管 AI（部署后可用）</option><option value="personal">个人 Key（本次会话）</option></select></label>{config.mode==='personal'&&<><input value={config.endpoint} onChange={event=>setConfig(old=>({...old,endpoint:event.target.value}))} placeholder="兼容 OpenAI 的接口地址"/><input value={config.model} onChange={event=>setConfig(old=>({...old,model:event.target.value}))} placeholder="模型名称"/><input type="password" autoComplete="off" value={config.apiKey} onChange={event=>setConfig(old=>({...old,apiKey:event.target.value}))} placeholder="个人 API Key（不会保存）"/></>}</div>}
    {error&&<p className="dialogue-error">{error}</p>}
    {pending.length>0&&<div className="discovery-grid">{pending.map(item=>{const left=entries.find(entry=>entry.id===item.from);const right=entries.find(entry=>entry.id===item.to);if(!left||!right)return null;return <article key={item.id}><p className="overline">CANDIDATE · 可忽略</p><h3><button onClick={()=>onOpen(left)}>{left.title}</button><span>⌁</span><button onClick={()=>onOpen(right)}>{right.title}</button></h3><p>{item.reason}</p><div className="learning-meta">{item.sharedTerms.map(term=><span key={term}>{term}</span>)}</div><div className="discovery-actions"><button className="capture-button" onClick={()=>onAccept(item)}>确认这条联系</button><button className="text-btn" onClick={()=>onDismiss(item.id)}>暂不采用</button></div></article>})}</div>}
  </section>;
}
