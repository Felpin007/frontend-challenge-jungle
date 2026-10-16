/**
 * Substitui o `tough-cookie` no build do navegador (alias em vite.config.ts).
 *
 * O MSW usa o tough-cookie só para guardar cookies definidos por respostas
 * mockadas (Set-Cookie) e reenviá-los nas requisições seguintes. A API
 * simulada da Kurio autentica por token Bearer e nunca define cookies, então
 * esse suporte não é usado. O tough-cookie (com a lista de sufixos públicos do
 * tldts) somava ~60 KB gzip e tempo de inicialização antes da primeira tela.
 *
 * Contrato mínimo usado por msw/lib/core/utils/cookieStore.mjs.
 */
export class Cookie {
  static fromJSON(): null {
    return null
  }
}

export class MemoryCookieStore {
  idx: Record<string, unknown> = {}
}

export class CookieJar {
  constructor(_store?: MemoryCookieStore) {}

  getCookiesSync(_url: string): Array<{ key: string; value: string }> {
    return []
  }

  async setCookie(_cookie: string, _url: string): Promise<void> {
    // Cookies de respostas mockadas não são suportados (não usados pela API simulada).
  }
}
