type Check<T> = { status: 'ready' | 'anonymous' | 'error'; value: T | null };
export function checkAccount(fetcher?: typeof fetch, signal?: AbortSignal): Promise<{
  config: Check<{ provider: string; ready: boolean }>;
  session: Check<{ id: string; email: string }>;
}>;
export function callbackMessage(params: URLSearchParams): string;
