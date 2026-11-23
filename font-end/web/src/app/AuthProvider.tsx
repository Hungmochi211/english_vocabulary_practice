import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/services/api/auth.api';
import {
  getStoredSession,
  registerSessionInvalidHandler,
  setStoredSession,
} from '@/services/api/httpClient';
import type { AuthSession, LoginPayload, RegisterPayload, UserProfile } from '@/types/models';

interface AuthContextValue {
  session: AuthSession | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (payload: LoginPayload) => Promise<AuthSession>;
  register: (payload: RegisterPayload) => Promise<AuthSession>;
  loginWithGoogle: (idToken: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
  updateLocalUser: (patch: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());

  const persistSession = useCallback((next: AuthSession | null) => {
    setStoredSession(next);
    setSession(next);
  }, []);

  useEffect(() => {
    registerSessionInvalidHandler(() => {
      setSession(null);
      queryClient.clear();
    });
    return () => registerSessionInvalidHandler(null);
  }, [queryClient]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const next = await authApi.login(payload);
      persistSession(next);
      return next;
    },
    [persistSession],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const next = await authApi.register(payload);
      persistSession(next);
      return next;
    },
    [persistSession],
  );

  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      const next = await authApi.loginWithGoogle(idToken);
      persistSession(next);
      return next;
    },
    [persistSession],
  );

  const logout = useCallback(async () => {
    const refreshToken = session?.refreshToken;
    try {
      await authApi.logout(refreshToken);
    } catch {
      // Clear local session even if server logout fails
    } finally {
      persistSession(null);
      queryClient.clear();
    }
  }, [persistSession, queryClient, session?.refreshToken]);

  const updateLocalUser = useCallback(
    (patch: Partial<UserProfile>) => {
      setSession((prev) => {
        if (!prev) return prev;
        const next: AuthSession = { ...prev, user: { ...prev.user, ...patch } };
        setStoredSession(next);
        return next;
      });
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session?.accessToken && session?.user),
      isAdmin: session?.user?.role === 'admin',
      login,
      register,
      loginWithGoogle,
      logout,
      updateLocalUser,
    }),
    [login, loginWithGoogle, logout, register, session, updateLocalUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
