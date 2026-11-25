import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { BookOpen, LogIn, Mail, Lock } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { ApiError } from '@/services/api/httpClient';
import { loadGoogleIdentityApi } from '@/utils/googleIdentity';

const loginSchema = z.object({
  email: z.string().trim().email('Vui lòng nhập địa chỉ email hợp lệ.'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
});

function getSafeRedirectPath(raw: string | null): string {
  if (!raw) return '/';
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

function getReasonNotice(reason: string | null): { tone: 'error' | 'info'; message: string } | null {
  if (reason === 'expired') {
    return { tone: 'error', message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' };
  }
  if (reason === 'disabled') {
    return {
      tone: 'error',
      message: 'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ Quản trị viên.',
    };
  }
  if (reason === 'password_changed') {
    return {
      tone: 'info',
      message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.',
    };
  }
  return null;
}

export function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const redirectTo = getSafeRedirectPath(params.get('redirect'));
  const reasonNotice = getReasonNotice(params.get('reason'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(
    reasonNotice?.tone === 'error' ? reasonNotice.message : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [gisReady, setGisReady] = useState(false);
  const googleButtonContainerRef = useRef<HTMLDivElement | null>(null);
  const isTestMode = import.meta.env?.MODE === 'test';
  const googleClientId = isTestMode
    ? ''
    : ((import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined) || '').trim();

  const handleGoogleCredential = useCallback(
    async (idToken: string) => {
      setFieldError(null);
      setServerError(null);
      setSubmitting(true);
      try {
        await loginWithGoogle(idToken);
        navigate(redirectTo, { replace: true });
      } catch (err) {
        if (err instanceof ApiError) {
          setServerError(err.message);
        } else {
          setServerError('Đăng nhập Google thất bại. Vui lòng thử lại.');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [loginWithGoogle, navigate, redirectTo],
  );

  useEffect(() => {
    if (!googleClientId) {
      setGisReady(false);
      return;
    }

    let cancelled = false;
    loadGoogleIdentityApi()
      .then((gsi) => {
        if (cancelled) return;
        gsi.initialize({
          client_id: googleClientId,
          callback: (response) => {
            if (response.credential) {
              void handleGoogleCredential(response.credential);
            } else {
              setServerError('Không nhận được mã xác thực từ Google. Vui lòng thử lại.');
            }
          },
        });
        if (googleButtonContainerRef.current) {
          googleButtonContainerRef.current.innerHTML = '';
          gsi.renderButton(googleButtonContainerRef.current, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            width: 360,
            locale: 'vi',
          });
          setGisReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setGisReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [googleClientId, handleGoogleCredential]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setServerError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message || 'Thông tin chưa hợp lệ.');
      return;
    }

    setSubmitting(true);
    try {
      await login(parsed.data);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Không thể đăng nhập lúc này. Vui lòng thử lại.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    if (googleClientId) {
      try {
        const gsi = await loadGoogleIdentityApi();
        gsi.prompt();
      } catch {
        setServerError('Không thể tải Google Sign-In SDK. Vui lòng kiểm tra kết nối mạng.');
      }
      return;
    }
    await handleGoogleCredential('demo-google-id-token');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-700">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-extrabold text-slate-900">LexiTag Learning Lab</h1>
            <p className="text-xs font-medium text-slate-500">Đăng nhập để tiếp tục lộ trình từ vựng</p>
          </div>
        </div>

        {reasonNotice?.tone === 'info' && !fieldError && !serverError && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800"
          >
            {reasonNotice.message}
          </div>
        )}

        {(fieldError || serverError) && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700"
          >
            {fieldError || serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold text-slate-700">
              Email tài khoản
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ban@vnua.edu.vn"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3.5 pl-10 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold text-slate-700">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3.5 pl-10 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white"
              />
            </div>
            <div className="mt-2 text-left">
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-indigo-700 hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            <span>{submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</span>
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          <span>hoặc</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {googleClientId && (
          <div
            ref={googleButtonContainerRef}
            className={gisReady ? 'flex justify-center' : 'hidden'}
          />
        )}

        {(!googleClientId || !gisReady) && (
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <span>Đăng nhập bằng Google</span>
          </button>
        )}

        <p className="mt-5 text-center text-sm text-slate-500">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-semibold text-indigo-700 hover:underline">
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}
