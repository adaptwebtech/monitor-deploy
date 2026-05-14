# CODEBASE.md — Pipeline Monitor

Mapa autoritativo da estrutura do projeto. Leia antes de qualquer ciclo de feature.

---

## Estrutura de Diretórios

```
monitor_deploy/
├── server/                          # NestJS 11 API
│   ├── src/
│   │   ├── app.module.ts            # Raiz; registra APP_GUARD=ApiKeyGuard global
│   │   ├── main.ts                  # Bootstrap NestJS; ValidationPipe global; Swagger em /docs
│   │   ├── auth/
│   │   │   ├── auth.controller.ts   # POST /auth/login, POST /auth/refresh
│   │   │   ├── auth.service.ts      # login(), refresh()
│   │   │   ├── auth.module.ts       # Exporta AuthService, JwtModule
│   │   │   ├── api-key.guard.ts     # Guard global; bypass se Bearer present; valida header apikey
│   │   │   ├── jwt-auth.guard.ts    # JwtAuthGuard (Passport JWT)
│   │   │   ├── jwt.strategy.ts      # Estratégia Passport; extrai user do JWT
│   │   │   ├── decorators/
│   │   │   │   └── skip-api-key.decorator.ts   # @SkipApiKey() — isenta rota do ApiKeyGuard
│   │   │   └── dto/
│   │   │       ├── login.dto.ts
│   │   │       ├── refresh.dto.ts
│   │   │       ├── auth-response.dto.ts         # AuthResponseDto, UserResponseInAuthDto
│   │   │       └── jwt-payload.dto.ts           # interface JwtPayload { sub, email, root }
│   │   ├── users/
│   │   │   ├── users.controller.ts  # POST, GET, GET/:id, PATCH/:id, DELETE/:id, POST/:id/regenerate-token
│   │   │   ├── users.service.ts     # CRUD + findByEmail + findByGithubId + regenerateToken
│   │   │   ├── users.module.ts      # Exporta UsersService
│   │   │   └── dto/
│   │   │       ├── create-user.dto.ts
│   │   │       ├── update-user.dto.ts           # PartialType(CreateUserDto)
│   │   │       ├── user-query.dto.ts            # page, limit, search, del
│   │   │       └── user-response.dto.ts         # Sem password/salt/refreshToken
│   │   ├── webhook/
│   │   │   ├── webhook.controller.ts  # POST /webhook — fire and forget via setImmediate
│   │   │   ├── webhook.service.ts     # handleEvent(dto) — switch por event type
│   │   │   ├── webhook.module.ts      # Importa PipelineQueueModule, PipelineStepsModule, GatewayModule, UsersModule
│   │   │   └── dto/
│   │   │       └── webhook-event.dto.ts
│   │   ├── pipeline-queue/
│   │   │   ├── pipeline-queue.controller.ts  # GET, GET/mine, GET/:id, PATCH/:id, DELETE/:id
│   │   │   ├── pipeline-queue.service.ts     # findAll, findMine, findByCommit, findById, create, update, softDelete
│   │   │   ├── pipeline-queue.module.ts      # Exporta PipelineQueueService
│   │   │   └── dto/
│   │   │       ├── create-pipeline-queue.dto.ts
│   │   │       ├── update-pipeline-queue.dto.ts
│   │   │       ├── pipeline-queue-query.dto.ts
│   │   │       └── pipeline-queue-response.dto.ts
│   │   ├── pipeline-steps/
│   │   │   ├── pipeline-steps.controller.ts  # GET (paginado ou all), GET/:id
│   │   │   ├── pipeline-steps.service.ts     # findAllByQueue, findById, create
│   │   │   ├── pipeline-steps.module.ts      # Exporta PipelineStepsService
│   │   │   └── dto/
│   │   │       ├── create-pipeline-step.dto.ts
│   │   │       ├── pipeline-step-response.dto.ts
│   │   │       └── pipeline-steps-query.dto.ts
│   │   ├── dashboard/
│   │   │   ├── dashboard.controller.ts  # GET /dashboard/kpis
│   │   │   ├── dashboard.service.ts     # getKpis(query) — queries diretas via PrismaService
│   │   │   ├── dashboard.module.ts
│   │   │   └── dto/
│   │   │       ├── kpis-query.dto.ts    # dateStart, dateEnd (ambos obrigatórios)
│   │   │       └── kpis-response.dto.ts # total, succeeded, failed, errorRate
│   │   ├── gateway/
│   │   │   ├── pipeline.gateway.ts   # @WebSocketGateway namespace=/pipeline; emitPipelineCreated/Updated
│   │   │   └── gateway.module.ts     # Exporta PipelineGateway
│   │   └── prisma/
│   │       ├── prisma.service.ts     # @Global; PrismaClient com @prisma/adapter-pg + pg.Pool
│   │       └── prisma.module.ts      # @Global; exporta PrismaService
│   ├── prisma/
│   │   ├── schema.prisma             # models: User, PipelineQueue, PipelineStep (sem url — Prisma 7)
│   │   └── migrations/               # Pasta de migrations gerenciada pelo Prisma
│   ├── prisma.config.ts              # Prisma 7 CLI config; carrega .env via dotenv para CLI local
│   ├── Dockerfile                    # Multi-stage: builder(node:20-alpine) → runner(node:20-alpine)
│   ├── .dockerignore
│   ├── .env                          # DATABASE_URL com localhost (CLI local); não commitar
│   └── package.json
│
├── frontend/                         # Vue 3 + Vite + Pinia + Vue Router 4
│   ├── src/
│   │   ├── main.ts                   # Bootstrap Vue; registra Pinia + Router
│   │   ├── App.vue                   # Root component
│   │   ├── types/index.ts            # Interfaces: User, PipelineQueue, KpiStats, PaginatedResponse
│   │   ├── router/index.ts           # Rotas: login, dashboard, profile, users; guards requiresAuth/requiresRoot
│   │   ├── stores/
│   │   │   ├── auth.store.ts         # login, logout, refresh, updateProfile; persiste em localStorage
│   │   │   ├── dashboard.store.ts    # pipelines, kpis, dateRange; handleSocketCreated/Updated
│   │   │   ├── users.store.ts        # fetchUsers, updateUser, deleteUser, regenerateToken
│   │   │   └── profile.store.ts      # fetchHistory (GET /pipeline-queue/mine)
│   │   ├── lib/
│   │   │   └── apiFetch.ts           # Wrapper fetch: auto-refresh JWT expirado; injeta Bearer; redireciona login se sessão expirar
│   │   ├── composables/
│   │   │   └── usePipelineSocket.ts  # socket.io-client; conecta /pipeline; expõe onCreated, onUpdated, disconnect
│   │   ├── views/
│   │   │   ├── LoginView.vue         # Layout split; chama authStore.login()
│   │   │   ├── DashboardView.vue     # Carrega pipelines + KPIs; conecta WS ao montar
│   │   │   ├── ProfileView.vue       # Edição de perfil + histórico de pipelines
│   │   │   └── UsersView.vue         # Root only; CRUD de usuários via usersStore
│   │   └── components/
│   │       ├── AppLayout.vue         # Wrapper com SideMenu (desktop) + BottomMenu (mobile); botão Sair (logout + redirect login) em ambos menus
│   │       ├── DateRangeFilter.vue   # Controla dateRange no dashboardStore
│   │       ├── RunningIndicator.vue  # Indicador piscante do pipeline em Running
│   │       ├── KpiCards.vue          # 4 cards KPI (Total, Succeeded, Failed, Taxa de Erro)
│   │       ├── PipelineTable.vue     # Tabela paginada; colunas: avatar→author→app→env→sha→msg→status
│   │       ├── AvatarCell.vue        # Imagem circular + fallback iniciais
│   │       ├── StatusBadge.vue       # Badge colorido por status
│   │       ├── EditUserModal.vue     # <Teleport to="body">; emits: saved(User), closed()
│   │       └── __tests__/
│   │           └── AppLayout.spec.ts # Vitest: testa botão Sair (logout + redirect) em SideMenu e BottomMenu
│   ├── e2e/                          # Playwright E2E tests
│   ├── public/
│   │   └── config.js.template        # Template nginx com ${API_URL}, ${WS_URL}; gerado em runtime
│   ├── nginx.conf                    # nginx: resolver 127.0.0.11; proxy /api/ → http://api:3000
│   ├── docker-entrypoint.sh          # envsubst de config.js.template → config.js
│   ├── Dockerfile                    # Multi-stage: builder(node:20-alpine) → runner(nginx:alpine)
│   └── .dockerignore
│
├── k8s/
│   ├── base/
│   │   ├── kustomization.yaml
│   │   ├── api-deployment.yaml       # Deployment: api; image: registry.../api:base; port 3000
│   │   ├── api-service.yaml          # Service: api; ClusterIP :3000
│   │   ├── vue-deployment.yaml       # Deployment: vue-app; image: registry.../vue-app:base; port 80
│   │   ├── vue-service.yaml          # Service: vue-app; ClusterIP :80
│   │   ├── postgres-deployment.yaml  # Deployment: postgres; postgres:16-alpine; PVC
│   │   ├── postgres-service.yaml     # Service: postgres; ClusterIP :5432
│   │   ├── postgres-pv.yaml          # PV: postgres-data-pv; hostPath 5Gi
│   │   ├── postgres-pvc.yaml         # PVC: postgres-data-pvc
│   │   ├── redis-deployment.yaml     # Deployment: redis; redis:7-alpine; PVC
│   │   ├── redis-service.yaml        # Service: redis; ClusterIP :6379
│   │   ├── redis-pv.yaml             # PV: redis-data-pv; hostPath 1Gi
│   │   ├── redis-pvc.yaml            # PVC: redis-data-pvc
│   │   ├── env-configmap.yaml        # ConfigMap: env-config (PORT=3000, NODE_ENV, REDIS_URL)
│   │   └── docker-registry-secret.yaml  # Secret: registry-secret (imagePullSecrets)
│   ├── overlays/
│   │   ├── development/              # Namespace: monitor-deploy-dev; tag: development
│   │   ├── staging/                  # Namespace: monitor-deploy-staging; tag: staging
│   │   └── production/              # Namespace: monitor-deploy-production; tag: SHA (40 chars)
│   └── validate/
│       ├── validate-base.sh
│       ├── validate-overlays.sh
│       └── smoke-test.sh
│
├── docs/
│   ├── specs/pipeline-monitor.md      # Spec Phase 1
│   ├── implementation/pipeline-monitor.md  # Doc Phase 4
│   └── CODEBASE.md                   # Este arquivo
│
├── docker-compose.yml                # Local dev: postgres(:5432) + redis(:6379) + api(:3000) + vue(:9065)
└── .env                              # DATABASE_URL localhost; JWT secrets; API_KEY — não commitar
```

---

## Grafo de Módulos (Backend)

```
AppModule
├── ConfigModule (global)
├── PrismaModule (global) → exports PrismaService
├── AuthModule → imports UsersModule; exports AuthService, JwtModule
├── UsersModule → exports UsersService
├── WebhookModule → imports PipelineQueueModule, PipelineStepsModule, GatewayModule, UsersModule
├── PipelineQueueModule → exports PipelineQueueService
├── PipelineStepsModule → exports PipelineStepsService
├── DashboardModule (usa PrismaService global direto)
└── GatewayModule → exports PipelineGateway
```

---

## Schema Prisma

**Models:** `User` (tabela `users`), `PipelineQueue` (tabela `pipeline_queue`), `PipelineStep` (tabela `pipeline_steps`)

**Enums:** `Environment { development, staging, production }`, `PipelineStatus { Queued, Running, Completed, Failed }`

**Chave composta única:** `pipeline_queue @@unique([commitSha, app, environment])` — usada pelo webhook handler para lookup.

---

## Fluxo de Request

```
HTTP Request
  → ApiKeyGuard (global APP_GUARD)
      bypass se Authorization: Bearer present
      bypass se @SkipApiKey() na rota/controller
      valida header apikey contra API_KEY env
  → JwtAuthGuard (onde @UseGuards(JwtAuthGuard) aplicado)
      valida JWT Bearer; injeta req.user = { id, email, root }
  → Controller (thin — apenas mapeamento HTTP)
  → Service (lógica de negócio — usa PrismaService diretamente)
  → PrismaService → PostgreSQL
```

---

## Variáveis de Ambiente

| Chave | Onde | Notas |
|---|---|---|
| `DATABASE_URL` | `.env` + compose `environment` | `.env` = localhost; compose sobrescreve para `postgres` (hostname Docker) |
| `JWT_ACCESS_SECRET` | `.env` | Fallback hardcoded em auth.module.ts |
| `JWT_REFRESH_SECRET` | `.env` | Fallback hardcoded em users.service.ts |
| `JWT_ACCESS_EXPIRES` | `.env` | Não lido — `15m` hardcoded em auth.service.ts |
| `API_KEY` | `.env` | Valor padrão: `bWludGluaG8=` |
| `PORT` | `.env` | Default NestJS 3000 |
| `REDIS_URL` | ConfigMap k8s | Não consumido pelo backend atualmente |
| `API_URL` | `window.config` (runtime) | URL base da API REST no frontend |
| `WS_URL` | `window.config` (runtime) | URL base WebSocket no frontend |

---

## Scripts npm

### Backend (`server/`)
| Script | Comando |
|---|---|
| `npm test` | Jest unit + integration |
| `npm run test:e2e` | Jest + Supertest e2e |
| `npm run lint` | ESLint |
| `npm run build` | `tsc` → `dist/` |
| `npx prisma generate` | Gera Prisma Client |
| `npx prisma migrate dev` | Nova migration (dev) |
| `npx prisma migrate deploy` | Aplica migrations (prod/Docker) |

### Frontend (`frontend/`)
| Script | Comando |
|---|---|
| `npm run test:unit` | Vitest |
| `npm run lint` | ESLint |
| `npm run build` | Vite build → `dist/` |
| `npx playwright test` | E2E Playwright |

---

## Tipos Centrais (Frontend)

```ts
// frontend/src/types/index.ts
interface User { id, name, email, profilePictureUrl, githubId, root, del, createdAt?, updatedAt? }
interface PipelineQueue { id, id_user?, event?, app, environment, commitSha, commitMessage, commitAuthor, commitAuthorAvatar, commitAuthorId?, status, del?, createdAt, updatedAt }
interface KpiStats { total, succeeded, failed, errorRate }
interface PaginatedResponse<T> { data: T[], total, page?, limit? }
// window.config: { API_URL: string, WS_URL: string, API_KEY?: string }
```
