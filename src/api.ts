import type { Entry, EntryDraft, Link, LinkInput, Suggestion, User } from './types';

const key = 'infinity-token';
export const getToken = () => localStorage.getItem(key);
export const setToken = (t: string | null) => (t ? localStorage.setItem(key, t) : localStorage.removeItem(key));

interface AuthResponse {
  user: User;
  token: string;
}

/** 带状态码的 API 错误；同步引擎靠它区分"网络问题"与"服务端拒绝" */
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function call<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000); // 8 秒超时，避免离线时无限等待
  try {
    const res = await fetch('/api' + path, { ...options, headers, signal: ctrl.signal });
    if (res.status === 204) return null as T;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, (body as { error?: string }).error || '请求失败', body);
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface ExportData {
  exportedAt: number;
  entries: Entry[];
  links: Link[];
}

export const api = {
  login: (email: string, password: string) =>
    call<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, displayName: string) =>
    call<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, displayName }) }),
  me: () => call<User>('/me'),
  entries: (params: Record<string, string> = {}) =>
    call<Entry[]>('/entries?' + new URLSearchParams(params)),
  entry: (id: string) => call<Entry>('/entries/' + id),
  /** 创建；id 可选（离线创建时由客户端生成，服务端幂等接受） */
  create: (e: EntryDraft & { id?: string }) =>
    call<Entry>('/entries', { method: 'POST', body: JSON.stringify(e) }),
  /** 更新；version 为本地基准版本，服务端版本不符时返回 409 冲突 */
  update: (id: string, e: EntryDraft, version?: number) =>
    call<Entry>('/entries/' + id, { method: 'PUT', body: JSON.stringify({ ...e, version }) }),
  remove: (id: string) => call<null>('/entries/' + id, { method: 'DELETE' }),
  links: () => call<Link[]>('/links'),
  createLink: (l: LinkInput) => call<Link>('/links', { method: 'POST', body: JSON.stringify(l) }),
  removeLink: (id: string) => call<null>('/links/' + id, { method: 'DELETE' }),
  suggest: (id: string) => call<Suggestion>('/ai/suggest/' + id, { method: 'POST', body: '{}' }),
  export: () => call<ExportData>('/export'),
};
