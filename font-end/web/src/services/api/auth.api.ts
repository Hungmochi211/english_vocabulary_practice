import { httpClient } from './httpClient';
import type {
  AuthSession,
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
} from '@/types/models';

export const authApi = {
  register(payload: RegisterPayload): Promise<AuthSession> {
    return httpClient.post<AuthSession>('/auth/register', payload);
  },
  login(payload: LoginPayload): Promise<AuthSession> {
    return httpClient.post<AuthSession>('/auth/login', payload);
  },
  loginWithGoogle(idToken: string): Promise<AuthSession> {
    return httpClient.post<AuthSession>('/auth/google', { idToken });
  },
  logout(refreshToken?: string): Promise<null> {
    return httpClient.post<null>('/auth/logout', refreshToken ? { refreshToken } : {});
  },
  changePassword(payload: ChangePasswordPayload): Promise<null> {
    return httpClient.post<null>('/auth/change-password', payload);
  },
};
