export const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
).replace(/\/$/, '');

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function url(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function setAuthTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearAuthTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function hasStoredSession(): boolean {
  return Boolean(localStorage.getItem(REFRESH_TOKEN_KEY));
}

function notifySessionExpired(): void {
  clearAuthTokens();
  window.dispatchEvent(new Event('auth:logout'));
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refresh) return null;

  refreshPromise = (async () => {
    try {
      const response = await fetch(url('/auth/token/refresh/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });

      if (!response.ok) return null;

      const data = (await response.json()) as {
        access?: string;
        refresh?: string;
      };

      if (!data.access) return null;

      localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
      if (data.refresh) {
        localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
      }

      return data.access;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

type ApiFetchOptions = {
  auth?: boolean;
  retryOnUnauthorized?: boolean;
};

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  options: ApiFetchOptions = {}
): Promise<Response> {
  const auth = options.auth ?? true;
  const retryOnUnauthorized = options.retryOnUnauthorized ?? true;
  const headers = new Headers(init.headers);

  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (auth) {
    const access = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (access) headers.set('Authorization', `Bearer ${access}`);
  }

  let response = await fetch(url(path), { ...init, headers });

  if (auth && response.status === 401 && retryOnUnauthorized) {
    const newAccess = await refreshAccessToken();

    if (newAccess) {
      headers.set('Authorization', `Bearer ${newAccess}`);
      response = await fetch(url(path), { ...init, headers });
    } else {
      notifySessionExpired();
    }
  }

  return response;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as Record<string, unknown>;
    const value = data.detail ?? data.error ?? data.mensagem ?? data.non_field_errors;
    if (Array.isArray(value)) return String(value[0] ?? `Erro HTTP ${response.status}`);
    if (typeof value === 'string') return value;

    for (const fieldValue of Object.values(data)) {
      if (Array.isArray(fieldValue) && fieldValue.length > 0) return String(fieldValue[0]);
      if (typeof fieldValue === 'string') return fieldValue;
    }

    return JSON.stringify(data);
  } catch {
    const text = await response.text().catch(() => '');
    return text || `Erro HTTP ${response.status}`;
  }
}

export async function apiJson<T>(
  path: string,
  init: RequestInit = {},
  options: ApiFetchOptions = {}
): Promise<T> {
  const response = await apiFetch(path, init, options);
  if (!response.ok) {
    throw new ApiError(await errorMessage(response), response.status);
  }
  return response.json() as Promise<T>;
}

export async function apiVoid(
  path: string,
  init: RequestInit = {},
  options: ApiFetchOptions = {}
): Promise<void> {
  const response = await apiFetch(path, init, options);
  if (!response.ok) {
    throw new ApiError(await errorMessage(response), response.status);
  }
}

export async function logout(): Promise<void> {
  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);

  try {
    await apiVoid('/auth/logout/', {
      method: 'POST',
      body: JSON.stringify({ refresh }),
    });
  } finally {
    notifySessionExpired();
  }
}
