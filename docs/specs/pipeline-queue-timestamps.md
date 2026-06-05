# Pipeline Queue Timestamps

## 1. Contexto

`pipeline_queue` registra ciclo de vida de cada pipeline. Atualmente expõe apenas `createdAt` (momento do enqueue). Não há como saber quando execução efetivamente começou (`started_at`) ou terminou (`finalized_at`). Esses dados são essenciais para medir tempo de espera na fila, duração da execução e detectar gargalos. Dashboard e Perfil precisam exibir as três marcações temporais: **Criado** (enqueue), **Início** (primeiro step fora da fila) e **Fim** (conclusão ou falha).

---

## 2. Escopo

**In scope:**
- Adicionar colunas `started_at` e `finalized_at` (nullable) ao schema `pipeline_queue` via migration Prisma.
- Backend: setar `started_at` quando `WebhookService` transiciona pipeline de `Queued → Running`.
- Backend: setar `finalized_at` quando pipeline transiciona para `Completed` ou `Failed` (via webhook ou `WorkflowCleanupService`).
- `PipelineQueueResponseDto` expõe `startedAt: Date | null` e `finalizedAt: Date | null`.
- Frontend: tipo `PipelineQueue` adiciona `startedAt` e `finalizedAt`.
- Frontend: `PipelineTable.vue` renomeia coluna de data existente para **Criado**; adiciona colunas **Início** e **Fim** (exibe `–` se null).
- Frontend: `ProfileView.vue` (tabela de histórico) exibe as mesmas três colunas.
- Frontend: WebSocket `pipeline.updated` atualiza `startedAt`/`finalizedAt` reativamente nas tabelas.

**Out of scope:**
- Alterações em `KpiCards` ou lógica de KPIs.
- `ScheduledCleanupService` (faz hard delete de registros antigos — não seta `finalized_at`).
- Novos endpoints HTTP (campos chegam pelos já existentes).
- Alterações em manifests k8s.

---

## 3. Glossário

| Termo | Definição |
|---|---|
| `startedAt` | Timestamp em que o primeiro step não-queue foi recebido pelo backend (pipeline transiciona para `Running`). |
| `finalizedAt` | Timestamp em que o pipeline atingiu estado terminal (`Completed` ou `Failed`), seja via webhook ou cronjob de timeout. |
| `Criado` | Label de UI para `createdAt` (momento do enqueue). |
| `Início` | Label de UI para `started_at`. |
| `Fim` | Label de UI para `finalized_at`. |

---

## 4. Requisitos Funcionais

- **FR-1:** Schema `pipeline_queue` adiciona `startedAt DateTime?` e `finalizedAt DateTime?`, ambos `@default(null)`.
- **FR-2:** `WebhookService` seta `startedAt = now()` ao atualizar `PipelineQueue.status` para `Running` (transição `Queued → Running`). Só seta se `startedAt` ainda é `null`.
- **FR-3:** `WebhookService` seta `finalizedAt = now()` ao atualizar `PipelineQueue.status` para `Completed` ou `Failed`.
- **FR-4:** `WorkflowCleanupService` seta `finalizedAt = now()` ao marcar pipelines expirados como `Failed` (cron de timeout). Só seta se `finalizedAt` ainda é `null`.
- **FR-5:** `PipelineQueueResponseDto` expõe `startedAt: Date | null` e `finalizedAt: Date | null` com decorators Swagger PT-BR.
- **FR-6:** Tipo frontend `PipelineQueue` (`frontend/src/types/index.ts`) adiciona `startedAt: string | null` e `finalizedAt: string | null`.
- **FR-7:** `PipelineTable.vue` exibe três colunas temporais: **Criado** (`createdAt`), **Início** (`startedAt` ou `–`), **Fim** (`finalizedAt` ou `–`).
- **FR-8:** Tabela de histórico em `ProfileView.vue` exibe as mesmas três colunas (**Criado**, **Início**, **Fim**).
- **FR-9:** Quando `pipeline.updated` chega via WebSocket, as colunas **Início** e **Fim** atualizam reativamente sem recarregar a página.

---

## 5. Requisitos Não-Funcionais

- **NFR-1:** Migration backward-compatible — campos nullable sem default forçado; registros existentes ficam com `NULL`.
- **NFR-2:** `startedAt` setado em único `prisma.pipelineQueue.update` idempotente (check `startedAt == null`).
- **NFR-3:** Sem N+1: campos incluídos no `select`/`include` já existente de `PipelineQueueService`.
- **NFR-4:** Formatação de data no frontend consistente com padrão existente de `createdAt`.

---

## 6. Modelo de Dados

```mermaid
erDiagram
    PipelineQueue {
        string id PK "uuid"
        string id_user FK "nullable"
        string event
        string app
        Environment environment
        string commitSha
        string commitMessage
        string commitAuthor
        string commitAuthorAvatar
        string commitAuthorId "nullable"
        PipelineStatus status "Queued|Running|Completed|Failed"
        boolean del "default false"
        datetime createdAt
        datetime updatedAt
        datetime startedAt "nullable — default null NOVO"
        datetime finalizedAt "nullable — default null NOVO"
    }
```

| Campo | Tipo Prisma | Nullable | Default | Índice |
|---|---|---|---|---|
| `startedAt` | `DateTime` | sim | `null` | não |
| `finalizedAt` | `DateTime` | sim | `null` | não |

**Migration:** `npx prisma migrate dev --name add_timestamps_to_pipeline_queue`

---

## 7. Contrato de API

### Campos novos em `PipelineQueueResponseDto`

```ts
startedAt: Date | null   // mapeado de started_at
finalizedAt: Date | null // mapeado de finalized_at
```

Todos os endpoints existentes que retornam `PipelineQueueResponseDto` passam a incluir os novos campos:

| Endpoint | Mudança |
|---|---|
| `GET /pipeline-queue` | inclui `startedAt`, `finalizedAt` |
| `GET /pipeline-queue/:id` | inclui `startedAt`, `finalizedAt` |
| `GET /pipeline-queue/mine` | inclui `startedAt`, `finalizedAt` |
| `PATCH /pipeline-queue/:id` | resposta inclui `startedAt`, `finalizedAt` |

**Nenhum endpoint novo.** Nenhuma rota Vue nova.

---

## 8. Limites de Módulo

```mermaid
classDiagram
    class WebhookService {
        +handleEvent(dto) void
        -setStartedAt(id, prisma) void
        -setFinalizedAt(id, prisma) void
    }
    class WorkflowCleanupService {
        +runCleanup() void
        -setFinalizedAt(ids[]) void
    }
    class PipelineQueueService {
        +findAll() PipelineQueueResponseDto[]
        +findMine() PipelineQueuePaginatedResponseDto
        +findOne() PipelineQueueResponseDto
    }
    class PipelineQueueResponseDto {
        +startedAt Date|null
        +finalizedAt Date|null
    }
    WebhookService --> PipelineQueueService : usa prisma direto
    WorkflowCleanupService --> PipelineQueueService : usa prisma direto
    PipelineQueueService --> PipelineQueueResponseDto : retorna
```

---

## 9. Fluxos

### Fluxo 1 — Primeiro step recebido (Queued → Running)

```mermaid
sequenceDiagram
    participant CI as CI/CD
    participant WH as WebhookController
    participant WS_SVC as WebhookService
    participant DB as PostgreSQL
    participant GW as PipelineGateway
    participant FE as Frontend (WS)

    CI->>WH: POST /webhook {step: primeiro step}
    WH->>WS_SVC: handleEvent(dto)
    WS_SVC->>DB: pipelineQueue.update(status=Running, startedAt=now())
    WS_SVC->>DB: pipelineStep.create(...)
    WS_SVC->>GW: emit pipeline.updated {startedAt: now, ...}
    GW-->>FE: pipeline.updated
    FE->>FE: atualiza linha na tabela (coluna Início = data)
```

### Fluxo 2 — Step final recebido (Running → Completed/Failed)

```mermaid
sequenceDiagram
    participant CI as CI/CD
    participant WH as WebhookController
    participant WS_SVC as WebhookService
    participant DB as PostgreSQL
    participant GW as PipelineGateway
    participant FE as Frontend (WS)

    CI->>WH: POST /webhook {step: step final}
    WH->>WS_SVC: handleEvent(dto)
    WS_SVC->>DB: pipelineQueue.update(status=Completed|Failed, finalizedAt=now())
    WS_SVC->>DB: pipelineStep.create(...)
    WS_SVC->>GW: emit pipeline.updated {finalizedAt: now, ...}
    GW-->>FE: pipeline.updated
    FE->>FE: atualiza linha na tabela (coluna Fim = data)
```

### Fluxo 3 — Timeout (WorkflowCleanupService)

```mermaid
sequenceDiagram
    participant CRON as Cron (5min)
    participant WC as WorkflowCleanupService
    participant DB as PostgreSQL
    participant GW as PipelineGateway
    participant FE as Frontend (WS)

    CRON->>WC: runCleanup()
    WC->>DB: query Running expirados (> 60 min)
    WC->>DB: pipelineQueue.updateMany(status=Failed, finalizedAt=now() WHERE finalizedAt IS NULL)
    WC->>GW: emit pipeline.updated por cada pipeline afetado
    GW-->>FE: pipeline.updated
    FE->>FE: atualiza coluna Fim nas linhas afetadas
```

---

## 10. Máquinas de Estado

```mermaid
stateDiagram-v2
    [*] --> Queued : webhook cria pipeline\nstartedAt=null, finalizedAt=null

    Queued --> Running : primeiro step recebido\nstartedAt=now()

    Running --> Completed : step final success\nfinalizedAt=now()
    Running --> Failed : step final failure\nfinalizedAt=now()
    Running --> Failed : WorkflowCleanupService timeout\nfinalizedAt=now() if null

    Completed --> [*]
    Failed --> [*]
```

---

## 11. Regras de Negócio

```mermaid
flowchart TD
    A[WebhookService recebe evento] --> B{status destino?}
    B --> |Running| C{startedAt == null?}
    C --> |sim| D[startedAt = now]
    C --> |não| E[não alterar startedAt]
    D --> F[persistir + emitir WS]
    E --> F

    B --> |Completed ou Failed| G{finalizedAt == null?}
    G --> |sim| H[finalizedAt = now]
    G --> |não| I[não alterar finalizedAt]
    H --> F
    I --> F

    B --> |outro status| F
```

---

## 12. Edge Cases e Tratamento de Erros

- **Pipeline já com `startedAt` setado:** Se webhook enviar Running novamente (retry), `startedAt` não é sobrescrito (check `startedAt == null`).
- **Pipeline já com `finalizedAt` setado:** WorkflowCleanupService usa `WHERE finalizedAt IS NULL` para não sobrescrever valor já definido via webhook.
- **Registros históricos:** `startedAt` e `finalizedAt` serão `null` para pipelines anteriores à migration. Frontend exibe `–` para null.
- **Webhook recebe Completed sem passar por Running:** `startedAt` permanece null; `finalizedAt` é setado normalmente.
- **Pipeline deletado (soft delete `del=true`):** `ScheduledCleanupService` faz hard delete após 30 dias — não seta `finalized_at` (out of scope).

---

## 13. Critérios de Aceitação

- **AC-1** `[backend]`: Dado schema migrado, quando inspecionar `pipeline_queue` no banco, então colunas `startedAt` e `finalizedAt` existem como `TIMESTAMP? DEFAULT NULL`.

- **AC-2** `[backend]`: Dado pipeline em status `Queued` com `startedAt = null`, quando `WebhookService` processar evento que transiciona para `Running`, então `startedAt` é setado para `now()` e persiste no banco.

- **AC-3** `[backend]`: Dado pipeline em status `Running`, quando `WebhookService` processar evento que transiciona para `Completed`, então `finalizedAt` é setado para `now()`.

- **AC-4** `[backend]`: Dado pipeline em status `Running`, quando `WebhookService` processar evento que transiciona para `Failed`, então `finalizedAt` é setado para `now()`.

- **AC-5** `[backend]`: Dado pipeline com `startedAt` já setado, quando webhook processar segundo evento `Running` (retry), então `startedAt` não é sobrescrito.

- **AC-6** `[backend]`: Dado pipeline `Running` expirado com `finalizedAt = null`, quando `WorkflowCleanupService` rodar, então `finalizedAt` é setado para o momento da execução do cron.

- **AC-7** `[backend]`: Dado pipeline com `finalizedAt` já setado, quando `WorkflowCleanupService` tentar setar novamente, então `finalizedAt` não é sobrescrito.

- **AC-8** `[backend]`: Dado `GET /pipeline-queue`, quando autenticado, então resposta inclui `startedAt` e `finalizedAt` por item.

- **AC-9** `[backend]`: Dado `GET /pipeline-queue/mine`, quando autenticado, então paginação inclui `startedAt` e `finalizedAt` por item.

- **AC-10** `[frontend]`: Dado tipo `PipelineQueue` em `frontend/src/types/index.ts`, então inclui campos `startedAt: string | null` e `finalizedAt: string | null` (consistente com `createdAt: string`).

- **AC-11** `[frontend]`: Dado `PipelineTable.vue` renderizado com pipeline, quando `startedAt` é não-null, então coluna **Início** exibe data formatada.

- **AC-12** `[frontend]`: Dado `PipelineTable.vue` renderizado com pipeline, quando `startedAt` é null, então coluna **Início** exibe `–`.

- **AC-13** `[frontend]`: Dado `PipelineTable.vue` renderizado com pipeline, quando `finalizedAt` é null, então coluna **Fim** exibe `–`.

- **AC-14** `[frontend]`: Dado `PipelineTable.vue`, então coluna de data existente usa label **Criado** (referente a `createdAt`).

- **AC-15** `[frontend]`: Dado `ProfileView.vue` com histórico de pipelines, então tabela exibe colunas **Criado**, **Início**, **Fim** com mesmas regras de exibição.

- **AC-16** `[frontend]`: Dado pipeline em `Running` no dashboard, quando `pipeline.updated` chegar via WebSocket com `startedAt` preenchido, então coluna **Início** atualiza sem recarregar página.

- **AC-17** `[frontend]`: Dado pipeline em `Running` no dashboard, quando `pipeline.updated` chegar via WebSocket com `finalizedAt` preenchido, então coluna **Fim** atualiza sem recarregar página.

- **AC-18** `[e2e]`: Dado webhook enviando step que transiciona para Running, quando usuário observar dashboard no browser, então coluna **Início** exibe data em tempo real.

---

## 14. Questões Abertas

Nenhuma.

---

## 15. Hierarquia de Componentes Frontend

```mermaid
graph TD
    DV[DashboardView.vue]
    PV[ProfileView.vue]
    PT[PipelineTable.vue]
    WS[usePipelineSocket.ts]
    DS[dashboard.store.ts]
    PS[profile.store.ts]
    TI[types/index.ts]

    DV --> PT
    PV --> PT
    DV --> WS
    WS --> DS
    DS --> PT
    PS --> PT
    PT -.->|startedAt, finalizedAt| TI

    subgraph "Colunas modificadas em PipelineTable"
        C1["Criado (createdAt)"]
        C2["Início (startedAt | –)"]
        C3["Fim (finalizedAt | –)"]
    end

    PT --- C1
    PT --- C2
    PT --- C3
```

---

## 16. Topologia de Infra

N/A — sem alterações em manifests k8s. Migration aplicada via `prisma migrate deploy` no startup do container (processo existente).
