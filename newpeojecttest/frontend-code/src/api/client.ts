import { clearSession, getToken } from '../auth/tokenStorage';

/**
 * Error thrown by apiRequest for any non-2xx response (or network failure).
 * `status` is the HTTP status code (0 when the request never reached the server).
 */
export class ApiRequestError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    Object.setPrototypeOf(this, ApiRequestError.prototype);
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type QueryValue = string | number | boolean | null | undefined;

export interface ApiRequestOptions {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

function resolveBaseUrl(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const configured = env?.VITE_API_BASE_URL;
  const base = configured && configured.trim() !== '' ? configured.trim() : '/api/v1';
  return base.replace(/\/+$/, '');
}

const API_BASE_URL = resolveBaseUrl();

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  let url = `${API_BASE_URL}${normalizedPath}`;

  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params.append(key, String(value));
    }
    const qs = params.toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }

  return url;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const err = (payload as { error?: unknown }).error;
    if (err && typeof err === 'object') {
      const message = (err as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim() !== '') return message;
    }
    if (typeof err === 'string' && err.trim() !== '') return err;
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim() !== '') return message;
  }
  if (typeof payload === 'string' && payload.trim() !== '') return payload;
  return fallback;
}

/**
 * Performs a request against the /api/v1 API.
 * - Attaches the stored JWT as a Bearer token.
 * - Unwraps the `{ data }` envelope on success.
 * - Throws ApiRequestError built from the `{ error }` envelope on failure.
 * - On 401, clears the stored session and dispatches an 'auth:logout' window event.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const init: RequestInit = { method, headers, signal };

  if (body !== undefined && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), init);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new ApiRequestError(0, 'Unable to reach the server. Please check your connection and try again.');
  }

  const payload = await parseBody(response);

  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth:logout'));
      }
    }
    const fallback = response.statusText || `Request failed with status ${response.status}`;
    throw new ApiRequestError(response.status, extractErrorMessage(payload, fallback));
  }

  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}