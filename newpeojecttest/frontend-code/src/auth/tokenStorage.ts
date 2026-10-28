import type { User } from '../types';

/**
 * localStorage keys used for the auth session.
 * Every module that needs the token must go through getToken() so that
 * the key stays consistent across the application.
 */
const TOKEN_KEY = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_TOKEN_KEY ?? 'library_portal.token';
const USER_KEY = 'library_portal.user';

function storageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function getToken(): string | null {
  if (!storageAvailable()) return null;
  try {
    const token = window.localStorage.getItem(TOKEN_KEY);
    return token && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  if (!storageAvailable()) return;
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Storage may be full or blocked; nothing more we can do.
  }
}

function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    (v.role === 'member' || v.role === 'librarian')
  );
}

export function getStoredUser(): User | null {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isUser(parsed)) return parsed;
    // Corrupt or outdated entry: drop it.
    window.localStorage.removeItem(USER_KEY);
    return null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User | null): void {
  if (!storageAvailable()) return;
  try {
    if (user) {
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(USER_KEY);
    }
  } catch {
    // Ignore storage failures.
  }
}

export function clearSession(): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  } catch {
    // Ignore storage failures.
  }
}