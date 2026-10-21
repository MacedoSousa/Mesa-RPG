/**
 * Cliente HTTP do Mesa RPG.
 * O access token fica só em memória; o refresh token vive num cookie HttpOnly (o JS nunca o vê).
 */

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  role: 'MASTER' | 'PLAYER';
}

type Listener = (token: string | null, user: PublicUser | null) => void;

let accessToken: string | null = null;
let currentUser: PublicUser | null = null;
let refreshing: Promise<boolean> | null = null;
const listeners = new Set<Listener>();

export function onSession(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setSession(token: string | null, user: PublicUser | null) {
  accessToken = token;
  currentUser = user;
  for (const l of listeners) l(token, user);
}

export function getAccessToken() {
  return accessToken;
}

async function rawFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(`/api${path}`, { ...init, headers, credentials: 'include' });
}

/** Troca o cookie de refresh por um novo access token (uma tentativa por vez). */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        setSession(null, null);
        return false;
      }
      const body = await res.json();
      setSession(body.accessToken, body.user);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const req: RequestInit = { ...rest, body: json !== undefined ? JSON.stringify(json) : rest.body };
  let res = await rawFetch(path, req);
  if (res.status === 401 && accessToken && !path.startsWith('/auth/')) {
    if (await refreshSession()) res = await rawFetch(path, req);
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Erro ${res.status}`, body.details);
  return body as T;
}

export const Auth = {
  async login(login: string, password: string) {
    const r = await api<{ user: PublicUser; accessToken: string }>('/auth/login', { method: 'POST', json: { login, password } });
    setSession(r.accessToken, r.user);
    return r.user;
  },
  async register(data: { username: string; email: string; password: string; displayName?: string; masterCode?: string }) {
    const r = await api<{ user: PublicUser; accessToken: string }>('/auth/register', { method: 'POST', json: data });
    setSession(r.accessToken, r.user);
    return r.user;
  },
  async logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setSession(null, null);
  },
  async deleteAccount() {
    await api('/auth/me', { method: 'DELETE' });
    setSession(null, null);
  },
  user: () => currentUser,
};

/** Mensagem amigável a partir de um erro da API (inclui detalhes de validação). */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const d = err.details as { errors?: string[]; violations?: { reason: string }[] } | { field: string; message: string }[] | undefined;
    if (Array.isArray(d)) return `${err.message}: ${d.map((x) => x.message).join('; ')}`;
    const parts = [...(d?.errors ?? []), ...(d?.violations?.map((v) => v.reason) ?? [])];
    return parts.length ? `${err.message}: ${parts.join('; ')}` : err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
