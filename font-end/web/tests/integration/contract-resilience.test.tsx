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
import { ApiError, httpClient, setStoredSession } from '@/services/api/httpClient';
import { vocabularyApi } from '@/services/api/vocabulary.api';
import { reviewApi } from '@/services/api/review.api';
import { historyAdapter } from '@/services/adapters/history.adapter';
import { savedWordsAdapter } from '@/services/adapters/savedWords.adapter';
import { API_BASE, mockAdminUser, mockLearnerUser, mockVocabularies } from '../mocks/handlers';
import { server } from '../mocks/server';
import type { UserProfile } from '@/types/models';

function renderApp(initialPath: string, user: UserProfile | null = mockLearnerUser) {
  if (user) {
    setStoredSession({
      accessToken: user.role === 'admin' ? 'mock-access-admin' : 'mock-access-learner',
      refreshToken: user.role === 'admin' ? 'mock-refresh-admin' : 'mock-refresh-learner',
      expiresInSeconds: 900,
      user,
    });
  }
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

describe('Frontend/Web Audit Regression Suite (001/002 Contract & Security Fixes)', () => {
  it('normalizes 001 nested GET /lessons/:id and array GET /vocabularies/search (clamping limit <= 50 and tolerating empty q 400)', async () => {
    let seenLimit: string | null = null;
    server.use(
      http.get(`${API_BASE}/lessons/:id`, () =>
        HttpResponse.json({
          success: true,
          data: {
            lesson: {
              id: 1,
              topicId: 1,
              topicNameVi: 'Đời sống hằng ngày',
              cefrLevel: 'A1',
              title: 'Lesson 1 - Daily Life',
              orderIndex: 1,
              wordCount: 2,
            },
            vocabularies: mockVocabularies.slice(0, 2),
          },
          error: null,
        }),
      ),
      http.get(`${API_BASE}/vocabularies/search`, ({ request }) => {
        const url = new URL(request.url);
        seenLimit = url.searchParams.get('limit');
        if (!url.searchParams.get('q')) {
          return HttpResponse.json(
            {
              success: false,
              data: null,
              error: { code: 'VALIDATION_ERROR', message: 'q is required', details: null },
            },
            { status: 400 },
          );
        }
        return HttpResponse.json({
          success: true,
          data: [mockVocabularies[6]],
          error: null,
        });
      }),
    );

    const detail = await vocabularyApi.getLessonDetail(1);
    expect(detail.title).toBe('Lesson 1 - Daily Life');
    expect(detail.topicName).toBe('Đời sống hằng ngày');
    expect(detail.vocabularies).toHaveLength(2);

    const emptyBrowse = await vocabularyApi.searchVocabularies({ limit: 100 });
    expect(seenLimit).toBe('50');
    expect(emptyBrowse.items).toEqual([]);

    const searched = await vocabularyApi.searchVocabularies({ q: 'env', limit: 20 });
    expect(searched.items).toHaveLength(1);
    expect(searched.items[0].word).toBe('environment');
  });

  it('normalizes 002 GET /reviews/due returning totalDue instead of dueCount', async () => {
    server.use(
      http.get(`${API_BASE}/reviews/due`, () =>
        HttpResponse.json({
          success: true,
          data: {
            totalDue: 4,
            items: [],
          },
          error: null,
        }),
      ),
    );

    const due = await reviewApi.getDueReviews();
    expect(due.dueCount).toBe(4);
    expect(due.leitnerDistribution).toBeUndefined();
  });

  it('handles 002 EmptySuccessResponse (data: null) on PATCH /admin/users/:id/status without crashing', async () => {
    server.use(
      http.patch(`${API_BASE}/admin/users/:userId/status`, () =>
        HttpResponse.json({
          success: true,
          data: null,
          error: null,
        }),
      ),
    );

    const user = userEvent.setup();
    renderApp('/admin/users', mockAdminUser);

    expect(await screen.findByText('minhkhoi@vnua.edu.vn')).toBeInTheDocument();
    const lockButtons = screen.getAllByRole('button', { name: /Khóa tài khoản/i });
    await user.click(lockButtons[0]);
    await user.click(screen.getByRole('button', { name: /Xác nhận khóa/i }));

    expect(await screen.findByText(/Đã khóa tài khoản/i)).toBeInTheDocument();
  });

  it('enforces 002 password letter+digit rule on RegisterPage and blocks open redirect + shows reason banners on LoginPage', async () => {
    const user = userEvent.setup();
    const { unmount } = renderApp('/register', null);

    await user.type(screen.getByLabelText(/Họ và tên/i), 'Test User');
    await user.type(screen.getByLabelText(/Email tài khoản/i), 'test@vnua.edu.vn');
    await user.type(screen.getByLabelText(/^Mật khẩu/i), 'onlyletters');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu/i), 'onlyletters');
    await user.click(screen.getByRole('button', { name: /Đăng ký/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/1 chữ cái và 1 chữ số/i);
    unmount();

    // Open redirect attempt + password_changed banner
    renderApp('/login?redirect=//evil.example.com&reason=password_changed', null);
    expect(await screen.findByRole('status')).toHaveTextContent(/Đổi mật khẩu thành công/i);

    await user.type(screen.getByLabelText(/Email tài khoản/i), 'nguyenan@vnua.edu.vn');
    await user.type(screen.getByLabelText(/Mật khẩu/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /^Đăng nhập$/i }));

    // Should safely land on Dashboard (/), NOT //evil.example.com
    expect(await screen.findByRole('heading', { name: /Bảng điều khiển Trang chủ/i })).toBeInTheDocument();
  });

  it('syncs custom daily word goal from localStorage, shows ?denied=admin alert, and isolates local data on account switch', async () => {
    window.localStorage.setItem('lexitag:v1:daily-goal', '25');
    historyAdapter.record({
      type: 'typing',
      title: 'Private Learner Session',
      correct: 3,
      total: 3,
      accuracy: 100,
      xp: 40,
      duration: '00:50',
      words: [],
    });
    // Deliberately omit lexitag:v1:active-user-id to simulate upgrading from an older version
    window.localStorage.removeItem('lexitag:v1:active-user-id');

    const { unmount } = renderApp('/admin', mockLearnerUser);
    expect(await screen.findByRole('heading', { name: /Bảng điều khiển Trang chủ/i })).toBeInTheDocument();
    expect(await screen.findByText(/8 \/ 25 từ/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/không có quyền truy cập/i);
    unmount();

    // Switch to Admin account -> previous learner's local history is wiped cleanly
    setStoredSession(null);
    const user = userEvent.setup();
    renderApp('/login', null);
    await user.type(screen.getByLabelText(/Email tài khoản/i), mockAdminUser.email);
    await user.type(screen.getByLabelText(/Mật khẩu/i), 'Admin1234!');
    await user.click(screen.getByRole('button', { name: /^Đăng nhập$/i }));

    await waitFor(() => {
      expect(historyAdapter.list()).toHaveLength(0);
    });
  });

  it('maps raw HTTP 429 response without body error into friendly Vietnamese rate-limit message', async () => {
    server.use(
      http.get(`${API_BASE}/stats/overview`, () => new HttpResponse(null, { status: 429 })),
    );

    await expect(httpClient.get('/stats/overview')).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: expect.stringContaining('quá nhanh'),
    } satisfies Partial<ApiError>);
  });

  it('shows error state on invalid /courses/abc/practice instead of infinite loading and displays Saved Words when empty search returns 400', async () => {
    const { unmount } = renderApp('/courses/abc/practice', mockLearnerUser);
    expect(await screen.findByText(/Mã bài học không hợp lệ/i)).toBeInTheDocument();
    unmount();

    savedWordsAdapter.toggle(mockVocabularies[0]);
    server.use(
      http.get(`${API_BASE}/vocabularies/search`, ({ request }) => {
        const url = new URL(request.url);
        if (!url.searchParams.get('q')) {
          return HttpResponse.json(
            {
              success: false,
              data: null,
              error: { code: 'VALIDATION_ERROR', message: 'q is required', details: null },
            },
            { status: 400 },
          );
        }
        return HttpResponse.json({ success: true, data: [], error: null });
      }),
    );

    const user = userEvent.setup();
    renderApp('/dictionary', mockLearnerUser);
    await user.click(await screen.findByRole('button', { name: /Sổ từ đã lưu \(1\)/i }));
    expect(await screen.findByRole('heading', { name: /^peaceful$/i })).toBeInTheDocument();
  });

  it('shows Step 1 return CTA on 403 ACQUISITION_REQUIRED and locks submit with retry CTA on 409 ATTEMPT_ALREADY_SUBMITTED', async () => {
    const { unmount } = renderApp('/courses/1/practice', mockLearnerUser);
    expect(await screen.findByRole('link', { name: /Quay về Bước 1 để mở đủ thẻ/i })).toBeInTheDocument();
    unmount();

    server.use(
      http.post(`${API_BASE}/learning/lessons/1/practice/start`, () =>
        HttpResponse.json({
          success: true,
          data: {
            attemptId: 901,
            origin: 'server_official',
            lessonId: 1,
            totalQuestions: 1,
            questions: [
              {
                vocabularyId: 1,
                practiceMode: 'typing',
                prompt: {
                  vietnameseMeaning: 'yên bình',
                  partOfSpeech: 'adjective',
                },
              },
            ],
          },
          error: null,
        }),
      ),
      http.post(`${API_BASE}/learning/quizzes/901/submit`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'ATTEMPT_ALREADY_SUBMITTED',
              message: 'Lượt làm bài này đã được nộp trước đó.',
              details: null,
            },
          },
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderApp('/courses/1/practice', mockLearnerUser);
    await user.type(await screen.findByPlaceholderText(/Gõ từ vựng tương ứng/i), 'peaceful');
    await user.click(screen.getByRole('button', { name: /Nộp bài & Chấm điểm/i }));

    expect(await screen.findByText(/Lượt làm bài này đã được nộp trước đó/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lượt làm bài đã được nộp/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Bắt đầu lượt thực hành mới/i })).toBeInTheDocument();
  });

  it('uses /stats/overview Leitner distribution when /reviews/due omits it, renders 4-choice Quiz mode, and resets hints across questions', async () => {
    server.use(
      http.get(`${API_BASE}/reviews/due`, () =>
        HttpResponse.json({
          success: true,
          data: {
            totalDue: 2,
            items: [
              {
                vocabularyId: 1,
                word: 'peaceful',
                phonetic: '/ˈpiːsfəl/',
                partOfSpeech: 'adjective',
                cefrLevel: 'B1',
                vietnameseMeaning: 'yên bình',
                exampleEn: 'It is a peaceful village.',
                exampleVi: 'Đó là một ngôi làng yên bình.',
                leitnerBox: 1,
                nextReviewDate: '2026-11-24',
                easinessFactor: 2.5,
                repetitions: 0,
              },
              {
                vocabularyId: 2,
                word: 'recycle',
                phonetic: '/ˌriːˈsaɪkəl/',
                partOfSpeech: 'verb',
                cefrLevel: 'B1',
                vietnameseMeaning: 'tái chế',
                exampleEn: 'We recycle plastic bottles.',
                exampleVi: 'Chúng tôi tái chế chai nhựa.',
                leitnerBox: 2,
                nextReviewDate: '2026-11-24',
                easinessFactor: 2.5,
                repetitions: 1,
              },
            ],
          },
          error: null,
        }),
      ),
      http.post(`${API_BASE}/reviews/session/start`, () =>
        HttpResponse.json({
          success: true,
          data: {
            attemptId: 902,
            attemptType: 'sm2_review',
            totalQuestions: 2,
            questions: [
              {
                vocabularyId: 1,
                practiceMode: 'typing',
                prompt: {
                  vietnameseMeaning: 'yên bình',
                  partOfSpeech: 'adjective',
                },
              },
              {
                vocabularyId: 2,
                practiceMode: 'typing',
                prompt: {
                  vietnameseMeaning: 'tái chế',
                  partOfSpeech: 'verb',
                },
              },
            ],
          },
          error: null,
        }),
      ),
    );

    const user = userEvent.setup();
    renderApp('/review', mockLearnerUser);

    // Leitner chart must read real distribution from /stats/overview (not all 0s)
    expect(await screen.findByText(/^2 từ đến hạn$/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/Hộp 1/i)).length).toBeGreaterThan(0);
    expect(screen.queryAllByText('0').length).toBeLessThan(5);

    // Select Quiz mode and start SM-2 session -> must render 4-choice Quiz stage, NOT Typing
    await user.click(screen.getByRole('button', { name: /Trắc nghiệm/i }));
    await user.click(screen.getByRole('button', { name: /Bắt đầu phiên ôn SM-2/i }));
    expect(await screen.findByText(/Trắc nghiệm 4 đáp án/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /peaceful/i })).toBeInTheDocument();
  });
});
