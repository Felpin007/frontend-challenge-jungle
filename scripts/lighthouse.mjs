/**
 * Auditoria Lighthouse reproduzível.
 *
 * - Build de produção servido pelo `vite preview` (mesmo artefato do deploy),
 *   com os mocks ligados no cenário padrão (latência normal).
 * - Páginas: Início e Detalhe do NFT. Perfis: mobile (padrão do Lighthouse) e desktop.
 * - 3 medições por página e perfil, cada uma num navegador limpo; reportamos a
 *   mediana de cada categoria e salvamos os relatórios HTML/JSON da execução
 *   mediana (pela nota de Performance) em docs/lighthouse/.
 *
 * Uso: npm run build && npm run lighthouse
 *      (ou LH_URL=https://... npm run lighthouse para auditar o deploy)
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'docs', 'lighthouse')
const RUNS = Number(process.env.LH_RUNS ?? 3)
const PORT = 4174
const BASE = process.env.LH_URL ?? `http://localhost:${PORT}`
// LH_PAGES / LH_PROFILES (separados por vírgula) permitem rodar só parte da auditoria.
const only = (list, env) => (env ? list.filter((item) => env.split(',').includes(item.name)) : list)
const PAGES = only(
  [
    { name: 'inicio', path: '/' },
    { name: 'detalhe', path: '/nft/nft-001' },
  ],
  process.env.LH_PAGES,
)
const PROFILES = only(
  [
    { name: 'mobile', config: undefined },
    { name: 'desktop', config: desktopConfig },
  ],
  process.env.LH_PROFILES,
)
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

async function startPreview() {
  if (process.env.LH_URL) return null
  const server = spawn(`npx vite preview --port ${PORT} --strictPort`, {
    cwd: ROOT,
    shell: true,
    stdio: 'ignore',
  })
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(BASE)
      if (response.ok) return server
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('vite preview não respondeu')
}

async function audit(url, config) {
  const chrome = await chromeLauncher.launch({
    chromePath: process.env.CHROME_PATH ?? chromium.executablePath(),
    // --no-sandbox: o Chromium do Playwright no Windows encerra sem ele (o próprio
    // Playwright também roda com o sandbox desligado). Não altera as métricas.
    chromeFlags: ['--headless=new', '--no-first-run', '--no-sandbox'],
  })
  try {
    const result = await lighthouse(
      url,
      { port: chrome.port, output: ['html', 'json'], logLevel: 'error' },
      config,
    )
    return result
  } finally {
    await chrome.kill()
  }
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const server = await startPreview()
  const summary = {
    generatedAt: new Date().toISOString(),
    target: BASE,
    runsPerPage: RUNS,
    scenario: 'default (mocks MSW ligados, latência normal 150–450 ms)',
    environment: {
      node: process.version,
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      cpu: os.cpus()[0]?.model,
      memoryGb: Math.round(os.totalmem() / 1024 ** 3),
    },
    results: [],
  }

  try {
    for (const page of PAGES) {
      for (const profile of PROFILES) {
        const runs = []
        for (let i = 0; i < RUNS; i++) {
          const { lhr, report } = await audit(`${BASE}${page.path}`, profile.config)
          const scores = Object.fromEntries(
            CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)]),
          )
          const metrics = {
            lcpMs: Math.round(lhr.audits['largest-contentful-paint'].numericValue),
            cls: Number(lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3)),
            tbtMs: Math.round(lhr.audits['total-blocking-time'].numericValue),
            fcpMs: Math.round(lhr.audits['first-contentful-paint'].numericValue),
          }
          runs.push({
            scores,
            metrics,
            report,
            versions: {
              lighthouse: lhr.lighthouseVersion,
              userAgent: lhr.environment.hostUserAgent,
            },
          })
          console.log(`${page.name}/${profile.name} #${i + 1}`, scores, metrics)
        }
        const medianScores = Object.fromEntries(
          CATEGORIES.map((c) => [c, median(runs.map((r) => r.scores[c]))]),
        )
        const medianMetrics = Object.fromEntries(
          Object.keys(runs[0].metrics).map((m) => [m, median(runs.map((r) => r.metrics[m]))]),
        )
        // Execução representativa: a de Performance mediana
        const representative =
          runs.find((r) => r.scores.performance === medianScores.performance) ?? runs[0]
        const base = `${page.name}-${profile.name}`
        await writeFile(path.join(OUT, `${base}.html`), representative.report[0])
        await writeFile(path.join(OUT, `${base}.json`), representative.report[1])
        summary.lighthouseVersion = representative.versions.lighthouse
        summary.userAgent = representative.versions.userAgent
        summary.results.push({
          page: page.path,
          profile: profile.name,
          median: medianScores,
          medianMetrics,
          runs: runs.map(({ scores, metrics }) => ({ scores, metrics })),
          report: `${base}.html`,
        })
      }
    }
  } finally {
    if (server) {
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'])
      else server.kill()
    }
  }

  await writeFile(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2))
  const table = [
    '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...summary.results.map(
      (r) =>
        `| ${r.page} | ${r.profile} | ${r.median.performance} | ${r.median.accessibility} | ${r.median['best-practices']} | ${r.median.seo} | ${(r.medianMetrics.lcpMs / 1000).toFixed(2)} s | ${r.medianMetrics.cls} | ${r.medianMetrics.tbtMs} ms |`,
    ),
  ].join('\n')
  await writeFile(
    path.join(OUT, 'summary.md'),
    `# Lighthouse — mediana de ${RUNS} medições\n\nGerado em ${summary.generatedAt} contra ${BASE}\n\n${table}\n\n- Lighthouse ${summary.lighthouseVersion}\n- ${summary.userAgent}\n- Node ${summary.environment.node} · ${summary.environment.os} · ${summary.environment.cpu} · ${summary.environment.memoryGb} GB\n- Cenário dos mocks: ${summary.scenario}\n`,
  )
  console.log(`\n${table}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
