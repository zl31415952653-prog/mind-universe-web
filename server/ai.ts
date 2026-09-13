/**
 * AI 模型适配器（OpenAI 兼容端点，方案书 3.3）：
 * 密钥只存在于服务器环境变量（AI_BASE_URL / AI_API_KEY / AI_MODEL），
 * 浏览器绝不直连模型供应商。未配置时返回 null → 调用方走本地启发式降级。
 */

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function getAiConfig(): AiConfig | null {
  const baseUrl = (process.env.AI_BASE_URL || '').trim();
  const apiKey = (process.env.AI_API_KEY || '').trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey, model: (process.env.AI_MODEL || '').trim() || 'default' };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 请求模型返回 JSON（要求模型只输出 JSON，宽松解析代码块包裹）。
 * 超时 30 秒；失败抛错，由调用方决定是否降级启发式。
 */
export async function chatJson(config: AiConfig, messages: ChatMessage[], temperature = 0.4): Promise<unknown> {
  const base = config.baseUrl.replace(/\/+$/, '');
  const url = base.includes('/chat/completions') ? base : base + '/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model: config.model, messages, temperature }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`AI 服务返回 ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? '';
  return parseLooseJson(text);
}

/** 宽松 JSON 解析：去掉 ```json 代码块包裹，截取首个 { 到最后一个 } */
function parseLooseJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AI 输出不是 JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}
