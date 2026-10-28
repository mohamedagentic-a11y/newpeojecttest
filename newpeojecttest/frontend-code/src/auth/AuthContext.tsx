import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as apiLogin, logout as apiLogout } from '../api/authApi';
import type { LoginResult } from '../api/authApi';
import { getToken, setSession, getStoredUser, clearSession } from './tokenStorage';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface SessionState {
  token: string | null;
  user: User | null;
}

function readSession(): SessionState {
  const token = getToken() ?? null;
  const user = (getStoredUser() as User | null | undefined) ?? null;
  if (!token || !user) {
    return { token: null, user: null };
  }
  return { token, user };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSessionState] = useState<SessionState>(() => readSession());

  // Keep in sync if the session is changed in another tab (or cleared elsewhere).
  useEffect(() => {
    const onStorage = () => {
      setSessionState(readSession());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const result: LoginResult = await apiLogin(email, password);
    setSession(result.token, result.user);
    setSessionState({ token: result.token, user: result.user });
    return result.user;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiLogout();
    } catch {
      // Ignore logout errors; the session is cleared locally regardless.
    }
    clearSession();
    setSessionState({ token: null, user: null });
    navigate('/login', { replace: true });
  }, [navigate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session.user,
      token: session.token,
      isAuthenticated: Boolean(session.token && session.user),
      login,
      logout,
    }),
    [session, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}