import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { createAppQueryClient } from '@/app/queryClient';
import { AuthProvider } from '@/app/AuthProvider';
import { ToastProvider } from '@/components/common/CommonUi';
import { AppRoutes } from '@/app/router';
import { setStoredSession } from '@/services/api/httpClient';
import { API_BASE, mockLearnerUser, setMockTotalXp } from '../mocks/handlers';
import { server } from '../mocks/server';

function renderApp(initialPath = '/') {
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

describe('T050 - US6: Weekly Leaderboard & Saved Words Custom Practice', () => {
  it('promotes current user to Rank #2 when XP exceeds 2,840, opens group modal & public quick-profile modal without leaking email/phone', async () => {
    setMockTotalXp(2910);
    const user = userEvent.setup();
    renderApp('/');

    expect(await screen.findByText(/Hạng Bạc • Rank #2 nhóm/i)).toBeInTheDocument();

    // Open full group modal
    await user.click(screen.getByRole('button', { name: /Xem toàn bộ nhóm/i }));
    const groupDialog = await screen.findByRole('dialog', { name: /Bảng xếp hạng nhóm tuần này/i });
    expect(groupDialog).toBeInTheDocument();

    // Click another member to open Quick Public Profile Modal
    await user.click(within(groupDialog).getByRole('button', { name: /Minh Khôi/i }));
    const profileDialog = await screen.findByRole('dialog', { name: /Hồ sơ công khai/i });
    expect(profileDialog).toHaveTextContent('Minh Khôi');
    expect(profileDialog).not.toHaveTextContent('@');
    expect(profileDialog).not.toHaveTextContent(/09\d{8}/);
  });

  it('saves 3 words in Dictionary and runs client_custom_practice in Review Center WITHOUT calling /reviews/session/start', async () => {
    const sm2StartSpy = vi.fn();
    server.use(
      http.post(`${API_BASE}/reviews/session/start`, () => {
        sm2StartSpy();
        return HttpResponse.json({
          success: true,
          data: { attemptId: 999, attemptType: 'sm2_review', totalQuestions: 0, questions: [] },
          error: null,
        });
      }),
    );

    const user = userEvent.setup();
    renderApp('/dictionary');

    expect(await screen.findByRole('heading', { name: /Từ điển Oxford 3000/i })).toBeInTheDocument();

    // Save 3 words: peaceful, phone, go
    const wordsToSave = ['peaceful', 'phone', 'go'];
    for (const word of wordsToSave) {
      const candidates = await screen.findAllByRole('button', {
        name: new RegExp(`^${word}\\b`, 'i'),
      });
      await user.click(candidates[0]);
      const saveBtn = await screen.findByRole('button', { name: /Lưu vào Sổ từ/i });
      await user.click(saveBtn);
    }

    // Navigate to Review Center via Sidebar
    await user.click(screen.getByRole('link', { name: /^Ôn tập$/i }));
    expect(await screen.findByRole('heading', { name: /Trung tâm Ôn tập/i })).toBeInTheDocument();

    // Start custom practice from Saved Words (3 words)
    const customBtn = await screen.findByRole('button', { name: /Ôn Sổ từ đã lưu \(3\)/i });
    await user.click(customBtn);

    // Explicit non-SM2/Streak notice visible
    expect(
      await screen.findByText(/không ảnh hưởng lịch ôn tập hay chuỗi ngày học chính thức/i),
    ).toBeInTheDocument();

    // Complete 3 custom questions locally (savedWords stores newest first: go, phone, peaceful)
    const answers = ['go', 'phone', 'peaceful'];
    for (let i = 0; i < answers.length; i += 1) {
      const input = await screen.findByLabelText(/Nhập từ tiếng Anh/i);
      await user.type(input, answers[i]);
      await user.click(
        screen.getByRole('button', { name: i < 2 ? /Câu tiếp theo/i : /Nộp bài & Chấm điểm/i }),
      );
    }

    expect(await screen.findByText(/Tổng kết phiên ôn tập/i)).toBeInTheDocument();
    expect(screen.getByText(/^100%$/)).toBeInTheDocument();
    await waitFor(() => {
      expect(sm2StartSpy).not.toHaveBeenCalled();
    });
  });
});
