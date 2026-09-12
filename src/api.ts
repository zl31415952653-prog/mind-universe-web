import type { Entry, EntryDraft, Link, LinkInput, Suggestion, User } from './types';

const key = 'infinity-token';
export const getToken = () => localStorage.getItem(key);
export const setToken = (t: string | null) => (t ? localStorage.setItem(key, t) : localStorage.removeItem(key));

interface AuthResponse {
  user: User;
  token: string;
}

async function call<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const res = await fetch('/api' + path, { ...options, headers });
  if (res.status === 204) return null as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || '请求失败');
  return body as T;
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
  create: (e: EntryDraft) => call<Entry>('/entries', { method: 'POST', body: JSON.stringify(e) }),
  update: (id: string, e: EntryDraft) => call<Entry>('/entries/' + id, { method: 'PUT', body: JSON.stringify(e) }),
  remove: (id: string) => call<null>('/entries/' + id, { method: 'DELETE' }),
  links: () => call<Link[]>('/links'),
  createLink: (l: LinkInput) => call<Link>('/links', { method: 'POST', body: JSON.stringify(l) }),
  removeLink: (id: string) => call<null>('/links/' + id, { method: 'DELETE' }),
  suggest: (id: string) => call<Suggestion>('/ai/suggest/' + id, { method: 'POST', body: '{}' }),
  export: () => call<ExportData>('/export'),
};
