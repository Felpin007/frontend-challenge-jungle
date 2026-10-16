# Arquitetura e decisões

Este documento explica como a solução está organizada, os contratos REST e de eventos, as políticas de sessão, carrinho, cache e reconciliação, e registra limitações, decisões de UX e desvios do Figma.

## Sumário

1. [Visão geral](#visão-geral)
2. [Decisões de stack](#decisões-de-stack)
3. [Contratos REST](#contratos-rest)
4. [Eventos Socket.IO](#eventos-socketio)
5. [Sessão](#sessão)
6. [Carrinho e cotação](#carrinho-e-cotação)
7. [Checkout, pedidos e idempotência](#checkout-pedidos-e-idempotência)
8. [Cache, retries e sincronização](#cache-retries-e-sincronização)
9. [Reconciliação REST × Socket.IO](#reconciliação-rest--socketio)
10. [Valores em ETH](#valores-em-eth)
11. [Servidor simulado (MSW)](#servidor-simulado-msw)
12. [Acessibilidade](#acessibilidade)
13. [Performance e Lighthouse](#performance-e-lighthouse)
14. [Desvios do Figma e decisões de UX](#desvios-do-figma-e-decisões-de-ux)
15. [Testes](#testes)
16. [Limitações e o que ficou de fora](#limitações-e-o-que-ficou-de-fora)

---

## Visão geral

```
┌──────────────────────────── Navegador ────────────────────────────┐
│                                                                    │
│  React + TanStack Router                                           │
│    │  (hooks por feature: useCart, useQuote, usePlaceOrder…)       │
│    ▼                                                               │
│  TanStack Query (cache) ◄──────────── RealtimeProvider             │
│    │                                    │ socket.io-client          │
│    ▼                                    ▼ (WebSocket)               │
│  Axios ──► fetch/XHR ──► Service Worker do MSW ─┐  Interceptor WS  │
│                                                  ▼        ▼         │
│                         ┌──── Servidor simulado (src/mocks) ────┐  │
│                         │ handlers REST · regras de negócio      │  │
│                         │ banco (localStorage) · Socket.IO       │  │
│                         └───────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

- **O app não conhece os mocks.** Componentes, hooks e o cliente Axios só falam HTTP e Socket.IO. Não há dado fictício nem caminho alternativo de negócio fora de `src/mocks`.
- **Contratos tipados de ponta a ponta.** [`src/api/contracts.ts`](./src/api/contracts.ts) define os schemas zod de toda requisição, resposta e evento. O cliente valida cada resposta na fronteira de transporte (`request()` em [`src/api/http.ts`](./src/api/http.ts)), e os mocks importam os mesmos tipos. Se o "servidor" mudar o formato, o erro aparece ali, como `CONTRACT_ERROR`, e não espalhado pela interface.
- **Inicialização** ([`src/main.tsx`](./src/main.tsx)): o app e a camada de mocks são baixados em paralelo, e o app só renderiza depois que o MSW está ativo, para que nenhuma requisição escape dos mocks. Com `VITE_ENABLE_MOCKS=false`, o código dos mocks nem é baixado.

### Organização

| Pasta            | Responsabilidade                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/api`        | Contratos, cliente Axios (`ApiError`, interceptors), endpoints e chaves de cache                                  |
| `src/routes`     | Rotas do TanStack Router (arquivo = rota); `_auth.tsx` protege as rotas privadas                                  |
| `src/features/*` | Telas e hooks por domínio: `catalog`, `nft`, `cart`, `checkout`, `orders`, `auth`, `account`, `favorites`, `home` |
| `src/realtime`   | Conexão Socket.IO por sessão, guarda contra duplicatas/versões antigas e aplicação dos eventos no cache           |
| `src/components` | Layout, componentes compartilhados e `ui/` (shadcn/ui adaptado aos tokens do Figma)                               |
| `src/mocks`      | Servidor simulado: banco, seed, regras de negócio (`domain/`), handlers MSW, Socket.IO e painel de cenários       |

## Decisões de stack

| Decisão                                    | Motivo                                                                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vite + TanStack Router**, e não Next.js  | O enunciado exige TanStack Router, e o Next tem roteador próprio. O app é uma SPA com rotas por arquivo e code splitting automático por rota.      |
| **MSW 2.x**, e não 3.x                     | O `@mswjs/socket.io-binding` (ponte Socket.IO ↔ MSW sugerida no enunciado) declara `msw ^2.10` como dependência.                                   |
| **TypeScript 5.9**, e não 7                | O `typescript-eslint` ainda não suporta o TypeScript 7.                                                                                            |
| **zod** nos contratos e formulários        | Uma única definição gera o tipo TypeScript, valida respostas da API, valida search params da URL e valida formulários (via `@hookform/resolvers`). |
| **react-hook-form**                        | Padrão do shadcn/ui para formulários; erros por campo, inclusive os devolvidos pela API (`applyServerErrors`).                                     |
| **sonner**                                 | Toasts do shadcn/ui, anunciados por leitores de tela (`aria-live`).                                                                                |
| **Roboto Mono via `@fontsource-variable`** | Fonte do Figma servida localmente (sem depender do Google Fonts), com `font-display: swap`.                                                        |

## Contratos REST

Base: `VITE_API_BASE_URL` (`/api`). Respostas validadas com os schemas de [`contracts.ts`](./src/api/contracts.ts).

### Erros

Todo erro segue o envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Verifique os campos destacados.",
    "fieldErrors": { "email": "Informe um e-mail válido" },
    "details": {}
  }
}
```

| Código                              | HTTP    | Quando                                                                                      |
| ----------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| `VALIDATION_ERROR`                  | 400/422 | Corpo inválido; `fieldErrors` aponta os campos                                              |
| `INVALID_CREDENTIALS`               | 401     | Login com e-mail ou senha errados (mesma mensagem nos dois casos)                           |
| `UNAUTHENTICATED`                   | 401     | Rota privada sem token ou com token desconhecido                                            |
| `SESSION_EXPIRED`                   | 401     | Token expirado                                                                              |
| `FORBIDDEN`                         | 403     | Recurso de outro usuário (ex.: pedido)                                                      |
| `NOT_FOUND`                         | 404     | NFT, edição, pedido ou item inexistente                                                     |
| `EMAIL_TAKEN` / `USERNAME_TAKEN`    | 409     | Conflito de cadastro ou de perfil                                                           |
| `AVAILABILITY_CONFLICT`             | 409     | Quantidade acima do disponível ou edição esgotada (`details.maxQuantity` / `details.quote`) |
| `QUOTE_OUTDATED`                    | 409     | Preço, estoque, cupom ou taxa mudaram desde a cotação (`details.quote` traz a nova)         |
| `COUPON_INVALID` / `COUPON_EXPIRED` | 422     | Cupom inexistente ou vencido                                                                |
| `IDEMPOTENCY_CONFLICT`              | 409     | Chave de idempotência reutilizada com outro conteúdo                                        |
| `ORDER_PENDING`                     | 409     | Já existe um pedido pendente do usuário (`details.orderId` aponta para ele)                 |
| `WALLET_REJECTED`                   | 403/422 | Carteira recusou a conexão ou não está conectada                                            |
| `SERVICE_UNAVAILABLE`               | 503     | Falha transitória                                                                           |
| `INTERNAL_ERROR`                    | 500     | Erro do servidor                                                                            |

No cliente, toda falha vira `ApiError` com `code`. Falhas de rede viram `NETWORK_ERROR`, timeouts viram `TIMEOUT` e respostas fora do contrato viram `CONTRACT_ERROR`. `ApiError.isTransient` diz se vale a pena repetir.

### Endpoints

Autenticação: `Authorization: Bearer <token>`. O carrinho do visitante é identificado pelo header `X-Cart-Id` (UUID gerado no navegador).

| Recurso             | Método e caminho                                                                 | Requisição                                                                                                                                               | Resposta                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Sessão              | `POST /auth/register`                                                            | `{ username, email, password }`                                                                                                                          | `201 Session` · 409 `EMAIL_TAKEN`/`USERNAME_TAKEN` · 422                                                             |
|                     | `POST /auth/login`                                                               | `{ email, password }`                                                                                                                                    | `Session` · 401 `INVALID_CREDENTIALS`                                                                                |
|                     | `GET /auth/session`                                                              | —                                                                                                                                                        | `{ expiresAt, user }` · 401 `SESSION_EXPIRED`                                                                        |
|                     | `POST /auth/logout`                                                              | —                                                                                                                                                        | `204` (encerra a sessão e as conexões Socket.IO dela)                                                                |
| NFTs                | `GET /nfts`                                                                      | `q, categories (csv), networks (csv), minPrice, maxPrice, tab (all\|new\|trending), sort (recent\|price-asc\|price-desc\|popular\|name), page, pageSize` | `{ items: NftSummary[], page, pageSize, total, totalPages, facets }`                                                 |
|                     | `GET /nfts/featured`                                                             | —                                                                                                                                                        | `{ hero: NftSummary[], spotlight }`                                                                                  |
|                     | `GET /nfts/:id`                                                                  | —                                                                                                                                                        | `NftDetail` · 404                                                                                                    |
| Favoritos           | `GET /favorites`                                                                 | —                                                                                                                                                        | `{ nftIds }`                                                                                                         |
|                     | `GET /favorites/items`                                                           | —                                                                                                                                                        | `{ items: NftSummary[] }`                                                                                            |
|                     | `PUT /favorites/:nftId` · `DELETE /favorites/:nftId`                             | —                                                                                                                                                        | `{ nftIds }`                                                                                                         |
| Carrinho            | `GET /cart`                                                                      | —                                                                                                                                                        | `Cart`                                                                                                               |
|                     | `POST /cart/items`                                                               | `{ nftId, editionId, quantity }`                                                                                                                         | `Cart` · 409 `AVAILABILITY_CONFLICT`                                                                                 |
|                     | `PATCH /cart/items/:itemId`                                                      | `{ quantity }`                                                                                                                                           | `Cart` · 409                                                                                                         |
|                     | `DELETE /cart/items/:itemId`                                                     | —                                                                                                                                                        | `Cart`                                                                                                               |
|                     | `POST /cart/coupon` · `DELETE /cart/coupon`                                      | `{ code }`                                                                                                                                               | `Cart` · 422 `COUPON_INVALID`/`COUPON_EXPIRED`                                                                       |
|                     | `POST /cart/acknowledge`                                                         | —                                                                                                                                                        | `Cart` (usuário viu as mudanças de preço)                                                                            |
|                     | `POST /cart/merge`                                                               | `{ guestCartId }`                                                                                                                                        | `Cart` (junta o carrinho do visitante ao da conta)                                                                   |
| Cotação             | `POST /quotes`                                                                   | `{ network }`                                                                                                                                            | `Quote` (subtotal, desconto, taxa, total, `couponStatus`, `issues`)                                                  |
| Pedidos             | `POST /orders` + header `Idempotency-Key`                                        | `{ quoteId, walletSessionId, collector }`                                                                                                                | `201 Order` (novo) · `200 Order` (mesma chave) · 409 `QUOTE_OUTDATED`/`AVAILABILITY_CONFLICT`/`IDEMPOTENCY_CONFLICT`/`ORDER_PENDING` |
|                     | `GET /orders?status=` · `GET /orders/:id`                                        | —                                                                                                                                                        | `{ items }` · `Order` · 403/404                                                                                      |
| Perfil              | `GET /profile` · `PATCH /profile`                                                | `{ displayName, username, email, ensName, walletNickname }`                                                                                              | `User` · 409 · 422                                                                                                   |
|                     | `PUT /profile/avatar` · `DELETE /profile/avatar`                                 | `{ dataUrl }` (PNG/JPEG/WEBP ≤ 1 MB)                                                                                                                     | `User` · 422                                                                                                         |
|                     | `POST /profile/password`                                                         | `{ currentPassword, newPassword }`                                                                                                                       | `204` · 422 (`fieldErrors.currentPassword`)                                                                          |
| Carteiras           | `GET /wallets`                                                                   | —                                                                                                                                                        | `{ primary, secondary }`                                                                                             |
|                     | `PUT /wallets/:slot` (`primary`\|`secondary`)                                    | `WalletInput`                                                                                                                                            | `{ primary, secondary }` · 422                                                                                       |
|                     | `DELETE /wallets/secondary`                                                      | —                                                                                                                                                        | `{ primary, secondary }`                                                                                             |
| Conexão de carteira | `GET /wallet-sessions` · `POST /wallet-sessions` · `DELETE /wallet-sessions/:id` | `{ walletId, provider, network }`                                                                                                                        | `WalletSession` · 403 `WALLET_REJECTED`                                                                              |

Formatos completos: `NftSummary`, `NftDetail`, `Edition`, `Cart`, `CartItem`, `Quote`, `QuoteLine`, `QuoteIssue`, `Order`, `Wallet`, `WalletSession` e `User`, todos em `contracts.ts`.

## Eventos Socket.IO

Conexão: `io(VITE_REALTIME_URL, { transports: ['websocket'], auth: { token } })`. O token vai no pacote CONNECT do Socket.IO e o servidor identifica o usuário por ele.

Todo evento usa o mesmo envelope:

```ts
{
  eventId: string        // identidade estável → descarta duplicatas
  type: 'nft.updated' | 'order.updated'
  resource: { type: 'nft' | 'order', id: string }
  version: number        // versão do recurso → descarta eventos antigos
  occurredAt: string
  data: { ... }
}
```

| Evento          | `data`                                                                   | Entrega                              | Efeito no cliente                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nft.updated`   | `{ nftId, price, totalAvailable, editions: [{ id, price, available }] }` | Todas as conexões                    | Atualiza detalhe, listas e destaques direto no cache (só se a versão for maior); invalida carrinho e cotação (o servidor recalcula status e totais); avisa quando o NFT está no carrinho |
| `order.updated` | `{ orderId, userId, status, order }`                                     | **Só as conexões do dono do pedido** | Atualiza o pedido no cache (estado terminal nunca regride) e, se confirmado, invalida o carrinho                                                                                         |

Toda mudança no banco simulado (vinda de REST, de um timer ou do painel) passa pelo barramento [`src/mocks/domain/bus.ts`](./src/mocks/domain/bus.ts) e vira o evento correspondente. Por isso, REST e eventos nunca divergem.

## Sessão

- **Token** opaco (`kt_…`) devolvido no login ou cadastro e guardado no `localStorage` ([`session-store.ts`](./src/features/auth/session-store.ts)). O store é externo ao React porque o interceptor do Axios e a conexão Socket.IO também leem o token. Os dados do usuário ficam no cache do TanStack Query (`['session', token]`).
- **Recuperação após refresh:** o token é lido do `localStorage`, e o guard das rotas privadas (`_auth.tsx`, `beforeLoad`) valida a sessão com `GET /auth/session` antes de renderizar.
- **Expiração:** a sessão dura 30 minutos (60 s no cenário `short-session`). Qualquer 401 `SESSION_EXPIRED`/`UNAUTHENTICATED` numa requisição autenticada encerra a sessão local. O `AuthWatcher` então limpa o cache privado, avisa o usuário e leva ao login com `redirect` (página de origem) e `reason=expired`. Depois de entrar, o usuário volta exatamente para onde estava.
- **Checkout preservado:** o formulário de pagamento é salvo a cada alteração no `sessionStorage` (por usuário) e restaurado ao voltar. Uma tentativa de pedido em andamento fica no `localStorage` e é retomada (ver idempotência).
- **Logout e troca de usuário:** removem do cache tudo que está sob `['user', …]`, `['cart', …]` e `['session', …]`, e a conexão Socket.IO é refeita sem o token antigo. O servidor também desconecta as conexões da sessão encerrada (pacote `DISCONNECT`). Os testes verificam que, depois de trocar de usuário, só existe conexão do novo.
- **Rotas protegidas:** checkout, pedidos, perfil, carteiras e favoritos. Favoritar sem sessão leva ao login.
- **Senhas:** o servidor simulado nunca guarda senha em claro. Armazena `SHA-256(salt:senha)` com salt por usuário. Num backend real usaríamos bcrypt ou argon2; aqui o objetivo é não persistir a senha no `localStorage`.
- **Redirect seguro:** `redirect` só aceita caminhos internos (`/…`), sem open redirect.

## Carrinho e cotação

- **O carrinho é do servidor.** O usuário autenticado tem um carrinho na conta. O visitante tem um carrinho identificado pelo `X-Cart-Id`, um UUID guardado no `localStorage`. Os dois sobrevivem a refresh.
- **Login preserva os itens do visitante:** logo após autenticar, `POST /cart/merge` junta o carrinho do visitante ao da conta, respeitando a disponibilidade.
- **Item:** `nftId + editionId`. O servidor devolve `unitPrice` atual, `maxQuantity` (mínimo entre o disponível e o limite por pedido) e um `status`:
  - `ok`;
  - `price_changed`, com `previousUnitPrice` (o preço mudou desde que o item entrou no carrinho; "Entendi" reconhece a mudança);
  - `insufficient` (a quantidade passou do disponível);
  - `sold_out`.
- **Resumo (subtotal, desconto, taxa, total) vem da cotação** (`POST /quotes`), nunca de contas no cliente. A versão do carrinho faz parte da chave de cache da cotação: qualquer mudança gera uma cotação nova, e a anterior continua visível (esmaecida) enquanto a nova carrega.
- **Cupom** fica salvo no carrinho e é revalidado a cada cotação (`couponStatus` aponta se ele expirou depois de aplicado).
- **Taxa de rede:** Ethereum 0,016, Polygon 0,002 e Solana 0,001 ETH.
- Itens `sold_out` ou `insufficient` bloqueiam o "Conectar e finalizar".

## Checkout, pedidos e idempotência

1. **Formulário** "Perfil do colecionador", pré-preenchido com o perfil e a carteira principal. "Usar outra carteira?" troca para a carteira secundária cadastrada.
2. **Conectar carteira** (`POST /wallet-sessions`): simula a aprovação na extensão (cerca de 800 ms). No cenário `wallet-rejected` a conexão é recusada. Trocar carteira, rede ou tipo desconecta a sessão anterior.
3. **"Confirmar compra"** valida o formulário, exige a carteira conectada, busca uma **cotação nova** e abre a revisão.
4. **"Confirmar e pagar"** gera uma `Idempotency-Key` (UUID) para essa confirmação e salva a tentativa (chave + corpo) no `localStorage` antes de enviar.
5. **O servidor revalida tudo** contra o estado atual: carrinho, preços, disponibilidade, cupom, taxa e rede da carteira. Antes disso, recusa uma compra nova se o usuário já tiver um pedido pendente (`409 ORDER_PENDING`, ver garantias).
   - Se algo mudou, responde `409 QUOTE_OUTDATED` com a cotação nova. A revisão mostra os valores novos e o usuário precisa confirmar de novo, o que gera uma nova chave.
   - Se algo esgotou, responde `409 AVAILABILITY_CONFLICT`, e a revisão bloqueia a confirmação.
6. **Pedido criado como `pending`.** O estoque é reservado e a resolução (`confirmed` ou `declined`, conforme o cenário) chega pelo `order.updated`.
   - **Confirmado:** o servidor remove do carrinho **só os itens e quantidades comprados**.
   - **Recusado:** o estoque é devolvido e o carrinho fica intacto.

**Garantias:**

- **Clique repetido:** o botão fica desabilitado durante o envio, e uma trava (`inFlight`) ignora chamadas concorrentes.
- **Timeout ou erro de rede:** o cliente avisa ("verificando o pedido") e repete **com a mesma chave**, com backoff de 0,8 s, 1,6 s e 3,2 s. O servidor devolve o pedido já criado (`200`, header `Idempotent-Replayed: true`).
- **Repetições esgotadas:** a tentativa (chave + corpo) continua salva. Se o usuário confirmar de novo com o mesmo conteúdo, o cliente reaproveita a chave; o servidor devolve o pedido, se ele chegou a ser criado, ou cria agora. A mensagem de erro diz isso, e é verdade (coberto por teste).
- **Um pedido pendente por usuário:** o carrinho só é baixado quando o pedido confirma, então uma segunda compra com outra chave (ex.: conteúdo diferente depois de um timeout cuja resposta se perdeu) compraria os mesmos itens de novo. O servidor responde `409 ORDER_PENDING` com o id do pedido, e o cliente leva o usuário até ele.
- **Mesma chave com outro conteúdo:** `409 IDEMPOTENCY_CONFLICT`.
- **Refresh no meio do envio:** ao voltar ao checkout, a tentativa salva é reenviada com a mesma chave e o usuário cai no pedido existente (coberto por teste).
- **Revisão aberta e preço mudando:** se um `nft.updated` muda preço, estoque, cupom ou taxa enquanto a revisão está aberta, a cotação ativa é recalculada pela API e a revisão troca para ela na hora, com o aviso "os valores mudaram" e o botão "Confirmar novos valores". Só troca para uma cotação **mais nova** (`createdAt`) que não esteja sendo recarregada. Sem o evento (socket caído), a proteção continua no servidor (`409 QUOTE_OUTDATED`).
- **Refresh ou queda de conexão com o pedido pendente:** a página do pedido (`/pedidos/:id`) consulta a API ao montar, recebe o `order.updated` e, com o pedido ainda pendente, consulta de novo a cada 5 s como alternativa ao socket.
- **Confirmação** só aparece quando o servidor responde `status: 'confirmed'`.
- **O recibo é snapshot:** linhas, preços, desconto, taxa e total ficam gravados no pedido. Mudanças posteriores no catálogo não alteram o recibo (coberto por teste).
- Hash e link do explorador são simulados (testnets Sepolia/Amoy), e a interface diz isso.

## Cache, retries e sincronização

Configuração em [`src/app/query-client.ts`](./src/app/query-client.ts) e chaves em [`src/api/query-keys.ts`](./src/api/query-keys.ts).

| Política                     | Valor e motivo                                                                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `staleTime`                  | 30 s por padrão (10 s no carrinho, 0 na cotação). Navegar entre telas reaproveita dados recentes e revalida em segundo plano.                                                                                                              |
| `gcTime`                     | 5 min                                                                                                                                                                                                                                      |
| Retries de queries           | Só falhas transitórias (`NETWORK_ERROR`, `TIMEOUT`, 5xx, 503), no máximo 2, com backoff exponencial (500 ms, 1 s). Erros 4xx vão direto para a interface.                                                                                  |
| Retries de mutations         | Nenhum automático: repetir uma escrita pode duplicar a operação. A exceção é o pedido, que repete com idempotência.                                                                                                                        |
| `refetchOnWindowFocus`       | Ligado: voltar à aba revalida o que está na tela.                                                                                                                                                                                          |
| Isolamento                   | Dados privados ficam sempre sob `['user', userId, …]` e `['cart', 'user:<id>' \| 'guest:<id>']`. Um usuário nunca lê o cache de outro, e o logout limpa tudo por prefixo.                                                                  |
| Parâmetros                   | A chave da listagem contém todos os parâmetros. Cada combinação tem seu cache, e uma resposta antiga nunca sobrescreve a atual.                                                                                                            |
| Cancelamento                 | Toda `queryFn` repassa o `AbortSignal` ao Axios. Mudar filtros cancela a requisição anterior.                                                                                                                                              |
| Atualização em segundo plano | `keepPreviousData` na listagem e na cotação: os dados anteriores ficam visíveis (esmaecidos, `aria-busy`) enquanto os novos carregam.                                                                                                      |
| Atualização otimista         | **Favoritos**: o coração muda na hora; se a API falhar, o estado anterior é restaurado e o usuário é avisado (coberto por teste).                                                                                                          |
| Invalidação                  | Mutations do carrinho gravam a resposta do servidor no cache. Os eventos `nft.updated` atualizam o catálogo e invalidam o carrinho; `order.updated` atualiza o pedido; a reconexão invalida tudo o que está ativo.                         |
| URL como estado              | Busca, filtros, aba, ordenação e página ficam nos search params, validados com zod. Valores inválidos são descartados, padrões não aparecem na URL, e o estado sobrevive a refresh e ao voltar/avançar. Mudar filtro reinicia a paginação. |

## Reconciliação REST × Socket.IO

- **Duplicatas e eventos antigos:** a [`EventGuard`](./src/realtime/event-guard.ts) lembra os últimos 500 `eventId` e a maior `version` vista por recurso. A aplicação no cache também compara com a versão vinda do REST.
- **Estados terminais:** um pedido `confirmed` ou `declined` nunca volta a `pending`.
- **A cada conexão, inclusive a primeira**, o cliente invalida as queries ativas de NFTs, carrinho e pedidos. Isso cobre eventos perdidos entre o carregamento via REST e o socket conectar, ou durante uma queda.
- **Sessão:** existe uma conexão por sessão. Ao trocar de usuário, listeners e conexão são liberados (`removeAllListeners` + `disconnect`). Eventos de pedido só são entregues às conexões do dono, e o cliente ainda confere `data.userId`.
- **Status de conexão:** depois de 1,5 s sem reconectar, um aviso acessível ("Conexão em tempo real interrompida…") aparece no topo.
- **Checkout:** a revisão do pedido acompanha os eventos (ver "Revisão aberta e preço mudando" em [Checkout](#checkout-pedidos-e-idempotência)).

## Valores em ETH

Valores trafegam como **string decimal** (`"1.19"`), validados no contrato. Todo cálculo, no servidor simulado e no cliente, converte para **wei em `bigint`** (inteiro com 18 casas) em [`src/lib/money.ts`](./src/lib/money.ts). Em JavaScript, `0.1 + 0.2 = 0.30000000000000004`; em wei, `100000000000000000n + 200000000000000000n` é exato. Quantidades são inteiras. A exibição usa no mínimo 2 casas e trunca sem arredondar para cima.

## Servidor simulado (MSW)

| Peça                                                                   | Arquivo                                         |
| ---------------------------------------------------------------------- | ----------------------------------------------- |
| Banco em memória + persistência no `localStorage` (`kurio:mock-db:v4`) | `mocks/db.ts`                                   |
| Service worker (MSW + recuperação após o navegador encerrá-lo)         | `public/kurio-mock-sw.js`                       |
| Seed determinístico: PRNG com semente fixa e data de referência fixa   | `mocks/seed.ts`                                 |
| Regras de negócio (sessões, catálogo, carrinho, cotação, pedidos)      | `mocks/domain/*`                                |
| Handlers REST                                                          | `mocks/handlers/*`                              |
| Cenários (latência, falhas, pagamento, carteira)                       | `mocks/scenarios.ts`                            |
| Falhas e atrasos pontuais (`failNext`, `delayNext`) e utilitários HTTP | `mocks/mock-http.ts`                            |
| Servidor Socket.IO                                                     | `mocks/realtime.ts`                             |
| API de controle (`window.__kurioMocks`) e painel                       | `mocks/control.ts`, `mocks/panel/MockPanel.tsx` |

**Fixtures:**

- 48 NFTs, 9 categorias e 3 redes, com preços de 0,02 a 12,30 ETH (faixa do Figma).
- Até 4 edições por NFT (`1/1`, `1/10`, `1/50`, `ABERTA`), algumas esgotadas.
- 3 usuários com carteiras, favoritos e carrinho diferentes.
- 3 cupons (válido, válido e expirado).
- Os 9 NFTs do Figma mantêm nome, número e preço do layout.

**Determinismo:** o seed não depende do relógio, e as latências "variáveis" usam um PRNG fixo. O cenário "fora de ordem" usa um ciclo fixo de latências. O reset restaura o seed integralmente.

**Socket.IO no MSW.** O transporte é o WebSocket interceptado pelo MSW (`ws.link`), com o protocolo Engine.IO/Socket.IO traduzido pelo `@mswjs/socket.io-binding` 0.2. Complementos e limitações:

1. **Só WebSocket.** O cliente usa `transports: ['websocket']`, porque o MSW não intercepta o long-polling do Engine.IO.
2. **Caminho:** o MSW remove o prefixo `/socket.io/` antes de comparar a URL, então o link é registrado na raiz do host (`wss://realtime.kurio.local`).
3. **Heartbeat:** no Engine.IO v4 quem envia o ping é o servidor. A binding não envia, então o mock manda `2` a cada 20 s; sem isso, o cliente desconectaria por "ping timeout" a cada ~30 s.
4. **Autenticação:** a binding ignora o payload do CONNECT. O mock lê o pacote bruto `40{"token":…}` para saber o usuário da conexão.
5. **Ordem de carregamento:** o `engine.io-client` guarda `globalThis.WebSocket` quando o módulo é avaliado. Por isso o `socket.io-client` é importado dinamicamente no `RealtimeProvider`, depois do MSW iniciar. Isso também tira o socket.io do bundle inicial.
6. Só o namespace padrão, sem acknowledgements e sem binários (limites da binding).

**Service worker encerrado pelo navegador.** Navegadores encerram service workers ociosos (por exemplo, com a aba em segundo plano). O MSW mantém em memória a lista de abas com mocks ativos e, ao reiniciar, passava a mandar `/api/*` para a rede: no deploy, a Vercel respondia 404 e a interface mostrava "Erro inesperado do servidor" até recarregar. O worker registrado é o [`public/kurio-mock-sw.js`](./public/kurio-mock-sw.js), que importa o `mockServiceWorker.js` oficial (sem alterá-lo) e guarda essa lista também no Cache Storage: ela é gravada no `MOCK_ACTIVATE`, apagada no `CLIENT_CLOSED` e restaurada quando o worker reinicia. Uma aba que nunca ativou os mocks continua indo para a rede. Há teste que encerra o worker pelo DevTools Protocol e confere que a API simulada continua respondendo.

**Outras limitações do ambiente de mocks:**

- O "servidor" roda **dentro de cada aba**. Duas abas abertas têm servidores separados que compartilham o `localStorage`: um evento numa aba não chega à outra, e gravações podem se sobrepor. O login e o logout em outra aba são refletidos via evento `storage`.
- O service worker do MSW encaminha **toda** requisição da página (inclusive imagens e chunks) para a thread principal decidir se mocka; isso custa CPU (ver Performance).
- O `tough-cookie`, usado pelo MSW para cookies de respostas mockadas, foi trocado por um stub ([`mocks/vendor/tough-cookie-stub.ts`](./src/mocks/vendor/tough-cookie-stub.ts)), porque a API simulada autentica por token Bearer e nunca define cookies. Isso economiza cerca de 120 KB gzip, já que o `tough-cookie` traz junto a lista de sufixos públicos do `tldts`.
- Timers de pedidos pendentes são retomados ao recarregar: o servidor "reinicia" junto com a página e resolve na hora o que já passou do prazo.

## Acessibilidade

- **Navegação por teclado:** link "Pular para o conteúdo", foco visível em todos os controles (anel `--ring`), diálogos e drawers do Radix com foco preso e devolvido ao botão de origem (`DialogTrigger`; a revisão do pedido devolve o foco ao "Confirmar compra").
- **Semântica:**
  - landmarks (`header`, `nav`, `main`, `footer`);
  - `h1` por página, inclusive como `sr-only` onde o layout não tem título visível;
  - trilha de navegação com `aria-current`;
  - abas do catálogo com `role="tablist"`, foco móvel (só a aba ativa entra no Tab) e setas, Home e End;
  - edições como `radiogroup`;
  - quantidade como `group` com valor anunciado;
  - recibo como tabela com `caption`;
  - resumo de valores como `dl` com um único `div` por par `dt`/`dd`;
  - níveis de título coerentes (o card de NFT usa `h2` quando está direto sob o `h1`, como em Favoritos).
- **Formulários:**
  - `label` associado a cada campo;
  - asterisco de obrigatório marcado como `aria-hidden` (a obrigatoriedade é informada pela validação);
  - erros ligados por `aria-describedby`, com `aria-invalid`;
  - foco no primeiro campo inválido, inclusive para erros devolvidos pela API.
- **Feedback acessível:**
  - toasts (`aria-live`) para mutations;
  - status de carregamento e total de resultados em regiões `aria-live`;
  - avisos de tempo real (preço mudou, esgotou, conexão interrompida) anunciados.
- **Imagens:** `alt` descritivo nas artes de NFT; imagens decorativas (blog, miniaturas) com `alt=""`.
- **Estado não depende só de cor:** esgotado aparece riscado e com texto "esgotada"; o filtro ativo tem checkbox marcado; erros têm ícone e texto.
- **Movimento reduzido:** `prefers-reduced-motion` desliga o shimmer e as transições. O carrossel não roda sozinho.
- **Painéis fixos e zoom:** o resumo do carrinho mobile só fica fixo no rodapé quando a tela tem pelo menos 600 px de altura; com zoom alto ou telas baixas, volta ao fluxo da página para nada ficar escondido atrás dele.
- **Limite de quantidade explicado:** quando o "+" fica desabilitado no carrinho, um texto ligado ao seletor (`aria-describedby`) diz o motivo ("Edição única" ou "Máx. N unidades").
- **Zoom e overflow:** layouts fluidos; os testes verificam ausência de overflow horizontal em 390, 768 e 1440 px.

**Ajustes em relação ao Figma por acessibilidade:**

- **Vermelho de erro:** `#ed1b2e` dá 4,39:1 sobre o fundo; usamos `#ff7a6e` (7,5:1).
- **Borda dos campos:** clareada (`#6b4530`) para chegar a 3:1 de contraste com o fundo.
- **Filtros:** a lista de coleções e redes virou checkboxes, e a faixa de preço ganhou campos de mínimo e máximo, além do slider. Isso também segue as sugestões dos comentários do Figma.
- **Botão "−" da quantidade:** fica desabilitado no mínimo, como sugere um comentário do Figma.
- **Botão "Aplicar" do cupom (mobile):** texto claro sobre o gradiente, como no Figma. O contraste varia de ~3:1 a ~4,5:1 ao longo do gradiente; mantivemos pela fidelidade e reforçamos com uma sombra discreta no texto.

## Performance e Lighthouse

Auditoria reproduzível em [`scripts/lighthouse.mjs`](./scripts/lighthouse.mjs):

- build de produção servido pelo `vite preview`, com o cenário padrão dos mocks (latência normal);
- 3 medições por página e perfil, cada uma em navegador limpo;
- mediana de cada categoria;
- relatórios HTML/JSON da execução mediana e resumo com versões e ambiente em [`docs/lighthouse/`](./docs/lighthouse) ([`summary.md`](./docs/lighthouse/summary.md)).

O Chromium usado é o do Playwright, com `--no-sandbox`: no Windows ele encerra sem essa flag, e o próprio Playwright também roda assim. Isso não altera as métricas.

**Resultado (mediana de 3 medições):**

| Página                   | Perfil  | Performance | Accessibility | Best Practices | SEO |    LCP | CLS |    TBT |
| ------------------------ | ------- | ----------: | ------------: | -------------: | --: | -----: | --: | -----: |
| Início (`/`)             | mobile  |      **57** |           100 |            100 | 100 | 4,48 s |   0 | 760 ms |
| Início (`/`)             | desktop |          96 |           100 |            100 | 100 | 1,10 s |   0 |  99 ms |
| Detalhe (`/nft/nft-001`) | mobile  |      **60** |           100 |            100 | 100 | 4,37 s |   0 | 636 ms |
| Detalhe (`/nft/nft-001`) | desktop |          98 |           100 |            100 | 100 | 1,02 s |   0 |  53 ms |

Ambiente: Lighthouse 13.5.0, HeadlessChrome 156, Node 26, Windows 11, Intel i7-8565U, 16 GB. Metas atingidas, exceto **Performance no perfil mobile** (57 e 60 contra a meta de 90).

**Abaixo da meta: Performance no perfil mobile.** Causas identificadas:

1. **O "servidor" roda na thread principal do navegador.** Antes da primeira tela, o app precisa baixar e iniciar o MSW, registrar o service worker e montar o banco simulado. Depois, **cada requisição da página** (API, imagens, chunks, fonte) faz uma ida e volta entre o service worker e a thread principal, onde é comparada com cerca de 40 handlers. Num celular simulado (CPU 4× mais lenta), isso soma centenas de milissegundos de bloqueio (TBT) e atrasa o LCP. Num backend real esse custo não existiria.
2. **SPA sem renderização no servidor:** o conteúdo principal (cards do catálogo, que são o elemento de LCP no mobile) só existe depois do JavaScript e da resposta da API.
3. **A medição local varia muito:** o Lighthouse multiplica por 4 o tempo de CPU observado. Na mesma configuração, medimos de 39 a 63 no mobile conforme a carga da máquina, e o LCP observado (sem simulação) fica em ~2,9 s.

**Otimizações feitas (valem para todos os usuários, sem simplificações exclusivas para a auditoria):**

- App e mocks baixados em paralelo, com `modulepreload` dos chunks no HTML.
- App shell estático no `index.html`, pintado antes do JavaScript.
- Checkboxes nativos nos filtros e barra lateral montada só no desktop. O `useSize` do Radix lê `offsetWidth` num layout effect e forçava um recálculo de layout da página por checkbox; o TBT mobile caiu de ~2,4 s para ~0,6 s na melhor medição.
- Herói renderiza só o layout atual, evitando baixar a imagem escondida por CSS.
- Seções abaixo da dobra renderizadas sob demanda (IntersectionObserver ou ocioso) e `content-visibility: auto`.
- Stub do `tough-cookie` no MSW: cerca de 120 KB gzip a menos antes da primeira tela.
- `Intl.Collator` único nas ordenações do catálogo simulado.
- Imagens WebP responsivas (`srcset` 400/800/1200), `width`/`height` declarados e `fetchpriority="high"` nas primeiras.
- `socket.io-client` e rotas carregados sob demanda.
- `main` com altura mínima de uma tela, o que zerou o CLS de 0,2 causado pelo rodapé durante o carregamento do detalhe.

**Testado e revertido:** embutir o CSS no HTML piorou o resultado. O carregador de chunks do Vite reinsere o `<link>` do CSS ao carregar rotas, e o navegador recalcula o estilo da página inteira.

**Próximos passos (fora do prazo):**

- Mover o servidor simulado para um Web Worker, liberando a thread principal.
- Pré-renderizar o HTML da Início no build.
- Trocar `zod` por `zod/mini` nos contratos.

## Desvios do Figma e decisões de UX

| Tema                            | Decisão                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marca                           | O layout usa a marca **Kurio** (a página do Figma se chama "GreenMint"); seguimos o que aparece nas telas.                                                                                                                                                                                                                                                                              |
| Assets                          | O arquivo tem só **4 artes de NFT** e o próprio layout as repete. Os 48 NFTs do seed reutilizam essas 4 artes, convertidas para WebP em 3 tamanhos. Logos de marcas (redes sociais, Google, Facebook) e o envelope "THANK YOU" foram exportados do Figma como SVG.                                                                                                                      |
| Mobile                          | Os frames mobile são estilo app: sem cabeçalho global, com barra inferior (Início, Favoritos, Busca, Carrinho, Perfil) e barra superior própria por tela. Seguimos isso abaixo de 1024 px. Tablet (768) usa o layout mobile com grade de 3 colunas.                                                                                                                                     |
| Botão central da barra inferior | No Figma não tem função definida; usamos para a busca.                                                                                                                                                                                                                                                                                                                                  |
| Busca no desktop                | O Figma tem só o ícone de busca; ele abre um diálogo e o resultado aparece no catálogo, com um chip para remover o termo.                                                                                                                                                                                                                                                               |
| Login e cadastro                | Modal sobre a Início no desktop (como no Figma) e página cheia no mobile. As rotas `/login` e `/cadastro` funcionam por acesso direto.                                                                                                                                                                                                                                                  |
| Filtros                         | Checkboxes (combináveis e com estado visível), coleções em ordem alfabética, campos de preço mínimo e máximo além do slider (sugestões dos comentários do Figma). Contadores mostram quantos itens cada filtro traria.                                                                                                                                                                  |
| Ordenação                       | O Figma não define as opções: Listados recentemente, Menor preço, Maior preço, Mais populares e Nome (A–Z).                                                                                                                                                                                                                                                                             |
| Paginação                       | Botão "anterior" aparece a partir da página 2.                                                                                                                                                                                                                                                                                                                                          |
| Edições                         | Chips como grupo de opções; edições esgotadas aparecem riscadas e desabilitadas. As miniaturas da galeria são visualizações do mesmo NFT (o seed não tem artes alternativas).                                                                                                                                                                                                           |
| Disponibilidade no detalhe      | "Disponível: X de Y · máximo de N por pedido" não existe no Figma, mas é exigida pelo enunciado. No desktop fica entre o seletor de quantidade e os botões, para a coluna manter a altura da galeria; no mobile, numa linha própria.                                                                                                                                                   |
| Margens no mobile               | 24 px na Início e no detalhe e 28 px no carrinho, no pagamento e no login/cadastro, como nos frames mobile.                                                                                                                                                                                                                                                                             |
| Regra da senha no cadastro      | O Figma não reserva espaço para ela: aparece com o campo de senha em foco ou no erro, e fica sempre ligada ao campo para leitores de tela.                                                                                                                                                                                                                                              |
| Tablet (768 px)                 | Layout mobile; no detalhe, a imagem é limitada a 480 px para o painel de compra aparecer na primeira tela.                                                                                                                                                                                                                                                                             |
| Painel de cenários              | Ferramenta de demonstração (não está no Figma): no mobile é uma aba estreita na margem esquerda, para não cobrir conteúdo; no desktop, um botão no canto inferior esquerdo.                                                                                                                                                                                                             |
| Carrinho                        | Linha mostra "ID do token · edição", porque o mesmo NFT pode estar em edições diferentes. O desenho tinha IDs inconsistentes entre carrinho e pagamento (apontado num comentário); usamos sempre o ID do token do NFT.                                                                                                                                                                  |
| Pagamento                       | O formulário do Figma mistura dados do colecionador e da carteira. Endereço e ENS/secundária vêm da carteira cadastrada (somente leitura) e "Usar outra carteira?" troca para a secundária. Abaixo das opções de "Carteira e rede" há um painel compacto de conexão (conectar, recusada, desconectar), que não existe no Figma. No mobile, os cartões de carteira têm o menu "⋮" do Figma (Editar carteira) e o formulário pré-preenchido vem depois do total. |
| Revisão do pedido               | Não existe no Figma; é um diálogo no mesmo padrão visual, exigido pelo enunciado (revisão e reconfirmação).                                                                                                                                                                                                                                                                             |
| Pedido pendente e recusado      | Só o confirmado está desenhado. Pendente e recusado reutilizam o mesmo modal (ícone, título e ações próprias).                                                                                                                                                                                                                                                                          |
| Perfil                          | Duas ações separadas, "Salvar" (dados) e "Salvar nova senha", em vez de um botão único, para que um erro de senha não bloqueie a edição do perfil e vice-versa.                                                                                                                                                                                                                         |
| Ações fora do escopo            | Criadores, Aprenda, Ler mais, Central de ajuda, Atividade, Ofertas, Arquivos baixados, Suporte, redes sociais, newsletter, "Esqueceu a senha?" e login social ficam visíveis, mas desabilitados (`aria-disabled`) com a dica "Disponível em breve", para não aparentarem sucesso funcional. Compartilhar (LinkedIn, Twitter, e-mail) e contato (`mailto:`/`tel:`) funcionam de verdade. |

Os comentários do arquivo Figma são de outros candidatos, não da empresa (nenhum tem resposta); usamos os que melhoram usabilidade e acessibilidade, como registrado acima.

## Testes

Playwright contra o build de produção com mocks, em Chromium desktop (1440) e mobile (390). Cada teste parte de um contexto novo, ou seja, do seed do servidor simulado. Os testes de tempo real disparam mudanças no servidor simulado (`window.__kurioMocks`), que chegam ao app pelo `socket.io-client`; os de REST passam pelos handlers do MSW. A expiração de sessão usa o relógio controlado (`page.clock`), e latências e falhas pontuais usam `delayNext` e `failNext`.

| #   | Cenário do enunciado                                          | Arquivo                          |
| --- | ------------------------------------------------------------- | -------------------------------- |
| 1   | Busca, filtros combinados, ordenação, paginação e histórico   | `01-catalog.spec.ts`             |
| 2   | Acesso direto ao detalhe e recurso inexistente                | `02-detail.spec.ts`              |
| 3   | Cadastro, login, expiração, logout e troca de usuário         | `03-auth.spec.ts`                |
| 4   | Favoritos com falha de mutation e recuperação                 | `04-favorites.spec.ts`           |
| 5   | Carrinho, quantidades, remoção, cupom, refresh e login        | `05-cart.spec.ts`                |
| 6   | Compra completa até o recibo confirmado                       | `06-purchase.spec.ts`            |
| 7   | Pagamento recusado, clique repetido, timeout com recuperação, repetições esgotadas, refresh no meio do envio e pedido pendente | `07-payment-failures.spec.ts`    |
| 8   | Perfil, avatar, senha e carteiras com validação               | `08-account.spec.ts`             |
| 9   | Preço/disponibilidade via Socket.IO durante o checkout (revisão atualizada pelo evento e recusa do servidor com o socket caído) | `09-realtime-checkout.spec.ts`   |
| 10  | Eventos duplicados/antigos, desconexão e pedido pendente      | `10-realtime-resilience.spec.ts` |
| 11  | Teclado, foco em diálogos e validação                         | `11-a11y.spec.ts`                |
| 12  | Skeletons, falha e nova tentativa (inclui cotação com erro e service worker encerrado pelo navegador) | `12-loading.spec.ts`             |
| —   | Sem overflow horizontal em 390, 720, 768 e 1440 px            | `13-responsive.spec.ts`          |
| —   | Regressão visual (Início, Detalhe, Carrinho, Pagamento) em desktop (1440) e mobile (390) | `tests/visual/`                  |

Relatório HTML em `playwright-report/`; traces e screenshots das falhas em `test-results/` (`trace: 'retain-on-failure'`).

O teste de eventos duplicados atrasa o recarregamento do carrinho para que um evento reaplicado gerasse um segundo aviso: ele falha se a proteção (`EventGuard`) for removida. As baselines visuais são por plataforma (ver [Limitações](#limitações-e-o-que-ficou-de-fora)).

## Limitações e o que ficou de fora

- **Performance mobile abaixo de 90** pelos motivos detalhados [acima](#performance-e-lighthouse).
- **Servidor simulado por aba**, sem sincronizar eventos entre abas (ver [Servidor simulado](#servidor-simulado-msw)).
- **Login social, recuperação de senha, newsletter e páginas editoriais** estão fora do escopo do enunciado e ficam desabilitados.
- **Avaliações de colecionadores:** só a nota média e a contagem; comentários individuais estão fora do escopo.
- **Galeria:** as 4 miniaturas usam a mesma arte, porque o arquivo do Figma não tem variações.
- **"Mais desta coleção" / "Colecionadores também viram"** mostram primeiro os NFTs da mesma categoria e completam com os mais populares, sem algoritmo de recomendação. O carrossel tem 5 cartões por página e pontos de paginação; no mobile a lista rola na horizontal.
- **Segurança simplificada no mock:** token em `localStorage` (num backend real, cookie `HttpOnly`) e hash de senha com SHA-256 + salt (num backend real, bcrypt/argon2).
- **Testes só em Chromium**, como pede o enunciado; Firefox e WebKit não foram verificados.
- **Baselines visuais só para Windows.** A renderização de fontes muda entre sistemas, então as baselines ficam em `tests/visual/__screenshots__/<projeto>/<plataforma>/`. Em outra plataforma, os testes visuais são pulados com a instrução para gerar as baselines (`npm run test:visual:update`), em vez de falharem por antialiasing.
