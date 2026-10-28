import type { User } from '../types';

const TOKEN_KEY = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_TOKEN_KEY ?? 'library_portal_token';
const USER_KEY = 'library_portal_user';

function storageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
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

export function getToken(): string | null {
  if (!storageAvailable()) return null;
  try {
    const token = window.localStorage.getItem(TOKEN_KEY);
    return token && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: User): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Storage may be full or blocked; session will live only in memory.
  }
}

export function getStoredUser(): User | null {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}