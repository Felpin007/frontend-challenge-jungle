import { config } from '@/config'
import '@/styles/globals.css'

/**
 * Ponto de entrada mínimo. O app e a camada de mocks são baixados em paralelo;
 * o app só é renderizado depois que o MSW está ativo, para que nenhuma
 * requisição escape dos mocks. Com VITE_ENABLE_MOCKS desligado, o código dos
 * mocks nem é baixado.
 */
async function bootstrap() {
  const app = import('@/app/App')
  if (config.enableMocks) {
    const { startMocks } = await import('@/mocks/browser')
    await startMocks()
  }
  const { renderApp } = await app
  renderApp(document.getElementById('root')!)
}

void bootstrap()
