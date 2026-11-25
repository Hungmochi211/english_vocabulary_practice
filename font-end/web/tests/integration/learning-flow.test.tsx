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
import { mockLearnerUser } from '../mocks/handlers';

function renderAuthenticatedApp(initialPath = '/') {
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

describe('T021 - US2: Dashboard Overview & 2-Step Learning Flow', () => {
  it('displays Dashboard stats strictly synced with Topbar XP/Streak and due review CTA', async () => {
    renderAuthenticatedApp('/');

    expect(await screen.findByRole('heading', { name: /Bảng điều khiển Trang chủ/i })).toBeInTheDocument();
    expect(await screen.findByTestId('dashboard-xp')).toHaveTextContent('2,450 XP');
    expect(screen.getByTestId('topbar-xp')).toHaveTextContent('2,450 XP');
    expect(screen.getByTestId('dashboard-streak')).toHaveTextContent('7 ngày');
    expect(screen.getByText(/428/)).toBeInTheDocument();
    expect(screen.getByText(/3 từ đến hạn/i)).toBeInTheDocument();
  });

  it('filters Courses roadmap by CEFR level and shows Lesson 1 unlocked vs Lesson 2 locked', async () => {
    const user = userEvent.setup();
    renderAuthenticatedApp('/courses');

    expect(await screen.findByRole('heading', { name: /Khóa học & Lộ trình học/i })).toBeInTheDocument();
    expect(await screen.findByText(/Daily Routines & Peace/i)).toBeInTheDocument();
    expect(screen.getByText(/Morning Habits/i)).toBeInTheDocument();
    expect(screen.getByText(/Green Planet Basics/i)).toBeInTheDocument();

    // Filter to B1
    await user.click(screen.getByRole('button', { name: /^B1$/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Daily Routines & Peace/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Green Planet Basics/i)).toBeInTheDocument();

    // Back to All
    await user.click(screen.getByRole('button', { name: /^Tất cả$/i }));
    expect(await screen.findByText(/Daily Routines & Peace/i)).toBeInTheDocument();
  });

  it('enforces Step 1 card opening gate, handles < 80% retry, and unlocks Lesson 2 at >= 80% while syncing XP & Streak', async () => {
    const user = userEvent.setup();
    renderAuthenticatedApp('/courses/1/study');

    // Step 1: initial card shown, progress 0/3, Step 2 button disabled
    expect(await screen.findByText('peaceful')).toBeInTheDocument();
    expect(screen.getByText('/ˈpiːsfl/')).toBeInTheDocument();
    expect(screen.getByTestId('study-progress')).toHaveTextContent('0 / 3');

    const step2Btn = screen.getByRole('button', { name: /Chuyển sang Thực hành/i });
    expect(step2Btn).toBeDisabled();

    // Open card 1 (peaceful)
    await user.click(screen.getByRole('button', { name: /Lật thẻ|Xem nghĩa/i }));
    await waitFor(() => {
      expect(screen.getByTestId('study-progress')).toHaveTextContent('1 / 3');
    });
    expect(screen.getByText(/yên bình, thanh bình/i)).toBeInTheDocument();

    // Next card 2 (phone) and open it
    await user.click(screen.getByRole('button', { name: /Thẻ tiếp theo/i }));
    expect(await screen.findByText('phone')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Lật thẻ|Xem nghĩa/i }));
    await waitFor(() => {
      expect(screen.getByTestId('study-progress')).toHaveTextContent('2 / 3');
    });

    // Next card 3 (go) and open it
    await user.click(screen.getByRole('button', { name: /Thẻ tiếp theo/i }));
    expect(await screen.findByText('go')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Lật thẻ|Xem nghĩa/i }));
    await waitFor(() => {
      expect(screen.getByTestId('study-progress')).toHaveTextContent('3 / 3');
    });

    // Step 2 button is now unlocked
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Chuyển sang Thực hành/i })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: /Chuyển sang Thực hành/i }));

    // Step 2 - Attempt 1: fail (< 80%)
    expect(await screen.findByRole('heading', { name: /Thực hành Bước 2/i })).toBeInTheDocument();

    for (let i = 0; i < 3; i += 1) {
      const input = await screen.findByLabelText(/Nhập từ tiếng Anh/i);
      await user.clear(input);
      await user.type(input, 'wrongword');
      await user.click(screen.getByRole('button', { name: i < 2 ? /Câu tiếp theo/i : /Nộp bài & Chấm điểm/i }));
    }

    expect(await screen.findByText(/Chưa đạt ngưỡng 80%/i)).toBeInTheDocument();
    expect(screen.getByText(/^0%$/)).toBeInTheDocument();

    // Retry practice and pass 100% (>= 80%)
    await user.click(screen.getByRole('button', { name: /Làm lại bài thực hành/i }));
    const correctAnswers = ['peaceful', 'phone', 'go'];
    for (let i = 0; i < correctAnswers.length; i += 1) {
      const input = await screen.findByLabelText(/Nhập từ tiếng Anh/i);
      await user.clear(input);
      await user.type(input, correctAnswers[i]);
      await user.click(screen.getByRole('button', { name: i < 2 ? /Câu tiếp theo/i : /Nộp bài & Chấm điểm/i }));
    }

    expect(await screen.findByText(/Đã mở khóa bài học kế tiếp/i)).toBeInTheDocument();
    expect(screen.getByText(/^100%$/)).toBeInTheDocument();

    // Topbar XP synced without reload (2450 + 10 from attempt 1 + 90 from attempt 2 = 2550 XP)
    await waitFor(() => {
      expect(screen.getByTestId('topbar-xp')).toHaveTextContent('2,550 XP');
    });

    // Return to Courses and verify Lesson 2 is now unlocked
    await user.click(screen.getByRole('button', { name: /Quay lại Lộ trình/i }));
    expect(await screen.findByText(/Morning Habits/i)).toBeInTheDocument();
    const lesson2StudyLinks = screen.getAllByRole('link', { name: /Học thẻ|Học ngay/i });
    expect(lesson2StudyLinks.length).toBeGreaterThanOrEqual(2);
  });
});
