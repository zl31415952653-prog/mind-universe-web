type TextItem = { str: string; transform?: number[] };

/** 仅恢复 PDF 文本层中明显的段落间隔；不推断标题、阅读顺序或正式页码引用。 */
export function pdfItemsToText(items: TextItem[]): string {
  let text = '';
  let previousY: number | null = null;
  for (const item of items) {
    const fragment = item.str.trim();
    if (!fragment) continue;
    const y = item.transform?.[5];
    const paragraphBreak = previousY !== null && Number.isFinite(y) && Math.abs((y as number) - previousY) >= 28;
    text += `${text ? paragraphBreak ? '\n\n' : ' ' : ''}${fragment}`;
    if (Number.isFinite(y)) previousY = y as number;
  }
  return text.trim();
}
