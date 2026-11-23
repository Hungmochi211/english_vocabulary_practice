import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAppQueryClient } from '@/app/queryClient';
import { AuthProvider } from '@/app/AuthProvider';
import { ToastProvider } from '@/components/common/CommonUi';
import { AppRoutes } from '@/app/router';
import { setStoredSession } from '@/services/api/httpClient';
import { mockLearnerUser } from '../mocks/handlers';

function renderApp(initialPath = '/ai-chat') {
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

describe('T055 - US7: AI Tutor v1 & Floating Admin Support Widget', () => {
  it('answers vocabulary questions in AI Tutor v1, manages multiple conversations, and navigates to Dictionary for detected words', async () => {
    const user = userEvent.setup();
    renderApp('/ai-chat');

    expect(await screen.findByRole('heading', { name: /Trợ lý AI Học Từ Vựng/i })).toBeInTheDocument();

    const input = screen.getByLabelText(/Nhập câu hỏi cho Trợ lý AI/i);
    await user.type(input, 'Cho mình ví dụ và cách dùng từ environment nhé');
    await user.click(screen.getByRole('button', { name: /Gửi câu hỏi/i }));

    expect(await screen.findByText(/môi trường/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mở "environment" trong Tra từ/i })).toBeInTheDocument();

    // Create a second conversation and verify list keeps both
    await user.click(screen.getByRole('button', { name: /Hội thoại mới/i }));
    expect(screen.getAllByTestId('ai-conversation-item').length).toBeGreaterThanOrEqual(2);

    // Switch back to previous conversation and jump to dictionary
    const convItems = screen.getAllByTestId('ai-conversation-item');
    await user.click(within(convItems[1]).getAllByRole('button')[0]);
    await user.click(await screen.findByRole('button', { name: /Mở "environment" trong Tra từ/i }));

    expect(await screen.findByRole('heading', { name: /Từ điển Oxford 3000/i })).toBeInTheDocument();
  });

  it('opens Floating Support Widget with 4 channels and pushes NotificationBell alert on Feedback submission', async () => {
    const user = userEvent.setup();
    renderApp('/');

    const fab = await screen.findByRole('button', { name: /HỖ TRỢ/i });
    await user.click(fab);

    expect(await screen.findByText(/Bạn cần hỗ trợ gì/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chat trực tiếp QTV/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Góp ý \/ Báo lỗi/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tư vấn khóa học/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cộng đồng học tập/i })).toBeInTheDocument();

    // Submit Feedback / Bug report -> pushes notification to bell
    await user.click(screen.getByRole('button', { name: /Góp ý \/ Báo lỗi/i }));
    await user.type(screen.getByLabelText(/Nội dung chi tiết/i), 'Đề xuất bổ sung thêm bài nghe chủ đề Du lịch.');
    await user.click(screen.getByRole('button', { name: /Gửi góp ý/i }));

    expect(await screen.findByText(/Đã tiếp nhận góp ý/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('notif-unread-dot')).toBeInTheDocument();
    });
  });
});
