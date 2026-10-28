import { apiRequest, ApiRequestError } from './client';
import type { User } from '../types';

export interface LoginResult {
  token: string;
  user: User;
}

function isLoginResult(value: unknown): value is LoginResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.token === 'string' && !!v.user && typeof v.user === 'object';
}

/**
 * Accepts either the unwrapped payload ({token, user}) or the full
 * envelope ({data: {token, user}}), so this works regardless of whether
 * the client unwraps `data`.
 */
function extractLoginResult(response: unknown): LoginResult {
  if (isLoginResult(response)) return response;
  if (response && typeof response === 'object') {
    const inner = (response as Record<string, unknown>).data;
    if (isLoginResult(inner)) return inner;
  }
  throw new Error('Unexpected login response from server.');
}

/**
 * Authenticates with email and password. Returns the JWT and the signed-in user.
 * The caller (AuthContext) is responsible for storing the token and updating auth state.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const response = await apiRequest<unknown>('/auth/login', {
    method: 'POST',
    body: { email: email.trim(), password },
  });
  return extractLoginResult(response);
}

/**
 * Notifies the server of logout. The backend is stateless (JWT), so a failure
 * here must not prevent the client from clearing its local session; errors
 * other than network/auth issues are swallowed after logging.
 */
export async function logout(): Promise<void> {
  try {
    await apiRequest<unknown>('/auth/logout', { method: 'POST' });
  } catch (err) {
    if (err instanceof ApiRequestError) {
      // 401/404 etc. — session is being discarded locally anyway.
      return;
    }
    // Network or unexpected error: still allow local sign-out to proceed.
    console.warn('Logout request failed:', err);
  }
}