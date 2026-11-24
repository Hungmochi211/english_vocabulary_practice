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

  it('clears session with expired reason when refresh returns 401 (e.g. TOKEN_REUSE_DETECTED)', async () => {
    setStoredSession({
      accessToken: 'expired-access',
      refreshToken: 'reused-refresh',
      expiresInSeconds: 900,
      user: mockLearnerUser,
    });
    const invalidSpy = vi.fn();
    registerSessionInvalidHandler(invalidSpy);

    server.use(
      http.get(`${API_BASE}/protected-refresh-401`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'UNAUTHORIZED', message: 'Token expired', details: null },
          },
          { status: 401 },
        ),
      ),
      http.post(`${API_BASE}/auth/refresh`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'TOKEN_REUSE_DETECTED',
              message: 'Phát hiện tái sử dụng refresh token.',
              details: null,
            },
          },
          { status: 401 },
        ),
      ),
    );

    await expect(httpClient.get('/protected-refresh-401')).rejects.toMatchObject({
      status: 401,
      code: 'TOKEN_REUSE_DETECTED',
    });
    expect(getStoredSession()).toBeNull();
    expect(invalidSpy).toHaveBeenCalledWith('expired');
    registerSessionInvalidHandler(null);
  });

  it('clears session with disabled reason when refresh returns 403 ACCOUNT_DISABLED', async () => {
    setStoredSession({
      accessToken: 'expired-access',
      refreshToken: 'disabled-refresh',
      expiresInSeconds: 900,
      user: mockLearnerUser,
    });
    const invalidSpy = vi.fn();
    registerSessionInvalidHandler(invalidSpy);

    server.use(
      http.get(`${API_BASE}/protected-refresh-disabled`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'UNAUTHORIZED', message: 'Token expired', details: null },
          },
          { status: 401 },
        ),
      ),
      http.post(`${API_BASE}/auth/refresh`, () =>
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

    await expect(httpClient.get('/protected-refresh-disabled')).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_DISABLED',
    });
    expect(getStoredSession()).toBeNull();
    expect(invalidSpy).toHaveBeenCalledWith('disabled');
    registerSessionInvalidHandler(null);
  });

  it('keeps session and skips onSessionInvalid when refresh returns 403 with another error code', async () => {
    setStoredSession({
      accessToken: 'expired-access',
      refreshToken: 'valid-refresh',
      expiresInSeconds: 900,
      user: mockLearnerUser,
    });
    const invalidSpy = vi.fn();
    registerSessionInvalidHandler(invalidSpy);

    server.use(
      http.get(`${API_BASE}/protected-refresh-403-other`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'UNAUTHORIZED', message: 'Token expired', details: null },
          },
          { status: 401 },
        ),
      ),
      http.post(`${API_BASE}/auth/refresh`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'FORBIDDEN',
              message: 'Không có quyền thực hiện yêu cầu.',
              details: null,
            },
          },
          { status: 403 },
        ),
      ),
    );

    await expect(httpClient.get('/protected-refresh-403-other')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    expect(getStoredSession()?.refreshToken).toBe('valid-refresh');
    expect(invalidSpy).not.toHaveBeenCalled();
    registerSessionInvalidHandler(null);
  });

  it('keeps session and skips onSessionInvalid when refresh fails with transient 503 or network error', async () => {
    setStoredSession({
      accessToken: 'expired-access',
      refreshToken: 'valid-refresh',
      expiresInSeconds: 900,
      user: mockLearnerUser,
    });
    const invalidSpy = vi.fn();
    registerSessionInvalidHandler(invalidSpy);

    server.use(
      http.get(`${API_BASE}/protected-refresh-503`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'UNAUTHORIZED', message: 'Token expired', details: null },
          },
          { status: 401 },
        ),
      ),
      http.post(`${API_BASE}/auth/refresh`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Dịch vụ tạm thời gián đoạn.',
              details: null,
            },
          },
          { status: 503 },
        ),
      ),
    );

    await expect(httpClient.get('/protected-refresh-503')).rejects.toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
    expect(getStoredSession()?.refreshToken).toBe('valid-refresh');
    expect(invalidSpy).not.toHaveBeenCalled();

    server.use(
      http.post(`${API_BASE}/auth/refresh`, () => HttpResponse.error()),
    );

    await expect(httpClient.get('/protected-refresh-503')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
    expect(getStoredSession()?.refreshToken).toBe('valid-refresh');
    expect(invalidSpy).not.toHaveBeenCalled();
    registerSessionInvalidHandler(null);
  });

  it('clears session with expired reason on 401 when stored session is missing refreshToken', async () => {
    setStoredSession({
      accessToken: 'expired-access',
      refreshToken: '',
      expiresInSeconds: 900,
      user: mockLearnerUser,
    });
    const invalidSpy = vi.fn();
    registerSessionInvalidHandler(invalidSpy);

    server.use(
      http.get(`${API_BASE}/protected-no-refresh`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'UNAUTHORIZED', message: 'Token expired', details: null },
          },
          { status: 401 },
        ),
      ),
    );

    await expect(httpClient.get('/protected-no-refresh')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
    expect(getStoredSession()).toBeNull();
    expect(invalidSpy).toHaveBeenCalledWith('expired');
    registerSessionInvalidHandler(null);
  });

  it('refreshes token and retries POST /auth/logout with the newly rotated refreshToken', async () => {
    setStoredSession({
      accessToken: 'expired-access',
      refreshToken: 'old-refresh-token',
      expiresInSeconds: 900,
      user: mockLearnerUser,
    });

    const receivedLogoutTokens: string[] = [];
    server.use(
      http.post(`${API_BASE}/auth/refresh`, () =>
        HttpResponse.json({
          success: true,
          data: {
            accessToken: 'fresh-access-token',
            refreshToken: 'rotated-refresh-token',
            expiresInSeconds: 900,
            user: mockLearnerUser,
          },
          error: null,
        }),
      ),
      http.post(`${API_BASE}/auth/logout`, async ({ request }) => {
        const body = (await request.json()) as { refreshToken?: string };
        receivedLogoutTokens.push(body.refreshToken ?? '');
        if (request.headers.get('authorization') !== 'Bearer fresh-access-token') {
          return HttpResponse.json(
            {
              success: false,
              data: null,
              error: { code: 'UNAUTHORIZED', message: 'Access token expired', details: null },
            },
            { status: 401 },
          );
        }
        return HttpResponse.json({ success: true, data: null, error: null });
      }),
    );

    await expect(
      httpClient.post<null>('/auth/logout', { refreshToken: 'old-refresh-token' }),
    ).resolves.toBeNull();
    expect(receivedLogoutTokens).toEqual(['old-refresh-token', 'rotated-refresh-token']);
  });
});
