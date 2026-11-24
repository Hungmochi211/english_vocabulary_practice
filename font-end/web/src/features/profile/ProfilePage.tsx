import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Award,
  BellRing,
  Camera,
  History,
  KeyRound,
  Save,
} from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { usersApi } from '@/services/api/users.api';
import { authApi } from '@/services/api/auth.api';
import { statsApi } from '@/services/api/stats.api';
import { ApiError } from '@/services/api/httpClient';
import {
  formatRankBadgeLabel,
  leaderboardAdapter,
} from '@/services/adapters/leaderboard.adapter';
import { localAvatarAdapter } from '@/services/adapters/avatar.adapter';
import { useToast } from '@/components/common/CommonUi';
import { LearnedWordsCard, StreakCard, XpCard } from '@/components/common/StreakCard';
import { getInitials } from '@/utils/formatters';
import type { CefrLevel } from '@/types/models';

const DAILY_GOAL_STORAGE_KEY = 'lexitag:v1:daily-goal';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function readAvatarFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh đã chọn.'));
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) {
        reject(new Error('Dữ liệu ảnh không hợp lệ.'));
        return;
      }

      if (
        typeof document === 'undefined' ||
        typeof Image === 'undefined' ||
        /jsdom/i.test(navigator.userAgent)
      ) {
        resolve(rawDataUrl);
        return;
      }

      let settled = false;
      const done = (val: string) => {
        if (settled) return;
        settled = true;
        resolve(val);
      };
      const fallbackTimer = window.setTimeout(() => done(rawDataUrl), 400);

      const img = new Image();
      img.onload = () => {
        window.clearTimeout(fallbackTimer);
        try {
          const size = 256;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx || !img.width || !img.height) {
            done(rawDataUrl);
            return;
          }
          const minEdge = Math.min(img.width, img.height);
          const sx = (img.width - minEdge) / 2;
          const sy = (img.height - minEdge) / 2;
          ctx.drawImage(img, sx, sy, minEdge, minEdge, 0, 0, size, size);
          done(canvas.toDataURL('image/jpeg', 0.86));
        } catch {
          done(rawDataUrl);
        }
      };
      img.onerror = () => {
        window.clearTimeout(fallbackTimer);
        done(rawDataUrl);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function ProfilePage() {
  const { user, updateLocalUser, clearLocalSession } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    () => localAvatarAdapter.get(user?.id) ?? user?.avatarUrl ?? null,
  );
  const [processingAvatar, setProcessingAvatar] = useState(false);
  const [targetLevel, setTargetLevel] = useState<CefrLevel>(user?.targetLevel ?? 'B2');
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(
    user?.emailReminderEnabled ?? true,
  );
  const dirtyRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    try {
      const saved = Number(window.localStorage.getItem(DAILY_GOAL_STORAGE_KEY));
      return saved >= 5 && saved <= 100 ? saved : 15;
    } catch {
      return 15;
    }
  });
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => usersApi.getMe(),
  });

  const overviewQuery = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: () => statsApi.getOverview(),
  });

  useEffect(() => {
    if (meQuery.data && !dirtyRef.current) {
      setFullName(meQuery.data.fullName);
      const localSaved = localAvatarAdapter.get(user?.id ?? meQuery.data.id);
      if (localSaved) {
        setAvatarUrl(localSaved);
      } else if (meQuery.data.avatarUrl) {
        setAvatarUrl(meQuery.data.avatarUrl);
      }
      setTargetLevel(meQuery.data.targetLevel);
      setEmailReminderEnabled(meQuery.data.emailReminderEnabled);
    }
  }, [meQuery.data, user?.id]);

  const leaderboardQuery = useQuery({
    queryKey: [
      'leaderboard',
      'weekly',
      user?.fullName,
      user?.targetLevel,
      overviewQuery.data?.totalXp ?? 0,
      overviewQuery.data?.currentStreak ?? 0,
    ],
    queryFn: () =>
      leaderboardAdapter.getWeeklyGroupLeaderboard({
        fullName: user?.fullName ?? 'Học viên',
        avatarUrl: user?.avatarUrl ?? null,
        targetLevel: user?.targetLevel ?? 'B2',
        totalXp: overviewQuery.data?.totalXp ?? 0,
        currentStreak: overviewQuery.data?.currentStreak ?? 0,
      }),
    enabled: Boolean(overviewQuery.data),
  });

  const myRank = leaderboardQuery.data?.find((m) => m.isCurrentUser)?.rank;

  const updateProfileMutation = useMutation({
    mutationFn: () =>
      usersApi.updateMe({
        fullName: fullName.trim(),
        targetLevel,
        emailReminderEnabled,
      }),
    onSuccess: (updated) => {
      try {
        window.localStorage.setItem(DAILY_GOAL_STORAGE_KEY, String(dailyGoal));
      } catch {
        // ignore
      }
      updateLocalUser({
        fullName: updated.fullName,
        targetLevel: updated.targetLevel,
        emailReminderEnabled: updated.emailReminderEnabled,
      });
      void queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      setProfileError(null);
      setProfileMessage('Đã cập nhật hồ sơ thành công!');
      showToast('Đã lưu thay đổi hồ sơ cá nhân.', 'success');
    },
    onError: (err) => {
      setProfileMessage(null);
      setProfileError(err instanceof ApiError ? err.message : 'Không thể cập nhật hồ sơ.');
    },
  });

  const removeAvatarMutation = useMutation({
    mutationFn: () => usersApi.updateMe({ avatarUrl: null }),
    onSuccess: () => {
      if (user?.id !== undefined) {
        localAvatarAdapter.remove(user.id);
      }
      setAvatarUrl(null);
      updateLocalUser({ avatarUrl: null });
      void queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      setProfileError(null);
      showToast('Đã xóa ảnh đại diện.', 'info');
    },
    onError: (err) => {
      setProfileError(
        err instanceof ApiError ? err.message : 'Không thể xóa ảnh đại diện lúc này.',
      );
    },
  });

  const isAvatarPending = processingAvatar || removeAvatarMutation.isPending;

  async function handleAvatarFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileError('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP, GIF).');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setProfileError('Dung lượng ảnh tối đa là 5 MB. Vui lòng chọn ảnh nhỏ hơn.');
      return;
    }

    setProcessingAvatar(true);
    try {
      dirtyRef.current = true;
      const dataUrl = await readAvatarFileAsDataUrl(file);
      if (user?.id !== undefined) {
        localAvatarAdapter.set(user.id, dataUrl);
      }
      setAvatarUrl(dataUrl);
      updateLocalUser({ avatarUrl: dataUrl });
      setProfileError(null);
      showToast('Đã cập nhật ảnh đại diện thành công!', 'success');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Không thể xử lý ảnh đại diện.');
    } finally {
      setProcessingAvatar(false);
    }
  }

  function handleRemoveAvatar() {
    if (!avatarUrl && !user?.avatarUrl) return;
    dirtyRef.current = true;
    removeAvatarMutation.mutate();
  }

  const changePasswordMutation = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      showToast('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.', 'success');
      clearLocalSession();
      navigate('/login?reason=password_changed', { replace: true });
    },
    onError: (err) => {
      setPasswordError(
        err instanceof ApiError ? err.message : 'Không thể đổi mật khẩu lúc này.',
      );
    },
  });

  function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setProfileError('Họ và tên không được để trống.');
      return;
    }
    setProfileError(null);
    updateProfileMutation.mutate();
  }

  function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword.length < 8 || newPassword.length > 72) {
      setPasswordError('Mật khẩu mới phải từ 8 đến 72 ký tự.');
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError('Mật khẩu mới phải chứa ít nhất 1 chữ cái và 1 chữ số.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Xác nhận mật khẩu mới chưa khớp.');
      return;
    }
    changePasswordMutation.mutate();
  }

  const displayName = user?.fullName || 'Học viên';

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-900 font-heading text-xl font-extrabold text-white">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <span>{getInitials(displayName)}</span>
            )}
          </div>
          <div>
            <h1 className="font-heading text-2xl font-extrabold text-slate-900">Hồ sơ Cá nhân</h1>
            <p className="text-sm font-semibold text-slate-700">{displayName}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
                Mục tiêu {user?.targetLevel ?? 'B2'}
              </span>
              {myRank && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                  <Award className="h-3.5 w-3.5" />
                  <span>{formatRankBadgeLabel(myRank)}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <Link
          to="/history"
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-800 transition hover:bg-slate-100 sm:self-auto"
        >
          <History className="h-4 w-4 text-indigo-600" />
          <span>Xem lịch sử học tập</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* Compact Stats Row */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StreakCard
          currentStreak={overviewQuery.data?.currentStreak ?? 0}
          longestStreak={overviewQuery.data?.longestStreak ?? 0}
        />
        <XpCard
          totalXp={overviewQuery.data?.totalXp ?? 0}
          subtitle={myRank ? formatRankBadgeLabel(myRank) : 'Điểm kinh nghiệm tích lũy'}
        />
        <LearnedWordsCard learnedWordsCount={overviewQuery.data?.learnedWordsCount ?? 0} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Edit Profile Form */}
        <form
          onSubmit={handleSaveProfile}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs"
        >
          <h2 className="font-heading text-lg font-extrabold text-slate-900">
            Chỉnh sửa thông tin
          </h2>

          {/* Avatar Upload & Remove Card */}
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-900 font-heading text-2xl font-extrabold text-white shadow-xs">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`Ảnh đại diện của ${displayName}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{getInitials(displayName)}</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-base font-extrabold text-slate-900">
                {displayName}
              </p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  aria-label="Chọn ảnh đại diện"
                  onChange={(e) => void handleAvatarFileChange(e)}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isAvatarPending}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Camera className="h-4 w-4 text-slate-700" />
                  <span>{processingAvatar ? 'Đang xử lý...' : 'Tải ảnh lên'}</span>
                </button>
                <button
                  type="button"
                  disabled={isAvatarPending || !avatarUrl}
                  onClick={handleRemoveAvatar}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span>Xóa ảnh</span>
                </button>
              </div>
            </div>
          </div>

          {profileMessage && (
            <p
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800"
            >
              {profileMessage}
            </p>
          )}
          {profileError && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-800"
            >
              {profileError}
            </p>
          )}

          <div>
            <label htmlFor="profile-fullname" className="mb-1 block text-xs font-bold text-slate-700">
              Họ và tên
            </label>
            <input
              id="profile-fullname"
              type="text"
              value={fullName}
              onChange={(e) => {
                dirtyRef.current = true;
                setFullName(e.target.value);
              }}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="profile-cefr" className="mb-1 block text-xs font-bold text-slate-700">
                Mục tiêu CEFR
              </label>
              <select
                id="profile-cefr"
                value={targetLevel}
                onChange={(e) => setTargetLevel(e.target.value as CefrLevel)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500"
              >
                <option value="A1">A1 — Cơ bản</option>
                <option value="A2">A2 — Sơ cấp</option>
                <option value="B1">B1 — Trung cấp</option>
                <option value="B2">B2 — Trung cao cấp</option>
              </select>
            </div>
            <div>
              <label htmlFor="profile-goal" className="mb-1 block text-xs font-bold text-slate-700">
                Mục tiêu từ / ngày
              </label>
              <input
                id="profile-goal"
                type="number"
                min={5}
                max={100}
                value={dailyGoal}
                onChange={(e) => setDailyGoal(Number(e.target.value) || 15)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <BellRing className="h-4 w-4 text-amber-600" />
              <span>Gửi email nhắc ôn tập lúc 20:00 mỗi ngày</span>
            </span>
            <input
              type="checkbox"
              checked={emailReminderEnabled}
              onChange={(e) => setEmailReminderEnabled(e.target.checked)}
              className="h-4 w-4 accent-indigo-600"
            />
          </label>

          <button
            type="submit"
            disabled={updateProfileMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            <span>
              {updateProfileMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi hồ sơ'}
            </span>
          </button>
        </form>

        {/* Change Password Form */}
        <form
          onSubmit={handleChangePassword}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-slate-700" />
            <h2 className="font-heading text-lg font-extrabold text-slate-900">
              Bảo mật & Đổi mật khẩu
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Sau khi đổi mật khẩu thành công, toàn bộ phiên đăng nhập hiện tại sẽ được thu hồi để đảm bảo an toàn.
          </p>

          {passwordError && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-800"
            >
              {passwordError}
            </p>
          )}

          <div>
            <label htmlFor="current-password" className="mb-1 block text-xs font-bold text-slate-700">
              Mật khẩu hiện tại
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="new-password" className="mb-1 block text-xs font-bold text-slate-700">
              Mật khẩu mới
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="confirm-new-password" className="mb-1 block text-xs font-bold text-slate-700">
              Xác nhận mật khẩu mới
            </label>
            <input
              id="confirm-new-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={changePasswordMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <span>{changePasswordMutation.isPending ? 'Đang cập nhật...' : 'Đổi mật khẩu'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
