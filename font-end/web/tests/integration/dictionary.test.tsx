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

function renderDictionaryApp(initialPath = '/dictionary') {
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

describe('T038 - US4: Oxford 3000 Dictionary Search, Filters & Spelling Suggestions', () => {
  it('supports diacritic-insensitive Vietnamese search (moi truong -> environment) and shows highlighted detail panel', async () => {
    const user = userEvent.setup();
    renderDictionaryApp('/dictionary');

    expect(await screen.findByRole('heading', { name: /Từ điển Oxford 3000/i })).toBeInTheDocument();

    const searchBox = screen.getByLabelText(/Tìm kiếm từ điển/i);
    await user.type(searchBox, 'moi truong');

    expect(await screen.findByRole('heading', { name: /^environment$/i })).toBeInTheDocument();
    expect(screen.getByText('/ɪnˈvaɪrənmənt/')).toBeInTheDocument();
    expect(screen.getByText(/Mọi người đều nên góp phần bảo vệ môi trường/i)).toBeInTheDocument();
  });

  it('filters by CEFR level and part of speech and shows Levenshtein spelling suggestion for enviroment', async () => {
    const user = userEvent.setup();
    renderDictionaryApp('/dictionary');

    expect(await screen.findByRole('heading', { name: /Từ điển Oxford 3000/i })).toBeInTheDocument();

    // Filter B1
    await user.click(screen.getByRole('button', { name: /^B1$/i }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /peaceful/i })).not.toBeInTheDocument();
    });
    expect(await screen.findByRole('button', { name: /environment/i })).toBeInTheDocument();

    // Reset filter and type misspelled query "enviroment"
    await user.click(screen.getByRole('button', { name: /^Tất cả$/i }));
    const searchBox = screen.getByLabelText(/Tìm kiếm từ điển/i);
    await user.clear(searchBox);
    await user.type(searchBox, 'enviroment');

    expect(await screen.findByText(/Có phải bạn muốn tìm/i)).toBeInTheDocument();
    const suggestionBtn = screen.getByRole('button', { name: /^environment$/i });
    await user.click(suggestionBtn);

    expect(await screen.findByRole('heading', { name: /^environment$/i })).toBeInTheDocument();
  });

  it('navigates from Topbar quick search via Enter to /dictionary?q=recycle', async () => {
    const user = userEvent.setup();
    renderDictionaryApp('/');

    const topbarSearch = await screen.findByLabelText(/Tra nhanh từ vựng/i);
    await user.type(topbarSearch, 'recycle{Enter}');

    expect(await screen.findByRole('heading', { name: /Từ điển Oxford 3000/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /^recycle$/i })).toBeInTheDocument();
  });
});
