import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const isCI = Boolean(process.env.CI)
/** PLAYWRIGHT_BASE_URL=https://... roda os testes contra um deploy (sem subir servidor local). */
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL

/**
 * Os testes rodam contra o build de produção (vite preview) com os mocks
 * ligados: o mesmo artefato que vai para a Vercel. Cada teste usa um contexto
 * novo do navegador, então o localStorage começa vazio e o servidor simulado
 * parte do seed (estado isolado).
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : 4,
  timeout: 45_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' },
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  // Baselines por sistema operacional: a renderização de fontes muda entre Windows, macOS e
  // Linux. Sem baseline para a plataforma, os testes visuais são pulados (ver visual.spec.ts).
  snapshotPathTemplate: '{testDir}/visual/__screenshots__/{projectName}/{platform}/{arg}{ext}',
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [
    {
      name: 'desktop-chromium',
      testIgnore: /visual\//,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      testIgnore: /visual\//,
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'visual',
      testMatch: /visual\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'visual-mobile',
      testMatch: /visual\/.*\.spec\.ts/,
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !isCI,
        timeout: 180_000,
      },
})
