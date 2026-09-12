import EntryCard from '../components/EntryCard';
import type { Entry } from '../types';

/**
 * AI 学习页（过渡版）。
 * 第 7 轮将实现：学习目标、多模态资料卡片（图片/音频/网址）、
 * 模块化学习计划、进度追踪与认知负荷提示。
 */
export default function LearnPage({ entries }: { entries: Entry[] }) {
  const knowledge = entries.filter(e => e.kind === 'knowledge');
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">可控的学习辅助</p>
          <h1>AI 学习</h1>
          <p>把目标拆小、关联已有知识，并由你决定路径。</p>
        </div>
      </header>
      <section className="learn">
        <h2>本周学习路径</h2>
        <ol>
          <li>从知识库选择一个已理解或正在形成的概念。</li>
          <li>记录一个自己的解释，并补充前置知识。</li>
          <li>在映空反思：我卡在哪里？下一步是什么？</li>
        </ol>
        <h2>你已有的学习材料</h2>
        <div className="cards">
          {knowledge.slice(0, 5).map(e => <EntryCard key={e.id} entry={e} />)}
        </div>
        <p className="notice">第一版的 AI 功能只给出可确认建议。外部账号关联、批量多模态分析将在明确授权与平台合规后再启用。</p>
      </section>
    </>
  );
}
