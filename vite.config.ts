import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * O main.tsx carrega o app e os mocks com import() dinâmico (o app só renderiza
 * depois do MSW). Este plugin adiciona <link rel="modulepreload"> desses chunks
 * no HTML para o download começar junto com o da página, sem esperar o main.js.
 */
function preloadDynamicEntries(entries: string[]): Plugin {
  return {
    name: 'kurio:preload-dynamic-entries',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle
        if (!bundle) return html
        const files = new Set<string>()
        const visit = (fileName: string) => {
          const chunk = bundle[fileName]
          if (files.has(fileName) || !chunk || chunk.type !== 'chunk') return
          files.add(fileName)
          chunk.imports.forEach(visit)
        }
        for (const chunk of Object.values(bundle)) {
          const id = chunk.type === 'chunk' ? chunk.facadeModuleId?.replace(/\\/g, '/') : undefined
          if (id && entries.some((entry) => id.endsWith(entry))) visit(chunk.fileName)
        }
        return {
          html,
          tags: [...files].map((file) => ({
            tag: 'link',
            attrs: { rel: 'modulepreload', href: `/${file}`, crossorigin: '' },
            injectTo: 'head' as const,
          })),
        }
      },
    },
  }
}

// O plugin do TanStack Router precisa vir antes do plugin do React:
// ele gera src/routeTree.gen.ts a partir de src/routes e divide o código por rota.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const mocksEnabled = env.VITE_ENABLE_MOCKS === 'true'
  return {
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      preloadDynamicEntries(
        mocksEnabled ? ['src/app/App.tsx', 'src/mocks/browser.ts'] : ['src/app/App.tsx'],
      ),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // Ver src/mocks/vendor/tough-cookie-stub.ts
        'tough-cookie': fileURLToPath(
          new URL('./src/mocks/vendor/tough-cookie-stub.ts', import.meta.url),
        ),
      },
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
  }
})
