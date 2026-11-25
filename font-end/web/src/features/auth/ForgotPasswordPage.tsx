import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ArrowLeft, BookOpen, CheckCircle2, KeyRound, Lock, Mail, RefreshCw, Send } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { authApi } from '@/services/api/auth.api';
import { useTheme } from '@/app/ThemeProvider';
import { ApiError } from '@/services/api/httpClient';
import { loadGoogleIdentityApi } from '@/utils/googleIdentity';

const forgotSchema = z.object({
  email: z.string().trim().email('Vui lòng nhập địa chỉ email hợp lệ.').max(255, 'Email tối đa 255 ký tự.'),
});

const resetSchema = z
  .object({
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Mã OTP phải gồm đúng 6 chữ số.'),
    newPassword: z
      .string()
      .min(8, 'Mật khẩu mới phải có tối thiểu 8 ký tự.')
      .max(72, 'Mật khẩu mới tối đa 72 ký tự.')
      .refine((val) => /[A-Za-z]/.test(val) && /\d/.test(val), {
        message: 'Mật khẩu mới phải chứa ít nhất 1 chữ cái và 1 chữ số.',
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp.',
    path: ['confirmPassword'],
  });

export function ForgotPasswordPage() {
  const { loginWithGoogle } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittingGoogle, setSubmittingGoogle] = useState(false);
  const [gisReady, setGisReady] = useState(false);
  const googleButtonContainerRef = useRef<HTMLDivElement | null>(null);
  const isTestMode = import.meta.env?.MODE === 'test';
  const allowDemoGoogleFallback = isTestMode || import.meta.env?.VITE_ENABLE_MSW === 'true';
  const googleClientId = isTestMode
    ? ''
    : ((import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined) || '').trim();

  const handleGoogleCredential = useCallback(
    async (idToken: string) => {
      setFieldError(null);
      setServerError(null);
      setSubmittingGoogle(true);
      try {
        await loginWithGoogle(idToken);
        navigate('/', { replace: true });
      } catch (err) {
        if (err instanceof ApiError) {
          setServerError(err.message);
        } else {
          setServerError('Đăng nhập Google thất bại. Vui lòng thử lại.');
        }
      } finally {
        setSubmittingGoogle(false);
      }
    },
    [loginWithGoogle, navigate],
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
          const containerWidth = Math.max(
            220,
            Math.min(360, Math.floor(googleButtonContainerRef.current.clientWidth || 300)),
          );
          googleButtonContainerRef.current.innerHTML = '';
          gsi.renderButton(googleButtonContainerRef.current, {
            theme: isDark ? 'filled_black' : 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            width: containerWidth,
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
  }, [googleClientId, handleGoogleCredential, isDark]);

  async function handleRequestOtp(e: FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setServerError(null);
    setInfoMessage(null);

    const parsed = forgotSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message || 'Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authApi.forgotPassword({ email: parsed.data.email });
      setEmail(parsed.data.email);
      setStep('verify');
      setInfoMessage(
        res?.message ||
          `Mã OTP 6 chữ số đã được gửi tới ${parsed.data.email} (hiệu lực 10 phút).`,
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Không thể gửi mã OTP lúc này. Vui lòng thử lại sau ít phút.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendOtp() {
    if (submitting || !email.trim()) return;
    setFieldError(null);
    setServerError(null);
    setSubmitting(true);
    try {
      const res = await authApi.forgotPassword({ email: email.trim() });
      setOtp('');
      setInfoMessage(
        res?.message || `Đã gửi lại mã OTP 6 chữ số mới tới ${email.trim()} (hiệu lực 10 phút).`,
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Không thể gửi lại mã OTP lúc này. Vui lòng thử lại.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setServerError(null);
    setInfoMessage(null);

    const parsed = resetSchema.safeParse({ otp, newPassword, confirmPassword });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message || 'Thông tin đặt lại mật khẩu chưa hợp lệ.');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword({
        email: email.trim(),
        otp: parsed.data.otp,
        newPassword: parsed.data.newPassword,
      });
      navigate('/login?reason=password_reset', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Không thể đặt lại mật khẩu lúc này. Vui lòng thử lại.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setFieldError(null);
    setServerError(null);
    if (googleClientId) {
      try {
        const gsi = await loadGoogleIdentityApi();
        gsi.prompt();
      } catch {
        setServerError('Không thể tải Google Sign-In SDK. Vui lòng kiểm tra kết nối mạng.');
      }
      return;
    }
    if (allowDemoGoogleFallback) {
      await handleGoogleCredential('demo-google-id-token');
      return;
    }
    setServerError('Đăng nhập Google chưa được cấu hình. Vui lòng đăng nhập bằng email và mật khẩu.');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-700">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-extrabold text-slate-900">Quên mật khẩu</h1>
            <p className="text-xs font-medium text-slate-500">
              {step === 'request'
                ? 'Nhập email tài khoản để nhận mã OTP 6 chữ số khôi phục'
                : `Nhập mã OTP gửi tới ${email} và tạo mật khẩu mới`}
            </p>
          </div>
        </div>

        {infoMessage && !fieldError && !serverError && (
          <div
            role="status"
            className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{infoMessage}</span>
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

        {step === 'request' ? (
          <form onSubmit={(e) => void handleRequestOtp(e)} className="space-y-4" noValidate>
            <div>
              <label htmlFor="forgot-email" className="mb-1.5 block text-xs font-semibold text-slate-700">
                Email tài khoản đã đăng ký
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ban@vnua.edu.vn"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3.5 pl-10 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || submittingGoogle}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              <span>{submitting ? 'Đang gửi mã OTP...' : 'Gửi mã OTP khôi phục'}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => void handleResetPassword(e)} className="space-y-4" noValidate>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="reset-otp" className="text-xs font-semibold text-slate-700">
                  Mã OTP 6 chữ số
                </label>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleResendOtp()}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline disabled:opacity-50"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Gửi lại mã</span>
                </button>
              </div>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="reset-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Nhập 6 chữ số (VD: 482910)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3.5 pl-10 font-mono text-sm tracking-widest text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reset-new-password" className="mb-1.5 block text-xs font-semibold text-slate-700">
                Mật khẩu mới
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="reset-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự, gồm chữ và số"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3.5 pl-10 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reset-confirm-password" className="mb-1.5 block text-xs font-semibold text-slate-700">
                Xác nhận mật khẩu mới
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="reset-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3.5 pl-10 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              <span>{submitting ? 'Đang cập nhật mật khẩu...' : 'Xác nhận đặt lại mật khẩu'}</span>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setStep('request');
                setOtp('');
                setFieldError(null);
                setServerError(null);
                setInfoMessage(null);
              }}
              className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Nhập lại địa chỉ email khác
            </button>
          </form>
        )}

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          <span>hoặc</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {googleClientId && (
          <div
            ref={googleButtonContainerRef}
            className={gisReady ? 'flex max-w-full justify-center overflow-hidden' : 'hidden'}
          />
        )}

        {(!googleClientId || !gisReady) && (
          <button
            type="button"
            onClick={() => void handleGoogleLogin()}
            disabled={submitting || submittingGoogle}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <span>{submittingGoogle ? 'Đang đăng nhập...' : 'Đăng nhập bằng Google'}</span>
          </button>
        )}

        <p className="mt-5 text-center text-sm text-slate-500">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 font-semibold text-indigo-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại đăng nhập</span>
          </Link>
        </p>
      </div>
    </div>
  );
}
