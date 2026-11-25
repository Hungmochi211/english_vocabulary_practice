import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { createAppQueryClient } from '@/app/queryClient';
import { AuthProvider } from '@/app/AuthProvider';
import { ToastProvider } from '@/components/common/CommonUi';
import { AppRoutes } from '@/app/router';
import { setStoredSession } from '@/services/api/httpClient';
import { API_BASE, mockLearnerUser } from '../mocks/handlers';
import { server } from '../mocks/server';

function renderWithFreshClient(initialPath: string) {
  setStoredSession({
    accessToken: 'mock-access-learner',
    refreshToken: 'mock-refresh-learner',
    expiresInSeconds: 900,
    user: mockLearnerUser,
  });
  const client = createAppQueryClient();
  // Disable retry in error-resilience test for deterministic instant error UI
  client.setDefaultOptions({ queries: { retry: false } });
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

describe('T068 - SC-007: Error Resilience (500/503/Network Failure + Retry Recovery)', () => {
  it('renders inline ErrorRetryBox on Dashboard 503 failure and recovers upon clicking Thử lại', async () => {
    let failedOnce = false;
    server.use(
      http.get(`${API_BASE}/stats/overview`, () => {
        if (!failedOnce) {
          failedOnce = true;
          return HttpResponse.json(
            {
              success: false,
              data: null,
              error: { code: 'SERVICE_UNAVAILABLE', message: 'Hệ thống đang bảo trì.', details: null },
            },
            { status: 503 },
          );
        }
        return HttpResponse.json({
          success: true,
          data: {
            currentStreak: 7,
            longestStreak: 14,
            completedToday: false,
            totalXp: 2450,
            learnedWordsCount: 428,
            dueReviewsCount: 3,
            leitnerDistribution: { box1: 2, box2: 1, box3: 4, box4: 5, box5: 6 },
            last7Days: [],
          },
          error: null,
        });
      }),
    );

    const user = userEvent.setup();
    renderWithFreshClient('/');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    await user.click(retryBtn);

    expect(await screen.findByTestId('dashboard-xp')).toHaveTextContent('2,450 XP');
  });

  it('renders inline ErrorRetryBox on Review Center 500 error without crashing shell', async () => {
    server.use(
      http.get(`${API_BASE}/reviews/due`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: 'Lỗi máy chủ.', details: null },
          },
          { status: 500 },
        ),
      ),
    );

    renderWithFreshClient('/review');

    expect(await screen.findByRole('heading', { name: /Trung tâm Ôn tập/i })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
  });
});
