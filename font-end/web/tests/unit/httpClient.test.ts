import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { API_BASE, mockLearnerUser } from '../mocks/handlers';
import {
  ApiError,
  getStoredSession,
  httpClient,
  registerSessionInvalidHandler,
  setStoredSession,
} from '@/services/api/httpClient';

describe('httpClient', () => {
  it('unwraps standard ApiResponse envelope on success', async () => {
    const user = await httpClient.get<typeof mockLearnerUser>('/users/me');
    expect(user.email).toBe(mockLearnerUser.email);
  });

  it('deduplicates concurrent 401 refreshes using a single-flight refresh queue', async () => {
    setStoredSession({
      accessToken: 'expired-access',
      refreshToken: 'valid-refresh',
      expiresInSeconds: 900,
      user: mockLearnerUser,
    });

    let refreshCalls = 0;
    server.use(
      http.get(`${API_BASE}/protected-a`, ({ request }) => {
        if (request.headers.get('authorization') !== 'Bearer new-access-token') {
          return HttpResponse.json(
            {
              success: false,
              data: null,
              error: { code: 'UNAUTHORIZED', message: 'Token expired', details: null },
            },
            { status: 401 },
          );
        }
        return HttpResponse.json({ success: true, data: { ok: 'A' }, error: null });
      }),
      http.get(`${API_BASE}/protected-b`, ({ request }) => {
        if (request.headers.get('authorization') !== 'Bearer new-access-token') {
          return HttpResponse.json(
            {
              success: false,
              data: null,
              error: { code: 'UNAUTHORIZED', message: 'Token expired', details: null },
            },
            { status: 401 },
          );
        }
        return HttpResponse.json({ success: true, data: { ok: 'B' }, error: null });
      }),
      http.post(`${API_BASE}/auth/refresh`, async () => {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 30));
        return HttpResponse.json({
          success: true,
          data: {
            accessToken: 'new-access-token',
            refreshToken: 'rotated-refresh',
            expiresInSeconds: 900,
            user: mockLearnerUser,
          },
          error: null,
        });
      }),
    );

    const [resA, resB] = await Promise.all([
      httpClient.get<{ ok: string }>('/protected-a'),
      httpClient.get<{ ok: string }>('/protected-b'),
    ]);

    expect(resA.ok).toBe('A');
    expect(resB.ok).toBe('B');
    expect(refreshCalls).toBe(1);
    expect(getStoredSession()?.refreshToken).toBe('rotated-refresh');
  });

  it('clears session and invokes invalid handler on 403 ACCOUNT_DISABLED', async () => {
    setStoredSession({
      accessToken: 'active-token',
      refreshToken: 'active-refresh',
      expiresInSeconds: 900,
      user: mockLearnerUser,
    });
    const invalidSpy = vi.fn();
    registerSessionInvalidHandler(invalidSpy);

    server.use(
      http.get(`${API_BASE}/users/me`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'ACCOUNT_DISABLED',
              message: 'Tài khoản đã bị khóa.',
              details: null,
            },
          },
          { status: 403 },
        ),
      ),
    );

    await expect(httpClient.get('/users/me')).rejects.toBeInstanceOf(ApiError);
    expect(getStoredSession()).toBeNull();
    expect(invalidSpy).toHaveBeenCalledWith('disabled');
    registerSessionInvalidHandler(null);
  });
});
