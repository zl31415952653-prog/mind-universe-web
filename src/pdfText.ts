import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import { pdfItemsToText } from './pdfLayout';
import { validatePdfSelection } from './pdfSelection';

GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfTextSource {
  totalPages: number;
  extract: (from: number, to: number) => Promise<{ text: string; emptyPages: number[] }>;
  destroy: () => Promise<void>;
}

/** 仅在浏览器端读取 PDF 文本；扫描件没有文本层时会明确提示，而不伪造解析结果。 */
export async function openPdfTextSource(file: File): Promise<PdfTextSource> {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const document = await task.promise;
    return {
      totalPages: document.numPages,
      destroy: () => task.destroy(),
      extract: async (from, to) => {
        validatePdfSelection(document.numPages, from, to);
        const chunks: string[] = [];
        const emptyPages: number[] = [];
        for (let pageNumber = from; pageNumber <= to; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          const pageText = pdfItemsToText(content.items.filter((item): item is typeof item & { str: string } => 'str' in item));
          if (pageText) chunks.push(`【第 ${pageNumber} 页】\n${pageText}`);
          else emptyPages.push(pageNumber);
          page.cleanup();
        }
        const text = chunks.join('\n\n');
        if (!text) throw new Error('所选页段没有可提取的文字，可能是扫描页。请换一个页段，或粘贴可复制的正文。');
        return { text, emptyPages };
      }
    };
  } catch (reason) {
    await task.destroy();
    throw reason;
  }
}
