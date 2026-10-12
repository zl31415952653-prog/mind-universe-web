export const MAX_PDF_SELECTION_PAGES = 40;

export function validatePdfSelection(total: number, from: number, to: number): void {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > total) {
    throw new Error(`请输入有效页段：起始页至少为 1，结束页不小于起始页，且不超过 ${total}。`);
  }
  if (to - from + 1 > MAX_PDF_SELECTION_PAGES) {
    throw new Error(`一次最多提取 ${MAX_PDF_SELECTION_PAGES} 页，请缩小页段。`);
  }
}
