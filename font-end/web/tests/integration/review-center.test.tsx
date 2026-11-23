import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { createAppQueryClient } from '@/app/queryClient';
import { AuthProvider } from '@/app/AuthProvider';
import { ToastProvider } from '@/components/common/CommonUi';
import { AppRoutes } from '@/app/router';
import { setStoredSession } from '@/services/api/httpClient';
import { API_BASE, mockLearnerUser, setMockDueEmpty } from '../mocks/handlers';
import { server } from '../mocks/server';

function renderReviewApp(initialPath = '/review') {
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

describe('T030 - US3: Review Center, 5 Leitner Boxes, 4 Modes & Grading Parity', () => {
  it('renders 5 Leitner boxes, due count, and grades near_match, phonetic_match, and short-word incorrect accurately', async () => {
    const user = userEvent.setup();
    renderReviewApp('/review');

    expect(await screen.findByRole('heading', { name: /Trung tâm Ôn tập SM-2/i })).toBeInTheDocument();
    expect(await screen.findByText(/^3 từ đến hạn$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Hộp 1$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Hộp 5$/i)).toBeInTheDocument();

    // Select Typing mode and start official SM-2 session
    await user.click(screen.getByRole('button', { name: /Gõ từ/i }));
    await user.click(screen.getByRole('button', { name: /Bắt đầu phiên ôn SM-2/i }));

    // Q1: peaceful -> paeceful (near_match)
    const input1 = await screen.findByLabelText(/Nhập từ tiếng Anh/i);
    await user.type(input1, 'paeceful');
    await user.click(screen.getByRole('button', { name: /Câu tiếp theo/i }));

    // Q2: phone -> fone (phonetic_match)
    const input2 = await screen.findByLabelText(/Nhập từ tiếng Anh/i);
    await user.type(input2, 'fone');
    await user.click(screen.getByRole('button', { name: /Câu tiếp theo/i }));

    // Q3: go -> do (short word < 3 chars -> MUST be incorrect, NOT near_match!)
    const input3 = await screen.findByLabelText(/Nhập từ tiếng Anh/i);
    await user.type(input3, 'do');
    await user.click(screen.getByRole('button', { name: /Nộp bài & Chấm điểm/i }));

    // Verify all 3 graded labels appear on summary screen
    expect(await screen.findByText(/Tổng kết phiên ôn tập/i)).toBeInTheDocument();
    expect(screen.getByText('Gần đúng')).toBeInTheDocument();
    expect(screen.getByText('Đúng âm sai chữ')).toBeInTheDocument();
    expect(screen.getByText('Chưa chính xác')).toBeInTheDocument();

    // Verify Topbar XP updated (2450 + XP earned > 2450)
    await waitFor(() => {
      expect(screen.getByTestId('topbar-xp').textContent).not.toBe('2,450 XP');
    });
  });

  it('supports Mixed Quiz with keyboard shortcuts (1-4 & Enter) and completes submission', async () => {
    const user = userEvent.setup();
    renderReviewApp('/review');

    expect(await screen.findByRole('button', { name: /Bài kiểm tra tổng hợp/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Bài kiểm tra tổng hợp/i }));

    // Q1 is multiple_choice: press key '1' to select first option, then click next
    expect(await screen.findByText(/Câu 1/i)).toBeInTheDocument();
    await user.keyboard('1');
    await user.click(screen.getByRole('button', { name: /Câu tiếp theo/i }));

    // Answer remaining questions quickly
    for (let i = 1; i < 5; i += 1) {
      const input = screen.queryByLabelText(/Nhập từ tiếng Anh/i);
      if (input) {
        await user.type(input, 'test');
      } else {
        await user.keyboard('1');
      }
      const nextBtn = screen.queryByRole('button', { name: /Câu tiếp theo/i });
      if (nextBtn) {
        await user.click(nextBtn);
      } else {
        await user.click(screen.getByRole('button', { name: /Nộp bài & Chấm điểm/i }));
      }
    }

    expect(await screen.findByText(/Tổng kết phiên ôn tập/i)).toBeInTheDocument();
  });

  it('handles 409 ATTEMPT_ALREADY_SUBMITTED gracefully without crashing', async () => {
    server.use(
      http.post(`${API_BASE}/learning/quizzes/:attemptId/submit`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'ATTEMPT_ALREADY_SUBMITTED',
              message: 'Phiên làm bài này đã được nộp và chấm điểm trước đó.',
              details: null,
            },
          },
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderReviewApp('/review');

    await user.click(await screen.findByRole('button', { name: /Gõ từ/i }));
    await user.click(screen.getByRole('button', { name: /Bắt đầu phiên ôn SM-2/i }));

    for (let i = 0; i < 3; i += 1) {
      const input = await screen.findByLabelText(/Nhập từ tiếng Anh/i);
      await user.type(input, 'peaceful');
      await user.click(screen.getByRole('button', { name: i < 2 ? /Câu tiếp theo/i : /Nộp bài & Chấm điểm/i }));
    }

    expect(await screen.findByText(/đã được nộp và chấm điểm trước đó/i)).toBeInTheDocument();
  });

  it('shows friendly empty due reviews state with CTAs to Courses and Dictionary', async () => {
    setMockDueEmpty();
    renderReviewApp('/review');

    expect(await screen.findByText(/Hôm nay bạn không còn từ nào đến hạn/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Học bài mới/i })).toHaveAttribute('href', '/courses');
    expect(screen.getByRole('link', { name: /Tra từ Oxford 3000/i })).toHaveAttribute('href', '/dictionary');
  });
});
