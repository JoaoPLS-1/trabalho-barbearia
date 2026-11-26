import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30000,
        networkMode: 'always',
        retry: (attempt, error) =>
          attempt < 1 &&
          (!(error instanceof ApiError) ||
            error.status === 0 ||
            error.status >= 500),
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}
