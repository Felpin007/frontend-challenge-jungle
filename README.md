# Kurio · Marketplace de NFTs

Implementação do desafio de frontend da Jungle Gaming: marketplace de NFTs com descoberta, compra e conta do colecionador, em desktop e mobile. Não há backend real: a API REST e o servidor Socket.IO são simulados no navegador com **MSW**, então o projeto roda inteiro a partir de um checkout limpo.

- **Demo:** https://frontend-challenge-jungle-eight.vercel.app
- **Decisões, contratos e limitações:** [ARCHITECTURE.md](./ARCHITECTURE.md)

| Responsabilidade              | Tecnologia                                                           |
| ----------------------------- | -------------------------------------------------------------------- |
| Interface                     | React 19 + TypeScript 5.9 (Vite 8)                                   |
| Roteamento                    | TanStack Router (rotas por arquivo, search params validados com zod) |
| Estado remoto                 | TanStack Query 5                                                     |
| Cliente HTTP                  | Axios                                                                |
| Tempo real                    | socket.io-client 4                                                   |
| Estilo e componentes          | Tailwind CSS 4 + shadcn/ui (Radix)                                   |
| Mocks                         | MSW 2 + `@mswjs/socket.io-binding`                                   |
| Testes E2E e regressão visual | Playwright                                                           |
| Auditoria                     | Lighthouse 13                                                        |

## Requisitos

- Node.js **22.12 ou superior** e npm
- Para os testes: Chromium do Playwright (`npx playwright install chromium`)

## Como rodar

```bash
npm ci
npm run dev            # http://localhost:5173 (com mocks)
```

| Comando                      | O que faz                                               |
| ---------------------------- | ------------------------------------------------------- |
| `npm run dev`                | Servidor de desenvolvimento com mocks                   |
| `npm run build`              | Verificação de tipos + build de produção (`dist/`)      |
| `npm run preview`            | Serve o build em http://localhost:4173                  |
| `npm run typecheck`          | `tsc --noEmit`                                          |
| `npm run lint`               | ESLint                                                  |
| `npm run test:e2e`           | Testes Playwright (desktop, mobile e regressão visual)  |
| `npm run test:e2e:ui`        | Playwright em modo interativo                           |
| `npm run test:e2e:report`    | Abre o último relatório HTML                            |
| `npm run test:visual:update` | Regera as baselines de regressão visual                 |
| `npm run lighthouse`         | Auditoria Lighthouse (precisa de `npm run build` antes) |

Para rodar os testes contra o deploy, sem servidor local: `PLAYWRIGHT_BASE_URL=https://frontend-challenge-jungle-eight.vercel.app npm run test:e2e`.

O Playwright sobe sozinho o build de produção (`npm run build && vite preview`). Se já houver algo rodando na porta 4173, ele reaproveita esse servidor; nesse caso, confirme que ele está servindo o build mais recente.

## Variáveis de ambiente

Os valores padrão estão em [`.env`](./.env), versionado de propósito, porque não há segredos. Referência em [`.env.example`](./.env.example).

| Variável            | Padrão                       | Uso                                                                                |
| ------------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| `VITE_ENABLE_MOCKS` | `true`                       | Liga a camada de mocks (MSW + Socket.IO simulado). Precisa estar ligada no deploy. |
| `VITE_API_BASE_URL` | `/api`                       | Base das chamadas REST feitas pelo Axios                                           |
| `VITE_REALTIME_URL` | `wss://realtime.kurio.local` | Servidor Socket.IO (interceptado pelo MSW)                                         |

## Credenciais fictícias

Todos os usuários usam a senha **`Kurio@2026`**.

| E-mail            | Perfil no seed                                                                        |
| ----------------- | ------------------------------------------------------------------------------------- |
| `ana@kurio.dev`   | Carteira principal (MetaMask, Ethereum) e secundária (Coinbase, Polygon); 2 favoritos |
| `bruno@kurio.dev` | Carteira principal; 1 item salvo no carrinho; 1 favorito                              |
| `carla@kurio.dev` | Sem carteiras e sem favoritos (bom para testar cadastro de carteira)                  |

Cupons: **`KURIO10`** (10%) e **`GENESIS5`** (5%) são válidos; **`VERAO25`** está expirado; qualquer outro é inválido.

## Cenários do servidor simulado

O servidor simulado guarda o estado no `localStorage`, que sobrevive a refresh. O cenário controla latência, falhas e resultados de pagamento e carteira. Há três formas de escolher:

1. **Painel "Cenários"**: botão no canto inferior esquerdo (no mobile, na borda esquerda). Troca o cenário, restaura os dados iniciais e dispara eventos do servidor.
2. **URL**: `?mock-scenario=<nome>` no primeiro acesso, por exemplo `/?mock-scenario=slow`. O cenário fica salvo e o parâmetro sai da URL.
3. **Console ou testes**: `window.__kurioMocks.setScenario('payment-declined')`.

| Cenário             | Efeito                                                                        |
| ------------------- | ----------------------------------------------------------------------------- |
| `default`           | Sucesso, latência normal (150–450 ms)                                         |
| `fast`              | Sem latência (usado nos testes)                                               |
| `slow`              | 2,5 s por requisição (skeletons)                                              |
| `variable`          | Latência variável e determinística (100–2000 ms)                              |
| `out-of-order`      | Respostas antigas chegam depois das novas                                     |
| `offline`           | Toda requisição REST falha como erro de rede                                  |
| `server-error`      | Catálogo responde HTTP 500                                                    |
| `unavailable`       | Catálogo responde HTTP 503                                                    |
| `empty-catalog`     | Catálogo vazio                                                                |
| `short-session`     | Sessão expira 60 s após o login                                               |
| `payment-declined`  | Pagamentos são recusados                                                      |
| `order-timeout`     | A resposta da criação do pedido se perde (timeout); o pedido confirma em 20 s |
| `wallet-rejected`   | A carteira recusa a conexão                                                   |
| `favorites-failure` | Favoritar responde HTTP 500                                                   |

**Reset:** botão "Restaurar dados iniciais" no painel, ou `window.__kurioMocks.reset()`. Os dados voltam ao seed determinístico e a página recarrega.

## Como reproduzir os fluxos de falha

Todos usam o painel "Cenários". O botão "Restaurar dados iniciais" volta ao estado conhecido.

| Fluxo                           | Como reproduzir                                                                                                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carregamento lento e skeletons  | Cenário `slow` e recarregue a Início, um NFT ou o carrinho                                                                                                                                                |
| Erro e nova tentativa           | Cenário `server-error` → Início mostra o erro → volte para `default` → "Tentar novamente"                                                                                                                 |
| Sem conexão                     | Cenário `offline` e abra um NFT                                                                                                                                                                           |
| Respostas fora de ordem         | Cenário `out-of-order` e troque rápido entre as abas "Novos lançamentos" e "Em alta"                                                                                                                      |
| Resultado vazio                 | Busque um termo inexistente, ou cenário `empty-catalog`                                                                                                                                                   |
| Sessão expirada                 | Entre com uma conta, abra `/pagamento` e clique em "Expirar sessão agora"; ao enviar, você volta ao login e depois retoma o checkout com o formulário preservado                                          |
| Conflito no cadastro            | Cadastre-se com `ana@kurio.dev` (e-mail) ou `ana.lima` (usuário)                                                                                                                                          |
| Cupom inválido/expirado         | `QUALQUER` e `VERAO25` no carrinho                                                                                                                                                                        |
| Preço alterado durante a compra | Com o Emerald Ape (`nft-001`) no carrinho, mude o preço dele no painel. O carrinho avisa e atualiza o resumo; na revisão do pedido, a confirmação é recusada e pede nova confirmação com os valores novos |
| Edição esgotada                 | "Esgotar todas as edições" do NFT que está no carrinho                                                                                                                                                    |
| Timeout com recuperação         | Cenário `order-timeout` e confirme a compra: após 8 s o app avisa que está verificando, repete com a mesma chave e abre o mesmo pedido                                                                    |
| Pedido pendente e nova compra   | Com um pedido ainda pendente (cenário `order-timeout`), volte ao `/pagamento` e confirme de novo: o servidor responde `ORDER_PENDING` e o app abre o pedido em andamento, sem comprar duas vezes             |
| Revisão com preço mudando       | Abra a revisão do pedido e mude o preço do NFT no painel: a revisão troca sozinha para os valores novos e pede "Confirmar novos valores"                                                                  |
| Pagamento recusado              | Cenário `payment-declined` e conclua uma compra                                                                                                                                                           |
| Carteira recusada               | Cenário `wallet-rejected` e clique em "Conectar carteira"                                                                                                                                                 |
| Queda do Socket.IO              | Com um pedido pendente, "Derrubar Socket.IO (5 s)" e depois "Resolver pedidos pendentes agora"; ao reconectar, o status é reconciliado pela API                                                           |
| Eventos duplicados/antigos      | Mude um preço e use "Reenviar último evento" e "Enviar evento antigo"; nada regride nem é reaplicado                                                                                                      |

## Testes

```bash
npx playwright install chromium   # uma vez
npm run test:e2e
```

- **Projetos:** `desktop-chromium` (1440 × 900), `mobile-chromium` (390 × 844), `visual` e `visual-mobile` (regressão visual de Início, Detalhe, Carrinho e Pagamento em 1440 e 390 px).
- **Baselines visuais por sistema operacional:** as versionadas são do Windows (`tests/visual/__screenshots__/<projeto>/win32/`). Em macOS ou Linux, os testes visuais são pulados com aviso; para ativá-los, gere as baselines da plataforma uma vez com `npm run test:visual:update`.
- **Isolamento:** cada teste roda num contexto novo do navegador; o servidor simulado parte do seed.
- **Saídas:** relatório HTML em `playwright-report/`; traces e screenshots das falhas em `test-results/`.
- Os 12 cenários pedidos estão em `tests/e2e/01-*.spec.ts` a `12-*.spec.ts`, numerados como no enunciado. O mapa completo está no [ARCHITECTURE.md](./ARCHITECTURE.md#testes).

## Lighthouse

```bash
npm run build
npm run lighthouse           # 3 medições × (Início, Detalhe) × (mobile, desktop)
```

Configuração em [`scripts/lighthouse.mjs`](./scripts/lighthouse.mjs). Última auditoria (mediana de 3): desktop 96–98 de Performance e 100 nas demais categorias; mobile 57–60 de Performance e 100 nas demais. Relatórios HTML/JSON da execução mediana, resumo com as medianas, versões e ambiente ficam em [`docs/lighthouse/`](./docs/lighthouse). A análise dos resultados está no [ARCHITECTURE.md](./ARCHITECTURE.md#performance-e-lighthouse).

## Estrutura

```
src/
  api/          contratos (zod), cliente Axios, endpoints e chaves de cache
  app/          QueryClient, router e renderização
  routes/       rotas (TanStack Router, baseadas em arquivos)
  features/     telas e hooks por domínio (catalog, nft, cart, checkout, orders, auth, account, favorites, home)
  components/   layout, componentes compartilhados e shadcn/ui (components/ui)
  realtime/     cliente Socket.IO, guarda de eventos e aplicação no cache
  mocks/        servidor simulado: banco, seed, regras de negócio, handlers MSW, Socket.IO e painel
  lib/          utilitários (valores ETH com bigint, imagens)
tests/e2e/      testes Playwright
tests/visual/   regressão visual e baselines
scripts/        auditoria Lighthouse
docs/lighthouse relatórios versionados
```
