import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/services/api/auth.api';
import {
  getStoredSession,
  registerSessionInvalidHandler,
  setStoredSession,
} from '@/services/api/httpClient';
import { localAvatarAdapter } from '@/services/adapters/avatar.adapter';
import { HISTORY_STORAGE_KEY } from '@/services/adapters/history.adapter';
import { NOTIFICATIONS_STORAGE_KEY } from '@/services/adapters/notifications.adapter';
import { SAVED_WORDS_STORAGE_KEY } from '@/services/adapters/savedWords.adapter';
import { AI_CONVERSATIONS_STORAGE_KEY } from '@/services/adapters/aiTutor.adapter';
import {
  SUPPORT_MESSAGES_KEY,
  SUPPORT_TICKETS_KEY,
} from '@/services/adapters/support.adapter';
import type { AuthSession, LoginPayload, RegisterPayload, UserProfile } from '@/types/models';

const ACTIVE_USER_ID_KEY = 'lexitag:v1:active-user-id';
const DAILY_GOAL_STORAGE_KEY = 'lexitag:v1:daily-goal';

const USER_SCOPED_STORAGE_KEYS = [
  HISTORY_STORAGE_KEY,
  NOTIFICATIONS_STORAGE_KEY,
  SAVED_WORDS_STORAGE_KEY,
  AI_CONVERSATIONS_STORAGE_KEY,
  SUPPORT_MESSAGES_KEY,
  SUPPORT_TICKETS_KEY,
  DAILY_GOAL_STORAGE_KEY,
];

function clearUserScopedStorage(): void {
  for (const key of USER_SCOPED_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}

function syncAccountLocalData(nextUserId: number, mode: 'hydrate' | 'authenticate'): void {
  try {
    const prevId = window.localStorage.getItem(ACTIVE_USER_ID_KEY);
    const nextIdStr = String(nextUserId);
    if (mode === 'hydrate') {
      if (prevId && prevId !== nextIdStr) {
        clearUserScopedStorage();
      }
      window.localStorage.setItem(ACTIVE_USER_ID_KEY, nextIdStr);
      return;
    }

    if (!prevId || prevId !== nextIdStr) {
      clearUserScopedStorage();
    }
    window.localStorage.setItem(ACTIVE_USER_ID_KEY, nextIdStr);
  } catch {
    // Ignore storage errors
  }
}

function mergeLocalAvatar(session: AuthSession | null): AuthSession | null {
  if (!session?.user) return session;
  const localAvatar = localAvatarAdapter.get(session.user.id);
  if (!localAvatar || session.user.avatarUrl === localAvatar) return session;
  return {
    ...session,
    user: {
      ...session.user,
      avatarUrl: localAvatar,
    },
  };
}

interface AuthContextValue {
  session: AuthSession | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  invalidReason: 'expired' | 'disabled' | null;
  login: (payload: LoginPayload) => Promise<AuthSession>;
  register: (payload: RegisterPayload) => Promise<AuthSession>;
  loginWithGoogle: (idToken: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
  clearLocalSession: () => void;
  updateLocalUser: (patch: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(() => {
    const hydrated = mergeLocalAvatar(getStoredSession());
    if (hydrated?.user) {
      syncAccountLocalData(hydrated.user.id, 'hydrate');
    }
    return hydrated;
  });
  const [invalidReason, setInvalidReason] = useState<'expired' | 'disabled' | null>(null);

  const persistSession = useCallback((next: AuthSession | null) => {
    if (next?.user) {
      syncAccountLocalData(next.user.id, 'authenticate');
      setInvalidReason(null);
    }
    const merged = mergeLocalAvatar(next);
    setStoredSession(merged);
    setSession(merged);
  }, []);

  useEffect(() => {
    registerSessionInvalidHandler((reason) => {
      setInvalidReason(reason);
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

  const clearLocalSession = useCallback(() => {
    setInvalidReason(null);
    persistSession(null);
    queryClient.clear();
  }, [persistSession, queryClient]);

  const logout = useCallback(async () => {
    const refreshToken = session?.refreshToken;
    try {
      await authApi.logout(refreshToken);
    } catch {
      // Clear local session even if server logout fails
    } finally {
      clearLocalSession();
    }
  }, [clearLocalSession, session?.refreshToken]);

  const updateLocalUser = useCallback((patch: Partial<UserProfile>) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next: AuthSession = { ...prev, user: { ...prev.user, ...patch } };
      setStoredSession(next);
      return next;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session?.accessToken && session?.user),
      isAdmin: session?.user?.role === 'admin',
      invalidReason,
      login,
      register,
      loginWithGoogle,
      logout,
      clearLocalSession,
      updateLocalUser,
    }),
    [clearLocalSession, invalidReason, login, loginWithGoogle, logout, register, session, updateLocalUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
