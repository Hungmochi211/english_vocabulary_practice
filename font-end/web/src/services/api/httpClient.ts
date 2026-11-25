import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorDetail, ApiResponse, AuthSession } from '@/types/models';
import { normalizeAuthSession } from '@/services/api/normalizers';

export const SESSION_STORAGE_KEY = 'lexitag:v1:auth-session';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getStoredSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed || typeof parsed.accessToken !== 'string' || !parsed.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredSession(session: AuthSession | null): void {
  try {
    if (!session) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // Ignore storage quota / private-mode errors
  }
}

type SessionInvalidHandler = (reason: 'expired' | 'disabled') => void;
let onSessionInvalid: SessionInvalidHandler | null = null;

export function registerSessionInvalidHandler(handler: SessionInvalidHandler | null): void {
  onSessionInvalid = handler;
}

const API_BASE_URL =
  (import.meta.env?.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3000/api/v1';

export const rawAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

let refreshPromise: Promise<AuthSession> | null = null;
const AUTH_REFRESH_LOCK_NAME = 'lexitag:auth:refresh';

async function performSingleFlightRefresh(): Promise<AuthSession> {
  if (refreshPromise) return refreshPromise;

  const initialSession = getStoredSession();
  if (!initialSession?.refreshToken) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }
  const initialRefreshToken = initialSession.refreshToken;

  const executeRefresh = async (): Promise<AuthSession> => {
    const latest = getStoredSession();
    if (!latest?.refreshToken) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
    if (latest.refreshToken !== initialRefreshToken && latest.accessToken) {
      return latest;
    }

    const res = await axios.post<ApiResponse<AuthSession>>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken: latest.refreshToken },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
    );
    const payload = res.data;
    if (!payload?.success || !payload.data?.accessToken) {
      throw new ApiError(
        401,
        payload?.error?.code || 'UNAUTHORIZED',
        payload?.error?.message || 'Không thể làm mới phiên đăng nhập.',
        payload?.error?.details ?? null,
      );
    }
    const normalized = normalizeAuthSession(
      payload.data as AuthSession & { expiresIn?: number },
    );
    setStoredSession(normalized);
    return normalized;
  };

  const lockManager =
    typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function'
      ? navigator.locks
      : null;

  const runWithLock = async (): Promise<AuthSession> => {
    if (lockManager) {
      return (await lockManager.request(AUTH_REFRESH_LOCK_NAME, executeRefresh)) as AuthSession;
    }
    return executeRefresh();
  };

  refreshPromise = runWithLock().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

rawAxios.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const session = getStoredSession();
  if (session?.accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete('Content-Type');
  }
  return config;
});

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError(error)) {
    const err = error as AxiosError<ApiResponse<unknown>>;
    const status = err.response?.status ?? 0;
    const bodyErr: ApiErrorDetail | null | undefined = err.response?.data?.error;
    if (bodyErr) {
      return new ApiError(status, bodyErr.code, bodyErr.message, bodyErr.details ?? null);
    }
    if (!err.response) {
      return new ApiError(
        0,
        'NETWORK_ERROR',
        'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.',
      );
    }
    if (status === 429) {
      return new ApiError(
        429,
        'RATE_LIMIT_EXCEEDED',
        'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.',
      );
    }
    if (status === 503) {
      return new ApiError(
        503,
        'SERVICE_UNAVAILABLE',
        'Dịch vụ tạm thời gián đoạn. Vui lòng thử lại sau ít phút.',
      );
    }
    return new ApiError(status, `HTTP_${status}`, err.message || 'Đã xảy ra lỗi không xác định.');
  }
  return new ApiError(0, 'UNKNOWN_ERROR', 'Đã xảy ra lỗi không xác định.');
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

rawAxios.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const status = error.response?.status;
    const errorCode = error.response?.data?.error?.code;
    const originalConfig = error.config as RetriableConfig | undefined;

    if (status === 403 && errorCode === 'ACCOUNT_DISABLED') {
      setStoredSession(null);
      onSessionInvalid?.('disabled');
      return Promise.reject(toApiError(error));
    }

    const isAuthEndpoint =
      originalConfig?.url?.includes('/auth/login') ||
      originalConfig?.url?.includes('/auth/register') ||
      originalConfig?.url?.includes('/auth/google') ||
      originalConfig?.url?.includes('/auth/refresh');

    if (status === 401 && originalConfig && !originalConfig._retry && !isAuthEndpoint) {
      const storedSession = getStoredSession();
      if (storedSession?.refreshToken) {
        originalConfig._retry = true;
        try {
          const nextSession = await performSingleFlightRefresh();
          originalConfig.headers.Authorization = `Bearer ${nextSession.accessToken}`;
          if (originalConfig.url?.includes('/auth/logout') && nextSession.refreshToken) {
            originalConfig.data = JSON.stringify({ refreshToken: nextSession.refreshToken });
          }
          return rawAxios(originalConfig);
        } catch (refreshErr) {
          const apiErr = toApiError(refreshErr);
          if (apiErr.status === 401) {
            setStoredSession(null);
            onSessionInvalid?.('expired');
          } else if (apiErr.status === 403 && apiErr.code === 'ACCOUNT_DISABLED') {
            setStoredSession(null);
            onSessionInvalid?.('disabled');
          }
          return Promise.reject(apiErr);
        }
      } else if (storedSession) {
        setStoredSession(null);
        onSessionInvalid?.('expired');
      }
    }

    return Promise.reject(toApiError(error));
  },
);

export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await rawAxios.request<ApiResponse<T>>(config);
    const envelope = response.data;
    if (!envelope || envelope.success === false) {
      throw new ApiError(
        response.status,
        envelope?.error?.code || 'API_ERROR',
        envelope?.error?.message || 'Yêu cầu thất bại.',
        envelope?.error?.details ?? null,
      );
    }
    return envelope.data as T;
  } catch (err) {
    throw toApiError(err);
  }
}

export const httpClient = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return apiRequest<T>({ ...config, method: 'GET', url });
  },
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return apiRequest<T>({ ...config, method: 'POST', url, data });
  },
  patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return apiRequest<T>({ ...config, method: 'PATCH', url, data });
  },
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return apiRequest<T>({ ...config, method: 'DELETE', url });
  },
};
