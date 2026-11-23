import { httpClient } from '@/services/api/httpClient';
import type { UpdateProfilePayload, UserProfile } from '@/types/models';

export const usersApi = {
  getMe(): Promise<UserProfile> {
    return httpClient.get<UserProfile>('/users/me');
  },

  updateMe(payload: UpdateProfilePayload): Promise<UserProfile> {
    return httpClient.patch<UserProfile>('/users/me', payload);
  },
};
