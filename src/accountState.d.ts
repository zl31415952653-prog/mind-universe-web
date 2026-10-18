type Check<T> = { status: 'ready' | 'anonymous' | 'error'; value: T | null };
export function accountActionError(error: unknown): string;
export function readAccountResponse(response: Response): Promise<Record<string, unknown>>;
export function checkAccount(fetcher?: typeof fetch, signal?: AbortSignal): Promise<{
  config: Check<{ provider: string; ready: boolean }>;
  session: Check<{ id: string; username?: string; email?: string }>;
}>;
export function callbackMessage(params: URLSearchParams): string;
