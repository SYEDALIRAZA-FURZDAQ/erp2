// Access token lives in memory only (never localStorage). The refresh token is an httpOnly cookie.
let accessToken: string | null = null;
let onAuthLost: (() => void) | null = null;

export const setAccessToken = (t: string | null) => (accessToken = t);
export const setOnAuthLost = (fn: () => void) => (onAuthLost = fn);

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, string[]>) {
    super(message);
  }
}

async function raw(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(`/api/v1${path}`, { ...init, headers, credentials: 'same-origin' });
}

let refreshing: Promise<boolean> | null = null;
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then(async (r) => {
      if (!r.ok) return false;
      const s = await r.json();
      setAccessToken(s.accessToken);
      sessionListener?.(s);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

let sessionListener: ((s: unknown) => void) | null = null;
export const onSessionRefreshed = (fn: (s: unknown) => void) => (sessionListener = fn);

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await raw(path, init);
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshSession()) res = await raw(path, init);
    else {
      onAuthLost?.();
    }
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error;
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? `Request failed (${res.status})`, e?.details);
  }
  return body as T;
}

export const post = <T,>(path: string, data?: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) });
export const put = <T,>(path: string, data?: unknown) => api<T>(path, { method: 'PUT', body: JSON.stringify(data ?? {}) });
export const patch = <T,>(path: string, data?: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) });
export const del = <T,>(path: string, data?: unknown) =>
  api<T>(path, { method: 'DELETE', body: data !== undefined ? JSON.stringify(data) : undefined });

export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const first = e.details ? Object.values(e.details).flat()[0] : null;
    return first ? `${e.message}: ${first}` : e.message;
  }
  return 'Something went wrong';
}
