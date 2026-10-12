import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { LearningMaterial, LearningProject, LearningSuggestion } from './domain';
import { analyseLearningWithModel, type AiConfig } from './ai';
import { analyseMaterial, countMaterialUnits, MAX_LOCAL_UNITS } from './learning';
import { openPdfTextSource, type PdfTextSource } from './pdfText';
import { attachLearningReferences } from './learningReferences';

export default function LearningMaterialForm({ project, onAdd }: {
  project: LearningProject;
  onAdd: (material: LearningMaterial, suggestions: LearningSuggestion[]) => void;
}) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<LearningMaterial['kind']>('text');
  const [source, setSource] = useState('');
  const [referencePack, setReferencePack] = useState<LearningMaterial['referencePack']>();
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [pdf, setPdf] = useState<{ name: string; totalPages: number } | null>(null);
  const [fromPage, setFromPage] = useState('1');
  const [toPage, setToPage] = useState('1');
  const [extractedRange, setExtractedRange] = useState<{ from: number; to: number } | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'loading' | 'extracting' | 'analysing' | null>(null);
  const [config, setConfig] = useState<AiConfig>({ mode: 'local', endpoint: 'https://api.deepseek.com', model: 'deepseek-flash', apiKey: '' });
  const fileInput = useRef<HTMLInputElement>(null);
  const pdfSource = useRef<PdfTextSource | null>(null);
  const requestId = useRef(0);
  const unitCount = useMemo(() => countMaterialUnits(content), [content]);
  const rangeReady = !pdf || !!extractedRange && extractedRange.from === Number(fromPage) && extractedRange.to === Number(toPage);
  const overLimit = config.mode === 'local' ? unitCount > MAX_LOCAL_UNITS : content.trim().length > 12000;

  useEffect(() => () => {
    requestId.current++;
    void pdfSource.current?.destroy();
    pdfSource.current = null;
  }, []);

  const readFile = async (file?: File) => {
    if (!file || busy) return;
    const request = ++requestId.current;
    setBusy('loading');
    setError('');
    setNotice('');
    const oldSource = pdfSource.current;
    pdfSource.current = null;
    setPdf(null);
    setExtractedRange(null);
    setContent('');
    setFileName('');
    try {
      await oldSource?.destroy();
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (isPdf) {
        const opened = await openPdfTextSource(file);
        if (request !== requestId.current) { await opened.destroy(); return; }
        pdfSource.current = opened;
        setPdf({ name: file.name, totalPages: opened.totalPages });
        setFromPage('1');
        setToPage('1');
      } else {
        const text = await file.text();
        if (request !== requestId.current) return;
        setContent(text);
      }
      setFileName(file.name);
      setTitle(file.name.replace(/\.(pdf|md|markdown|txt)$/i, ''));
      setKind(isPdf ? 'pdf' : 'text');
    } catch (reason) {
      if (request === requestId.current) setError(reason instanceof Error ? reason.message : '无法读取这份文件。');
    } finally {
      if (request === requestId.current) setBusy(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const extractSelection = async () => {
    if (!pdfSource.current || busy) return;
    setBusy('extracting');
    setError('');
    setNotice('');
    try {
      const from = Number(fromPage);
      const to = Number(toPage);
      const result = await pdfSource.current.extract(from, to);
      setContent(result.text);
      setExtractedRange({ from, to });
      setNotice(result.emptyPages.length ? `第 ${result.emptyPages.join('、')} 个 PDF 页未提取到文字；其余所选页已载入。` : `已载入 PDF 第 ${from}–${to} 页，正文可继续删选或改写。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '所选页段暂时无法读取。');
    } finally {
      setBusy(null);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim() || busy || !rangeReady || overLimit || !unitCount) return;
    const fileDescription = fileName ? `本地文件：${fileName}${extractedRange ? ` · PDF 第 ${extractedRange.from}–${extractedRange.to} 页` : ''}` : '';
    const material: LearningMaterial = {
      id: crypto.randomUUID(), projectId: project.id, title: title.trim() || '未命名材料', kind,
      source: [source.trim(), fileDescription].filter(Boolean).join(' · ') || undefined,
      content: content.trim(), createdAt: Date.now(), referencePack
    };
    setBusy('analysing');
    setError('');
    try {
      const suggestions = config.mode === 'local' ? analyseMaterial(material) : await analyseLearningWithModel(config, material);
      onAdd(material, attachLearningReferences(material, suggestions));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '资料暂时无法分析。');
    } finally {
      setBusy(null);
    }
  };

  return <>
    <p className="overline">MATERIAL INTAKE</p>
    <h2>导入一份你正在学的材料</h2>
    <p className="learning-note">先选择要学的页段，再核对正文。本地模式按句段和中英文词面线索生成候选，分类与理解仍需你检查。</p>
    <form className="learning-form" onSubmit={event => void submit(event)}>
      <div className="two-col">
        <label>材料名称<input value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label>材料形式<select value={kind} onChange={event => setKind(event.target.value as LearningMaterial['kind'])} disabled={!!pdf}>
          <option value="text">文本 / 笔记</option><option value="web">网页内容</option><option value="pdf">PDF</option>
        </select></label>
      </div>
      <div className="learning-actions">
        <input ref={fileInput} hidden disabled={!!busy} type="file" accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown" onChange={event => void readFile(event.target.files?.[0])} />
        <button type="button" className="text-btn" disabled={!!busy} onClick={() => fileInput.current?.click()}>选择本地 PDF / .txt / .md</button>
        <small>PDF 页码按文件页序计数；扫描页暂不支持文字识别。</small>
      </div>
      {pdf && <section className="pdf-selection" aria-label="选择 PDF 页段">
        <strong>{pdf.name}</strong><p>共 {pdf.totalPages} 个 PDF 页。可直接选择任意位置的页段，建议先从 1 页开始。</p>
        <div className="pdf-range-controls">
          <label>起始 PDF 页<input type="number" min="1" max={pdf.totalPages} step="1" value={fromPage} disabled={!!busy} onChange={event => setFromPage(event.target.value)} /></label>
          <label>结束 PDF 页<input type="number" min="1" max={pdf.totalPages} step="1" value={toPage} disabled={!!busy} onChange={event => setToPage(event.target.value)} /></label>
          <button type="button" className="text-btn" disabled={!!busy} onClick={() => void extractSelection()}>{busy === 'extracting' ? '正在提取…' : extractedRange ? '重新提取所选页' : '提取所选页'}</button>
        </div>
        {!rangeReady && <small>{extractedRange ? '页段已改变；重新提取后才能生成候选。重新提取会替换下方正文。' : '选择页段并提取后，正文会显示在下方。'}</small>}
      </section>}
      {notice && <p className="import-notice" role="status">{notice}</p>}
      <label>领域参考包（可选）<select value={referencePack ?? ''} disabled={!!busy} onChange={event => setReferencePack(event.target.value === 'learning-science-v1' ? 'learning-science-v1' : undefined)}>
        <option value="">不使用领域包</option><option value="learning-science-v1">学习科学 · 21 条暂行素材</option>
      </select></label>
      {referencePack && <p className="learning-note">按中英文词面匹配提供参考，不证明分类正确或你已掌握。不会将领域包自动导入个人知识库；AI 模式会一并发送最多 6 条公开参考摘要及来源、限制，不发送论文全文。</p>}
      <label>分析方式<select value={config.mode} disabled={!!busy} onChange={event => setConfig(old => ({ ...old, mode: event.target.value as AiConfig['mode'], endpoint: event.target.value === 'managed' ? '/api' : event.target.value === 'personal' && old.endpoint === '/api' ? 'https://api.deepseek.com' : old.endpoint }))}>
        <option value="local">本地规则（不联网）</option><option value="managed">托管 AI（需部署并登录）</option><option value="personal">个人 Key（仅本次页面会话）</option>
      </select></label>
      {config.mode !== 'local' && <small>点击生成后，材料标题、出处和所选正文会发送至所选服务，不包含其他笔记。每次最多 12000 字符，AI 提取最多 12 个知识单元，逐项检查七空；结果仍需核对，不保证覆盖整份材料。</small>}
      {config.mode === 'personal' && <div className="two-col">
        <label>接口地址<input value={config.endpoint} onChange={event => setConfig(old => ({ ...old, endpoint: event.target.value }))} /></label>
        <label>模型名称<input value={config.model} onChange={event => setConfig(old => ({ ...old, model: event.target.value }))} /></label>
        <label style={{ gridColumn: '1 / -1' }}>个人 API Key<input type="password" autoComplete="off" value={config.apiKey} onChange={event => setConfig(old => ({ ...old, apiKey: event.target.value }))} placeholder="只在当前页面会话中使用" /></label>
      </div>}
      <label>来源链接或出处（可选）<input value={source} onChange={event => setSource(event.target.value)} placeholder="链接、DOI、书名或课程名" /></label>
      <label>正文预览 / 粘贴正文<textarea value={content} disabled={!!busy} onChange={event => setContent(event.target.value)} placeholder="提取后核对正文，也可以直接粘贴一段学习材料…" /></label>
      {content.trim() && <div className="import-preview-status" role="status">
        <span>{content.length.toLocaleString()} 字符 · 本地可拆为 {unitCount} 个句段</span>
        {overLimit && <p>{config.mode === 'local' ? `当前超过 ${MAX_LOCAL_UNITS} 个句段。` : '当前超过 AI 的 12000 字符限制。'}请缩小 PDF 页段，或在正文中保留本次要学的部分。</p>}
        {!unitCount && <p>正文还没有足够的可分析内容，请补充一段完整表述。</p>}
      </div>}
      {error && <p className="dialogue-error" role="alert">{error}</p>}
      <button className="capture-button" disabled={!!busy || !content.trim() || !rangeReady || overLimit || !unitCount}>{busy === 'analysing' ? '正在生成候选…' : busy === 'loading' ? '正在读取文件…' : busy === 'extracting' ? '正在提取所选页…' : '生成候选学习地图 ↗'}</button>
    </form>
  </>;
}
