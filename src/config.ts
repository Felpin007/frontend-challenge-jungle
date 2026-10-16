/** Configuração lida das variáveis de ambiente do Vite (ver .env.example). */
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  realtimeUrl: import.meta.env.VITE_REALTIME_URL ?? 'wss://realtime.kurio.local',
  enableMocks: import.meta.env.VITE_ENABLE_MOCKS === 'true',
} as const
