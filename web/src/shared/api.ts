import { config } from './config';
import type { ApiEnvelope, ApiErrorPayload, AuthPayload } from './types';

type RequestOptions = RequestInit & {
  auth?: boolean;
  skipRefresh?: boolean;
  raw?: boolean;
};

type AuthRuntime = {
  getAccessToken: () => string | null;
  getUserId: () => string | null;
  refresh: () => Promise<AuthPayload | null>;
  clear: () => void;
};

let _accessToken: string | null = null;
let _userId: string | null = null;

let authRuntime: AuthRuntime = {
  getAccessToken: () => _accessToken,
  getUserId: () => _userId,
  refresh: async () => null,
  clear: () => undefined,
};

let refreshPromise: Promise<AuthPayload | null> | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function setUserId(id: string | null) {
  _userId = id;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  action?: string;
  payload?: unknown;

  constructor(status: number, payload: ApiErrorPayload | string) {
    const message = typeof payload === 'string' ? payload : payload.message ?? 'Request failed';
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (typeof payload !== 'string') {
      this.code = payload.code;
      this.action = payload.action;
      this.payload = payload.details;
    }
  }
}

export function configureAuthRuntime(runtime: AuthRuntime) {
  authRuntime = runtime;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await request(path, options);

  if (response.status === 401 && !options.skipRefresh) {
    const refreshed = await refreshOnce();
    if (refreshed?.accessToken) {
      return apiRequest<T>(path, { ...options, skipRefresh: true });
    }
    authRuntime.clear();
  }

  if (response.status === 403) {
    try {
      const payload = await response.clone().json();
      if (payload?.code === 'ERR_USER_BANNED') {
        if (payload.reason) sessionStorage.setItem('ban:reason', payload.reason);
        if (payload.until) sessionStorage.setItem('ban:until', payload.until);
        authRuntime.clear();
        window.location.href = '/banned';
        throw new ApiError(403, 'User is banned');
      }
      if (payload?.action === 'complete_profile') {
        window.location.href = '/complete-profile';
      }
    } catch (e) {
      if (e instanceof ApiError) throw e;
    }
  }

  return readResponse<T>(response, options.raw);
}

async function request(path: string, options: RequestOptions) {
  const headers = new Headers(options.headers);
  const isFormData = options.body instanceof FormData;

  if (!isFormData && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.auth !== false) {
    const token = _accessToken || authRuntime.getAccessToken();
    const userId = _userId || authRuntime.getUserId();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (userId) headers.set('x-user-id', userId);
  }

  return fetch(`${config.apiBaseUrl}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
}

async function readResponse<T>(response: Response, raw = false): Promise<T> {
  if (raw) return response as T;

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as ApiEnvelope<T> | T) : null;

  if (!response.ok) {
    throw new ApiError(response.status, (payload as ApiEnvelope<T>) ?? response.statusText);
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }

  return payload as T;
}

async function refreshOnce(): Promise<AuthPayload | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = authRuntime.refresh()
    .then((payload) => payload)
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export const authApi = {
  register: (body: { email: string; username: string; password: string }) =>
    apiRequest<AuthPayload>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
      auth: false,
      skipRefresh: true,
    }),
  login: (body: { username: string; password: string }) =>
    apiRequest<AuthPayload>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
      auth: false,
      skipRefresh: true,
    }),
  refresh: (userId: string) =>
    apiRequest<AuthPayload>('/auth/refresh', {
      method: 'POST',
      headers: { 'x-user-id': userId },
      auth: false,
      skipRefresh: true,
    }),
  logout: (userId: string) =>
    apiRequest<void>('/auth/logout', {
      method: 'POST',
      headers: { 'x-user-id': userId },
      skipRefresh: true,
    }),
  logoutAll: (userId: string) =>
    apiRequest<void>('/auth/logout-all', {
      method: 'POST',
      headers: { 'x-user-id': userId },
      skipRefresh: true,
    }),
  completeOAuthProfile: (body: { userid: string; username: string; displayName?: string; bio?: string; location?: string; avatar?: string }) =>
    apiRequest<{ profile: unknown }>('/auth/oauth/complete', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export async function downloadFile(url: string, filename: string) {
  const headers = new Headers();
  if (_accessToken) {
    headers.set('Authorization', `Bearer ${_accessToken}`);
  }

  const response = await fetch(url, { headers, credentials: 'include' });
  if (!response.ok) {
    throw new ApiError(response.status, `Download failed: ${response.statusText}`);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}