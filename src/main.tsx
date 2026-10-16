import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createQueryClient } from '@/app/query-client'
import { createAppRouter } from '@/app/router'
import { config } from '@/config'
import '@/styles/globals.css'

async function bootstrap() {
  // A camada de mocks é ligada por configuração (VITE_ENABLE_MOCKS) e carregada
  // sob demanda: quando desligada, nenhum código de mock entra no bundle inicial.
  if (config.enableMocks) {
    const { startMocks } = await import('@/mocks/browser')
    await startMocks()
  }

  const queryClient = createQueryClient()
  const router = createAppRouter(queryClient)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}

void bootstrap()
