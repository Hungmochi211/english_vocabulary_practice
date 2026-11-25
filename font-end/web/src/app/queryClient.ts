import { QueryClient } from '@tanstack/react-query';

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export const queryClient = createAppQueryClient();

export async function invalidateLearningCaches(client: QueryClient = queryClient): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: ['stats', 'overview'] }),
    client.invalidateQueries({ queryKey: ['learning', 'lessons'] }),
    client.invalidateQueries({ queryKey: ['learning', 'history'] }),
    client.invalidateQueries({ queryKey: ['reviews', 'due'] }),
    client.invalidateQueries({ queryKey: ['users', 'me'] }),
  ]);
}
