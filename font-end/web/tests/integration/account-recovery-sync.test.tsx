import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAppQueryClient } from '@/app/queryClient';
import { AuthProvider } from '@/app/AuthProvider';
import { ThemeProvider } from '@/app/ThemeProvider';
import { ToastProvider } from '@/components/common/CommonUi';
import { AppRoutes } from '@/app/router';
import { setStoredSession } from '@/services/api/httpClient';
import { historyAdapter } from '@/services/adapters/history.adapter';
import { getMockPasswordResetOtp, mockLearnerUser } from '../mocks/handlers';

function renderApp(initialPath = '/forgot-password') {
  const client = createAppQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('Account Recovery & Server Sync Suite (002/004 Upgrade)', () => {
  it('Wave 2 (US6-AS2 / FR-001): requests 6-digit OTP, rejects wrong OTP, and resets password with valid OTP', async () => {
    const user = userEvent.setup();
    renderApp('/forgot-password');

    await user.type(screen.getByLabelText(/Email tài khoản đã đăng ký/i), 'nguyenan@vnua.edu.vn');
    await user.click(screen.getByRole('button', { name: /Gửi mã OTP khôi phục/i }));

    expect(await screen.findByLabelText(/Mã OTP 6 chữ số/i)).toBeInTheDocument();
    const issuedOtp = getMockPasswordResetOtp('nguyenan@vnua.edu.vn');
    expect(issuedOtp).toBe('654321');

    // Wrong OTP displays Vietnamese server error without crashing
    await user.type(screen.getByLabelText(/Mã OTP 6 chữ số/i), '111111');
    await user.type(screen.getByLabelText(/^Mật khẩu mới$/i), 'ValidPass99');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới/i), 'ValidPass99');
    await user.click(screen.getByRole('button', { name: /Xác nhận đặt lại mật khẩu/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Mã OTP không chính xác/i);

    // Correct OTP succeeds and redirects to /login?reason=password_reset
    await user.clear(screen.getByLabelText(/Mã OTP 6 chữ số/i));
    await user.type(screen.getByLabelText(/Mã OTP 6 chữ số/i), issuedOtp!);
    await user.click(screen.getByRole('button', { name: /Xác nhận đặt lại mật khẩu/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Đặt lại mật khẩu thành công/i);
  });

  it('Wave 3 (US6-AS3 / FR-017): restores submitted learning history and word breakdown from server after clearing localStorage', async () => {
    setStoredSession({
      accessToken: 'mock-access-learner',
      refreshToken: 'mock-refresh-learner',
      expiresInSeconds: 900,
      user: mockLearnerUser,
    });

    const user = userEvent.setup();
    const { unmount } = renderApp('/review');

    // Start & submit an official SM-2 review session
    await user.click(await screen.findByRole('button', { name: /Gõ từ/i }));
    await user.click(screen.getByRole('button', { name: /Bắt đầu ôn tập/i }));

    const answers = ['peaceful', 'phone', 'go'];
    for (let i = 0; i < answers.length; i++) {
      const input = await screen.findByLabelText(/Nhập từ tiếng Anh/i);
      await user.clear(input);
      await user.type(input, answers[i]);
      await user.click(
        screen.getByRole('button', { name: i < 2 ? /Tiếp theo/i : /Nộp bài & Chấm điểm/i }),
      );
    }
    expect(await screen.findByText(/Tổng kết phiên ôn tập/i)).toBeInTheDocument();
    unmount();

    // Simulate switching browser / wiping local history storage
    historyAdapter.clear();
    expect(historyAdapter.list()).toHaveLength(0);

    // Open /history -> session and word breakdown are fetched from GET /learning/history
    renderApp('/history');
    const row = await screen.findByText(/Phiên ôn tập SM-2 chính thức/i);
    expect(row).toBeInTheDocument();

    await user.click(row);
    expect(await screen.findByText('peaceful')).toBeInTheDocument();
  });
});
