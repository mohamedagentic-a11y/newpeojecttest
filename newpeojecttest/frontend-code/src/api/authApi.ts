import { apiRequest, ApiRequestError } from './client';
import type { LoginResponse, User } from '../types';

/**
 * Normalises a login payload. The client may or may not unwrap the
 * `{ data: ... }` envelope described in the API specification, so both
 * shapes are accepted here.
 */
function normaliseLoginResponse(raw: unknown): LoginResponse {
  let candidate: unknown = raw;
  if (
    candidate !== null &&
    typeof candidate === 'object' &&
    'data' in (candidate as Record<string, unknown>) &&
    !('token' in (candidate as Record<string, unknown>))
  ) {
    candidate = (candidate as Record<string, unknown>).data;
  }

  if (candidate === null || typeof candidate !== 'object') {
    throw new Error('Unexpected login response from server.');
  }

  const record = candidate as Record<string, unknown>;
  const token = record.token;
  const user = record.user as User | undefined;

  if (typeof token !== 'string' || token.length === 0 || !user || typeof user !== 'object') {
    throw new Error('Unexpected login response from server.');
  }

  return { token, user };
}

export const authApi = {
  /**
   * Authenticates with email and password.
   * POST /api/v1/auth/login → { token, user }
   */
  async login(email: string, password: string, signal?: AbortSignal): Promise<LoginResponse> {
    const raw = await apiRequest<unknown>('/auth/login', {
      method: 'POST',
      body: { email: email.trim(), password },
      signal,
    });
    return normaliseLoginResponse(raw);
  },

  /**
   * Notifies the server of logout. The backend is stateless (JWT), so a
   * failure here must never prevent the client from clearing its session;
   * errors are logged and swallowed.
   */
  async logout(): Promise<void> {
    try {
      await apiRequest<unknown>('/auth/logout', { method: 'POST' });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        console.warn(`Logout request returned status ${err.status}; continuing with local logout.`);
      } else {
        console.warn('Logout request failed; continuing with local logout.', err);
      }
    }
  },
};

export default authApi;