import { getStoredSession, httpClient } from './httpClient';
import { normalizeAuthSession } from './normalizers';
import type {
  AuthSession,
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
} from '@/types/models';

export const authApi = {
  async register(payload: RegisterPayload): Promise<AuthSession> {
    const raw = await httpClient.post<AuthSession & { expiresIn?: number }>(
      '/auth/register',
      payload,
    );
    return normalizeAuthSession(raw);
  },
  async login(payload: LoginPayload): Promise<AuthSession> {
    const raw = await httpClient.post<AuthSession & { expiresIn?: number }>(
      '/auth/login',
      payload,
    );
    return normalizeAuthSession(raw);
  },
  async loginWithGoogle(idToken: string): Promise<AuthSession> {
    const raw = await httpClient.post<AuthSession & { expiresIn?: number }>('/auth/google', {
      idToken,
    });
    return normalizeAuthSession(raw);
  },
  async logout(refreshToken?: string): Promise<null> {
    const token = refreshToken?.trim() || getStoredSession()?.refreshToken?.trim();
    if (!token) {
      return null;
    }
    return httpClient.post<null>('/auth/logout', { refreshToken: token });
  },
  changePassword(payload: ChangePasswordPayload): Promise<null> {
    return httpClient.post<null>('/auth/change-password', payload);
  },
};
