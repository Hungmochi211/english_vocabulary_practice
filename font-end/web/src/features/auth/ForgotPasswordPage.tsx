import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ArrowLeft, BookOpen, HelpCircle, Mail, Send, X } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { ApiError } from '@/services/api/httpClient';

const forgotSchema = z.object({
  email: z.string().trim().email('Vui lòng nhập địa chỉ email hợp lệ.'),
});

export function ForgotPasswordPage() {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submittingGoogle, setSubmittingGoogle] = useState(false);
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setServerError(null);

    const parsed = forgotSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message || 'Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    setSubmittedEmail(parsed.data.email);
    setGuideModalOpen(true);
  }

  async function handleGoogleLogin() {
    setFieldError(null);
    setServerError(null);
    setSubmittingGoogle(true);
    try {
      const idToken = (import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined)
        ? 'google-oauth-id-token'
        : 'demo-google-id-token';
      await loginWithGoogle(idToken);
      setGuideModalOpen(false);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Đăng nhập Google thất bại. Vui lòng thử lại.');
      }
      setGuideModalOpen(false);
    } finally {
      setSubmittingGoogle(false);
    }
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
              Nhập email tài khoản để nhận hướng dẫn khôi phục truy cập
            </p>
          </div>
        </div>

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
            disabled={submittingGoogle}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            <span>Gửi yêu cầu khôi phục</span>
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          <span>hoặc</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={() => void handleGoogleLogin()}
          disabled={submittingGoogle}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <span>{submittingGoogle ? 'Đang đăng nhập...' : 'Đăng nhập bằng Google'}</span>
        </button>

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

      {guideModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-guide-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setGuideModalOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                  <HelpCircle className="h-5 w-5" />
                </span>
                <h2 id="forgot-guide-title" className="font-heading text-base font-extrabold text-slate-900">
                  Hướng dẫn khôi phục mật khẩu
                </h2>
              </div>
              <button
                type="button"
                aria-label="Đóng hướng dẫn"
                onClick={() => setGuideModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
              <p>
                Tính năng gửi liên kết đặt lại mật khẩu tự động cho email{' '}
                <strong className="font-semibold text-slate-900">{submittedEmail}</strong> hiện đang được
                hệ thống cập nhật.
              </p>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
                <p className="font-bold text-slate-900">Bạn có thể truy cập lại ngay bằng 2 cách:</p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4">
                  <li>
                    Chọn <strong>Đăng nhập bằng Google</strong> nếu tài khoản của bạn dùng chung địa chỉ
                    Gmail này.
                  </li>
                  <li>
                    Gửi email tới Quản trị viên tại{' '}
                    <strong className="text-indigo-700">support@lexitag.vn</strong> kèm địa chỉ email đăng ký
                    để được hỗ trợ cấp lại mật khẩu.
                  </li>
                </ol>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setGuideModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Đã hiểu
              </button>
              <button
                type="button"
                disabled={submittingGoogle}
                onClick={() => void handleGoogleLogin()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                Đăng nhập bằng Google
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
