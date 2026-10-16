import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/http'

/**
 * Política de cache e retries (detalhada no ARCHITECTURE.md):
 * - staleTime de 30 s: navegação entre telas reaproveita dados recentes e
 *   revalida em segundo plano depois disso;
 * - retry só para falhas transitórias (rede, timeout, 5xx), no máximo 2 vezes,
 *   com backoff exponencial; erros 4xx são definitivos e vão direto para a UI;
 * - mutations nunca repetem sozinhas: repetir uma escrita pode duplicar a
 *   operação. A recuperação é feita pelo usuário ou por idempotência (pedidos).
 */
export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache(),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) =>
          error instanceof ApiError &&
          error.isTransient &&
          error.code !== 'CANCELED' &&
          failureCount < 2,
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  })
}
