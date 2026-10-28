import { getToken, clearSession } from '../auth/tokenStorage';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type QueryValue = string | number | boolean | null | undefined;

export interface ApiRequestOptions {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

/**
 * Error thrown by apiRequest for any non-2xx response or network failure.
 * `status` is the HTTP status (0 for network failures), `code` is the
 * server-provided error code when present.
 */
export class ApiRequestError extends Error {
  public readonly status: number;
  public readonly code: number | string;

  constructor(status: number, message: string, code?: number | string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code ?? status;
    Object.setPrototypeOf(this, ApiRequestError.prototype);
  }
}

/** Event dispatched on window when the server rejects the session (HTTP 401). */
export const UNAUTHORIZED_EVENT = 'auth:unauthorized';

const BASE_URL = '/api/v1';

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  let url = BASE_URL + normalizedPath;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params.append(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
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

function extractError(payload: unknown, status: number, statusText: string): ApiRequestError {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const err = (payload as { error?: { code?: number | string; message?: string } }).error;
    if (err && typeof err === 'object') {
      return new ApiRequestError(
        status,
        err.message || statusText || `Request failed with status ${status}`,
        err.code
      );
    }
  }
  if (typeof payload === 'string' && payload.trim()) {
    return new ApiRequestError(status, payload.trim());
  }
  return new ApiRequestError(status, statusText || `Request failed with status ${status}`);
}

/**
 * Calls the backend at '/api/v1' + path, sending a JSON body and the bearer
 * token from storage. Resolves with the unwrapped `data` field of the
 * response; throws ApiRequestError on failure. On 401 the stored session is
 * cleared and an 'auth:unauthorized' window event is dispatched so the auth
 * context can reset its state.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const init: RequestInit = { method, headers, signal };
  if (body !== undefined && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), init);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiRequestError(0, 'Unable to reach the server. Please check your connection.');
  }

  const payload = await parseBody(response);

  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      }
    }
    throw extractError(payload, response.status, response.statusText);
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}