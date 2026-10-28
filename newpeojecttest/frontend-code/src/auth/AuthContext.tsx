import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import authApi from '../api/authApi';
import { getToken, setToken, getStoredUser, setStoredUser, clearSession } from './tokenStorage';
import type { User, LoginResponse } from '../types';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readInitialUser(): User | null {
  const token = getToken();
  if (!token) return null;
  const stored = getStoredUser() as User | null | undefined;
  return stored ?? null;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(() => readInitialUser());

  const endSession = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const result = (await authApi.login(email, password)) as LoginResponse;
    if (!result || !result.token || !result.user) {
      throw new Error('Login failed: the server returned an unexpected response.');
    }
    setToken(result.token);
    setStoredUser(result.user);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch (err) {
      // The server-side logout is best-effort; the local session is always cleared.
      console.warn('Logout request failed; clearing local session anyway.', err);
    } finally {
      endSession();
      navigate('/login', { replace: true });
    }
  }, [endSession, navigate]);

  useEffect(() => {
    const handleForcedLogout = () => {
      endSession();
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:logout', handleForcedLogout);
    return () => {
      window.removeEventListener('auth:logout', handleForcedLogout);
    };
  }, [endSession, navigate]);

  // Keep state in sync if the session is changed in another tab.
  useEffect(() => {
    const handleStorage = () => {
      setUser(readInitialUser());
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      login,
      logout,
    }),
    [user, login, logout]
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