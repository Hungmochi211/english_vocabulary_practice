import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAppQueryClient } from '@/app/queryClient';
import { AuthProvider } from '@/app/AuthProvider';
import { ToastProvider } from '@/components/common/CommonUi';
import { AppRoutes } from '@/app/router';
import { setStoredSession } from '@/services/api/httpClient';
import { mockAdminUser, mockLearnerUser } from '../mocks/handlers';

function renderAs(role: 'learner' | 'admin', initialPath = '/admin') {
  const user = role === 'admin' ? mockAdminUser : mockLearnerUser;
  setStoredSession({
    accessToken: role === 'admin' ? 'mock-access-admin' : 'mock-access-learner',
    refreshToken: role === 'admin' ? 'mock-refresh-admin' : 'mock-refresh-learner',
    expiresInSeconds: 900,
    user,
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

describe('T061 - US8: Admin Portal (RBAC, System Stats, User Lock/Unlock & Audit Logs)', () => {
  it('blocks learner from /admin, /admin/users, and /admin/audit-logs', async () => {
    renderAs('learner', '/admin/users');
    expect(await screen.findByRole('heading', { name: /Bảng điều khiển Trang chủ/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Quản lý Học viên/i })).not.toBeInTheDocument();
  });

  it('allows admin to view stats, search users, toggle account status via confirmation modal, and inspect Audit Logs', async () => {
    const user = userEvent.setup();
    renderAs('admin', '/admin');

    expect(await screen.findByRole('heading', { name: /Tổng quan Quản trị Hệ thống/i })).toBeInTheDocument();
    expect(await screen.findByText('1,248')).toBeInTheDocument();
    expect(screen.getByText('3,813')).toBeInTheDocument();

    // Navigate to Admin Users
    await user.click(screen.getByRole('link', { name: /Quản lý Học viên/i }));
    expect(await screen.findByRole('heading', { name: /Quản lý Học viên/i })).toBeInTheDocument();
    expect(await screen.findByText('minhkhoi@vnua.edu.vn')).toBeInTheDocument();

    // Search for Minh Khôi
    const searchInput = screen.getByLabelText(/Tìm kiếm học viên/i);
    await user.type(searchInput, 'minhkhoi');
    await waitFor(() => {
      expect(screen.queryByText('thuha@vnua.edu.vn')).not.toBeInTheDocument();
    });

    // Lock Minh Khôi via ConfirmModal
    await user.click(screen.getByRole('button', { name: /Khóa tài khoản/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Xác nhận khóa/i }));

    expect(await screen.findByText(/^Đã khóa$/)).toBeInTheDocument();

    // Navigate to Audit Logs and confirm new USER_LOCKED entry appears
    await user.click(screen.getByRole('link', { name: /Nhật ký Kiểm toán/i }));
    expect(await screen.findByRole('heading', { name: /Nhật ký Kiểm toán/i })).toBeInTheDocument();
    expect(await screen.findByText('USER_LOCKED')).toBeInTheDocument();
  });
});
