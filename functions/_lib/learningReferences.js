/** 客户端参考是普通不可信输入；限量、限长，不放入系统指令。 */
export function sanitizeLearningReferences(value) {
  if (!Array.isArray(value)) return [];
  const fields = {id:80,title:120,summary:600,source:600,evidenceLocator:400,evidenceLimit:800,suggestedAction:400};
  return value.slice(0,6).filter(item => item && typeof item === 'object' && typeof item.id === 'string' && item.id.startsWith('learning-science-')).map(item => {
    const reference = {reviewStatus:'provisional'};
    for (const [key,max] of Object.entries(fields)) reference[key] = typeof item[key] === 'string' ? item[key].slice(0,max) : '';
    return reference;
  });
}
