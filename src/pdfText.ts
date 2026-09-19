import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PAGES = 40;

/** 仅在浏览器端读取 PDF 文本；扫描件没有文本层时会明确提示，而不伪造解析结果。 */
export async function extractPdfText(file: File): Promise<{ text: string; pages: number; truncated: boolean }> {
  const document = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = Math.min(document.numPages, MAX_PAGES);
  const chunks: string[] = [];
  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => 'str' in item ? item.str : '').join(' ').replace(/\s+/g, ' ').trim();
    if (pageText) chunks.push(`【第 ${pageNumber} 页】\n${pageText}`);
  }
  const text = chunks.join('\n\n');
  if (!text) throw new Error('这份 PDF 没有可提取的文字，可能是扫描件或受保护文件。首版暂不做 OCR，请改用可复制文字的 PDF 或粘贴正文。');
  return { text, pages, truncated: document.numPages > MAX_PAGES };
}
