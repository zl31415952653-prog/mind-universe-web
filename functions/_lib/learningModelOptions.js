/** DeepSeek 默认开启推理；结构化资料整理明确关闭，避免推理占满输出预算。其他兼容服务不加专有字段。 */
export function learningModelOptions(endpoint) {
  try {
    if (new URL(endpoint).hostname === 'api.deepseek.com') return { thinking: { type: 'disabled' } };
  } catch { /* 同站托管路径由服务端处理 */ }
  return {};
}
