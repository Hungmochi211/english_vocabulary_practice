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
import { mockLearnerUser } from '../mocks/handlers';

function renderApp(initialPath = '/login') {
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

describe('US1 - Authentication & Route Protection', () => {
  it('AS-1: allows a guest to register and lands on Dashboard with profile displayed', async () => {
    const user = userEvent.setup();
    renderApp('/register');

    await user.type(screen.getByLabelText(/Họ và tên/i), 'Trần Minh Anh');
    await user.type(screen.getByLabelText(/Email tài khoản/i), 'minhanh@vnua.edu.vn');
    await user.type(screen.getByLabelText(/^Mật khẩu/i), 'StrongPass123!');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu/i), 'StrongPass123!');
    await user.click(screen.getByRole('button', { name: /Đăng ký/i }));

    expect(await screen.findByRole('heading', { name: /Bảng điều khiển Trang chủ/i })).toBeInTheDocument();
    expect(screen.getAllByText('Trần Minh Anh').length).toBeGreaterThanOrEqual(1);
    expect(getStoredSession()?.accessToken).toBe('mock-access-token-register');
  });

  it('AS-2: displays clear Vietnamese error on wrong password and disabled account', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(screen.getByLabelText(/Email tài khoản/i), 'nguyenan@vnua.edu.vn');
    await user.type(screen.getByLabelText(/Mật khẩu/i), 'WrongPass');
    await user.click(screen.getByRole('button', { name: /^Đăng nhập$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không chính xác.');

    await user.clear(screen.getByLabelText(/Email tài khoản/i));
    await user.type(screen.getByLabelText(/Email tài khoản/i), 'locked@vnua.edu.vn');
    await user.click(screen.getByRole('button', { name: /^Đăng nhập$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/tạm khóa/i);
  });

  it('AS-3: allows one-tap Google OAuth login and syncs avatar/name', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await user.click(screen.getByRole('button', { name: /Đăng nhập bằng Google/i }));

    expect(await screen.findByRole('heading', { name: /Bảng điều khiển Trang chủ/i })).toBeInTheDocument();
    expect(screen.getAllByText('Nguyễn An').length).toBeGreaterThanOrEqual(1);
    expect(getStoredSession()?.user.avatarUrl).toBe('https://example.com/google-avatar.png');
  });

  it('AS-4: redirects unauthenticated visitor from /courses to /login and returns after login', async () => {
    const user = userEvent.setup();
    renderApp('/courses');

    expect(await screen.findByRole('heading', { name: /LexiTag Learning Lab/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Email tài khoản/i), 'nguyenan@vnua.edu.vn');
    await user.type(screen.getByLabelText(/Mật khẩu/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /^Đăng nhập$/i }));

    expect(await screen.findByRole('heading', { name: /Khóa học & Lộ trình học/i })).toBeInTheDocument();
  });

  it('AS-5: logs out via confirmation modal and clears persisted session', async () => {
    setStoredSession({
      accessToken: 'mock-access-learner',
      refreshToken: 'mock-refresh-learner',
      expiresInSeconds: 900,
      user: mockLearnerUser,
    });
    const user = userEvent.setup();
    renderApp('/');

    expect(await screen.findByRole('heading', { name: /Bảng điều khiển Trang chủ/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Đăng xuất/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Đăng xuất ngay/i }));

    await waitFor(() => {
      expect(getStoredSession()).toBeNull();
    });
    expect(await screen.findByRole('heading', { name: /LexiTag Learning Lab/i })).toBeInTheDocument();
  });

  it('blocks learner role from accessing /admin route directly', async () => {
    setStoredSession({
      accessToken: 'mock-access-learner',
      refreshToken: 'mock-refresh-learner',
      expiresInSeconds: 900,
      user: mockLearnerUser,
    });
    renderApp('/admin');

    expect(await screen.findByRole('heading', { name: /Bảng điều khiển Trang chủ/i })).toBeInTheDocument();
    expect(screen.queryByText(/Quản trị hệ thống/i)).not.toBeInTheDocument();
  });
});
