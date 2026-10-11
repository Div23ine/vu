import { QueryClient } from '@tanstack/react-query';
import { isApiError } from './errors';

/**
 * QueryClient factory with VUNVAULT defaults.
 *
 * Client errors (4xx) are never retried — a rejected permission or a validation
 * failure will not fix itself. Network and 5xx failures get two attempts.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 300_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) =>
          !(isApiError(error) && error.status >= 400 && error.status < 500) && failureCount < 2,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
