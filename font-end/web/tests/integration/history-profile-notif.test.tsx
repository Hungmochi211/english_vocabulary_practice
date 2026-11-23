import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAppQueryClient } from '@/app/queryClient';
import { AuthProvider } from '@/app/AuthProvider';
import { ToastProvider } from '@/components/common/CommonUi';
import { AppRoutes } from '@/app/router';
import { getStoredSession, setStoredSession } from '@/services/api/httpClient';
import { historyAdapter } from '@/services/adapters/history.adapter';
import { notificationsAdapter } from '@/services/adapters/notifications.adapter';
import { mockLearnerUser } from '../mocks/handlers';

function renderApp(initialPath = '/history') {
  setStoredSession({
    accessToken: 'mock-access-learner',
    refreshToken: 'mock-refresh-learner',
    expiresInSeconds: 900,
    user: mockLearnerUser,
  });
  const client = createAppQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('T042 - US5: History (10-row scroll & detail drawer), Profile, Change Password & Notifications', () => {
  it('records review session automatically into History & NotificationBell, opens detail drawer, and enforces .hs-list scroll box', async () => {
    // Seed 12 history items to verify 10-row scrollable container
    for (let i = 1; i <= 12; i += 1) {
      historyAdapter.record({
        type: i % 2 === 0 ? 'typing' : 'srs',
        title: `Phiên ôn tập #${i}`,
        correct: i % 2 === 0 ? 4 : 2,
        total: 5,
        accuracy: i % 2 === 0 ? 80 : 40,
        xp: 50,
        duration: '01:20',
        words: [
          { vocabularyId: 101, word: 'peaceful', phonetic: '/ˈpiːsfl/', meaning: 'yên bình', ok: true },
          { vocabularyId: 102, word: 'phone', phonetic: '/fəʊn/', meaning: 'điện thoại', ok: false },
        ],
      });
    }
    notificationsAdapter.push({
      title: 'Hoàn tất phiên ôn SM-2',
      body: 'Bạn vừa đạt 80% và nhận +50 XP.',
      icon: 'trophy',
      tone: 'green',
      targetRoute: '/history',
    });

    const user = userEvent.setup();
    renderApp('/history');

    expect(await screen.findByRole('heading', { name: /Lịch sử Học & Ôn tập/i })).toBeInTheDocument();
    const listContainer = screen.getByTestId('history-scroll-list');
    expect(listContainer).toHaveClass('hs-list');
    expect(screen.getByText('Phiên ôn tập #12')).toBeInTheDocument();

    // Open detail drawer for latest session
    await user.click(screen.getByText('Phiên ôn tập #12'));
    expect(await screen.findByText(/Chi tiết phiên hoạt động/i)).toBeInTheDocument();
    expect(screen.getByText('peaceful')).toBeInTheDocument();
    expect(screen.getByText('phone')).toBeInTheDocument();

    // Notification bell unread badge -> mark all read hides badge
    const bellBtn = screen.getByRole('button', { name: /Thông báo/i });
    expect(screen.getByTestId('notif-unread-dot')).toBeInTheDocument();
    await user.click(bellBtn);
    expect(await screen.findByText('Hoàn tất phiên ôn SM-2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Đánh dấu đã đọc tất cả/i }));
    await waitFor(() => {
      expect(screen.queryByTestId('notif-unread-dot')).not.toBeInTheDocument();
    });
  });

  it('updates Profile (fullName, targetLevel, email reminder) and redirects to /login after Change Password', async () => {
    const user = userEvent.setup();
    renderApp('/profile');

    expect(await screen.findByRole('heading', { name: /Hồ sơ Cá nhân/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Xem lịch sử học tập/i })).toHaveAttribute('href', '/history');

    const nameInput = screen.getByLabelText(/Họ và tên/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Nguyễn An Updated');
    await user.click(screen.getByRole('button', { name: /Lưu thay đổi hồ sơ/i }));

    expect(await screen.findByText(/Đã cập nhật hồ sơ thành công/i)).toBeInTheDocument();
    expect(screen.getAllByText('Nguyễn An Updated').length).toBeGreaterThanOrEqual(1);

    // Change Password
    await user.type(screen.getByLabelText(/Mật khẩu hiện tại/i), 'Password123!');
    await user.type(screen.getByLabelText(/^Mật khẩu mới$/i), 'NewStrongPass99!');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới/i), 'NewStrongPass99!');
    await user.click(screen.getByRole('button', { name: /Đổi mật khẩu/i }));

    await waitFor(() => {
      expect(getStoredSession()).toBeNull();
    });
    expect(await screen.findByRole('heading', { name: /LexiTag Learning Lab/i })).toBeInTheDocument();
  });

  it('uploads a profile avatar image, syncs preview immediately, and removes avatar cleanly', async () => {
    const user = userEvent.setup();
    renderApp('/profile');

    expect(await screen.findByRole('heading', { name: /Chỉnh sửa thông tin/i })).toBeInTheDocument();
    const removeBtn = screen.getByRole('button', { name: /Xóa ảnh/i });
    expect(removeBtn).toBeDisabled();

    // Upload valid image
    const fileInput = screen.getByLabelText(/Chọn ảnh đại diện/i);
    const pngFile = new File(['fake-png-content'], 'avatar.png', { type: 'image/png' });
    await user.upload(fileInput, pngFile);

    const previewImg = await screen.findByAltText(/Ảnh đại diện của Nguyễn An/i);
    expect(previewImg).toHaveAttribute('src', expect.stringContaining('data:image/png'));
    const uploadedSrc = getStoredSession()?.user.avatarUrl;
    expect(uploadedSrc).toContain('data:image/png');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Xóa ảnh/i })).toBeEnabled();
    });

    // Regression: changing fullName must NOT overwrite or clear the uploaded avatar
    const nameInput = screen.getByLabelText(/Họ và tên/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Nguyễn An Đổi Tên');
    await user.click(screen.getByRole('button', { name: /Lưu thay đổi hồ sơ/i }));

    expect(await screen.findByText(/Đã cập nhật hồ sơ thành công/i)).toBeInTheDocument();
    expect(getStoredSession()?.user.fullName).toBe('Nguyễn An Đổi Tên');
    expect(getStoredSession()?.user.avatarUrl).toBe(uploadedSrc);
    expect(screen.getByAltText(/Ảnh đại diện của Nguyễn An Đổi Tên/i)).toHaveAttribute(
      'src',
      uploadedSrc,
    );

    // Remove avatar
    await user.click(screen.getByRole('button', { name: /Xóa ảnh/i }));
    await waitFor(() => {
      expect(screen.queryByAltText(/Ảnh đại diện của Nguyễn An Đổi Tên/i)).not.toBeInTheDocument();
    });
    expect(getStoredSession()?.user.avatarUrl).toBeNull();
  });
});
