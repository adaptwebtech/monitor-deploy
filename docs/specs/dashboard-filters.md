# Dashboard Filters

## 1. Context

O dashboard exibe KPIs e lista de pipelines filtrados apenas por intervalo de datas. Em ambientes com múltiplos apps e ambientes (development/staging/production), o usuário não consegue isolar métricas por app, ambiente ou status sem sair da tela. Esta feature adiciona filtros por `app`, `ambiente` e `status` que afetam simultaneamente os cards de KPI e a lista de pipelines.

**Usuários-alvo:** engenheiros e tech leads que monitoram deploys de múltiplos apps.

---

## 2. Scope

**In scope:**
- Filtro por `app` (texto livre, match exato, debounce 400 ms)
- Filtro por `ambiente` (select: development / staging / production)
- Filtro por `status` (select: Queued / Running / Completed / Failed)
- KPI cards refletem o escopo filtrado
- Lista de pipelines reflete os filtros (reutiliza params já suportados pelo `/pipeline-queue`)
- Botão "Limpar filtros" restaura estado inicial
- Filtros combinam com `dateStart`/`dateEnd` existente (AND lógico)
- WebSocket: `onCreated` só prepende pipeline se bate com filtros ativos
- WebSocket: `onUpdated` remove pipeline da lista se após update não bate mais com filtros

**Out of scope:**
- Multi-select de app / status / ambiente
- Filtro por autor ou commitSha
- Persistência de filtros em URL ou localStorage
- Novo endpoint para listar apps distintos (autocomplete)
- Mudança na lógica de paginação ou infinite scroll
- Filtros na view de Perfil (`/pipeline-queue/mine`)

---

## 3. Glossário

| Termo | Definição |
|---|---|
| ambiente | Campo `environment` no schema Prisma (`development`/`staging`/`production`) |
| filtro ativo | Filtro com valor não-nulo/não-vazio selecionado pelo usuário |
| escopo filtrado | Subconjunto de pipelines que satisfaz todos os filtros ativos simultaneamente |

---

## 4. Functional Requirements

- **FR-1:** `GET /dashboard/kpis` aceita parâmetros opcionais `app` (string), `environment` (enum) e `status` (enum); quando presentes, as três contagens (total, succeeded, failed) são restritas ao escopo filtrado.
- **FR-2:** `GET /dashboard/kpis` sem os novos parâmetros mantém comportamento atual (compatibilidade retroativa).
- **FR-3:** O frontend exibe um `DashboardFilterBar` com: campo de texto para `app`, select para `ambiente`, select para `status`.
- **FR-4:** Qualquer mudança em filtro dispara refetch de KPIs e refetch da lista (página 1, `loadMore` resetado).
- **FR-5:** Filtro `app` usa debounce de 400 ms antes de disparar refetch.
- **FR-6:** Botão "Limpar filtros" visível quando ao menos um filtro estiver ativo; ao clicar, limpa todos os filtros e refaz fetch.
- **FR-7:** Todos os filtros combinam com `dateStart`/`dateEnd` por AND lógico.
- **FR-8:** Evento WebSocket `pipeline.created`: pipeline é pré-pendado na lista somente se todos os filtros ativos corresponderem ao payload recebido.
- **FR-9:** Evento WebSocket `pipeline.updated`: se pipeline já estiver na lista mas após update não satisfizer filtros ativos, é removido. Se satisfizer, permanece atualizado in-place.
- **FR-10:** Ao reconectar WebSocket, refetch usa filtros ativos correntes.

---

## 5. Non-Functional Requirements

- **NFR-1:** Latência adicional de `/dashboard/kpis` com novos params ≤ 50 ms sobre baseline (índice Prisma em `app` + `environment` + `status` existente).
- **NFR-2:** Debounce de 400 ms no filtro `app` evita burst de requests durante digitação.
- **NFR-3:** Nenhum filtro opcional quebra validação `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`).
- **NFR-4:** Swagger em `/docs` documenta os novos query params em PT-BR.

---

## 6. Data Model

Nenhuma migração de schema necessária. Os campos `app`, `environment` e `status` já existem em `PipelineQueue`.

```erDiagram
    PipelineQueue {
        String  id          PK
        String  app
        PipelineEnvironment environment
        PipelineStatus      status
        DateTime createdAt
        DateTime updatedAt
    }
```

**Campos usados nos filtros:**

| Campo | Tipo Prisma | Filtro backend | Operação Prisma |
|---|---|---|---|
| `app` | `String` | `app?: string` | `equals` (case-sensitive) |
| `environment` | `PipelineEnvironment` enum | `environment?: PipelineEnvironment` | `equals` |
| `status` | `PipelineStatus` enum | `status?: PipelineStatus` | `equals` |

---

## 7. API Contract

### PATCH — `GET /dashboard/kpis` (extensão)

```
GET /dashboard/kpis
- Auth: Bearer JWT
- Query params (todos opcionais, além dos já existentes dateStart/dateEnd):
    app?          string               — nome exato do app
    environment?  development|staging|production
    status?       Queued|Running|Completed|Failed
- Responses:
    200 KpiStatsResponseDto  — { total, succeeded, failed, errorRate }
    400 validation error     — param inválido (enum fora de range)
    401 unauthorized
```

> Nenhuma rota Vue Router nova. Nenhum endpoint novo — apenas extensão dos query params de `/dashboard/kpis`.

---

## 8. Module Boundaries

```classDiagram
    class DashboardModule {
        +DashboardController
        +DashboardService
    }
    class DashboardController {
        +getKpis(DashboardQueryDto) KpiStatsResponseDto
    }
    class DashboardQueryDto {
        +dateStart: string
        +dateEnd: string
        +app?: string
        +environment?: PipelineEnvironment
        +status?: PipelineStatus
    }
    class DashboardService {
        +getKpis(dto: DashboardQueryDto) KpiStatsResponseDto
    }
    DashboardController --> DashboardQueryDto
    DashboardController --> DashboardService

    class DashboardView {
        uses DashboardStore
        uses DashboardFilterBar
        uses DateRangeFilter
        uses KpiCards
        uses PipelineTable
    }
    class DashboardFilterBar {
        props: modelValue FilterState
        emits: update:modelValue
    }
    class DashboardStore {
        +filterApp: string
        +filterEnvironment: string
        +filterStatus: string
        +setFilters(partial FilterState)
        +clearFilters()
        +fetchKpis()
        +fetchInitial()
    }
    DashboardView --> DashboardFilterBar
    DashboardView --> DashboardStore
```

---

## 9. Flows

### Fluxo: usuário aplica filtro de ambiente

```sequenceDiagram
    actor U as Usuário
    participant FB as DashboardFilterBar
    participant S as DashboardStore
    participant API as GET /dashboard/kpis
    participant PQ as GET /pipeline-queue

    U->>FB: seleciona environment=production
    FB->>S: update:modelValue { environment: 'production' }
    S->>S: setFilters({ environment: 'production' })
    par refetch paralelo
        S->>API: ?dateStart=&dateEnd=&environment=production
        API-->>S: { total, succeeded, failed, errorRate }
        S->>S: kpis ← resultado
    and
        S->>PQ: ?page=1&limit=100&orderBy=desc&environment=production&dateStart=&dateEnd=
        PQ-->>S: { data[], total, page, limit }
        S->>S: pipelines ← data; page ← 1
    end
    S-->>DashboardView: estado atualizado
    DashboardView-->>U: KpiCards e PipelineTable atualizados
```

### Fluxo: WebSocket pipeline.created com filtro ativo

```sequenceDiagram
    participant WS as WebSocket
    participant S as DashboardStore
    participant PT as PipelineTable

    WS->>S: pipeline.created { app: 'api', environment: 'staging', status: 'Queued' }
    S->>S: matchesFilters(pipeline)?
    alt bate com filtros ativos
        S->>S: prepend pipeline; refetch KPIs
        S-->>PT: lista atualizada
    else não bate
        S->>S: apenas refetch KPIs (total pode mudar)
        S-->>PT: sem mudança na lista
    end
```

---

## 10. State Machines

Nenhum novo campo de status. Os enums `PipelineStatus` e `PipelineEnvironment` existentes são usados como valores de filtro — sem transição de estado nova.

---

## 11. Business Rules

```flowchart TD
    A[Filtros ativos?] -->|Sim| B[Incluir app/environment/status no where Prisma]
    A -->|Não| C[Where sem esses campos — comportamento atual]
    B --> D{status param presente?}
    D -->|Sim| E[KPI total = count where status=X\nKPI succeeded = count where status=Completed AND status=X\nKPI failed = count where status=Failed AND status=X]
    D -->|Não| F[KPI succeeded = count where status=Completed\nKPI failed = count where status=Failed]
    E --> G[errorRate = failed/total * 100]
    F --> G
```

> **Nota:** Se `status=Completed`, então `succeeded = total` e `failed = 0` (errorRate=0). Se `status=Failed`, então `failed = total` e `succeeded = 0` (errorRate=100). Comportamento matematicamente correto.

---

## 12. Edge Cases & Error Handling

- `app` vazio string (`""`) → tratado como ausente (não filtrar por app)
- `environment` ou `status` com valor inválido → `ValidationPipe` retorna 400 automaticamente via `@IsEnum`
- Todos os filtros ativos sem resultado → KPIs retornam `{ total: 0, succeeded: 0, failed: 0, errorRate: 0 }`; lista vazia com `hasMore = false`
- Usuário digita `app` e troca de data range simultaneamente → debounce do app reseta; ambos os watchers disparam fetch com estado mais recente
- WebSocket evento chega durante refetch em andamento → store usa `pipelines` já atualizado no momento do evento
- `status` filter no KPI: `succeeded` count usa `status = Completed` AND filtro de status — se filtro for `status = Failed`, count de succeeded = 0 (não é bug)

---

## 13. Acceptance Criteria

- **AC-1** `[backend]`: Dado usuário autenticado, quando `GET /dashboard/kpis?dateStart=X&dateEnd=Y&environment=production`, então 200 com contagens restritas a `environment=production`.
- **AC-2** `[backend]`: Dado usuário autenticado, quando `GET /dashboard/kpis?dateStart=X&dateEnd=Y&app=my-api`, então 200 com contagens restritas a `app='my-api'`.
- **AC-3** `[backend]`: Dado usuário autenticado, quando `GET /dashboard/kpis?dateStart=X&dateEnd=Y&status=Failed`, então 200 com `total = failed`, `succeeded = 0`, `errorRate = 100`.
- **AC-4** `[backend]`: Dado usuário autenticado, quando `GET /dashboard/kpis` sem novos params, então 200 com comportamento idêntico ao atual (retrocompatibilidade).
- **AC-5** `[backend]`: Quando `GET /dashboard/kpis?environment=invalid`, então 400.
- **AC-6** `[frontend]`: Dado dashboard carregado, quando página renderiza, então `DashboardFilterBar` exibe input de app, select de ambiente e select de status com opção vazia como default.
- **AC-7** `[frontend]`: Dado filtro de ambiente vazio, quando usuário seleciona `production`, então store dispara refetch de KPIs e lista com `environment=production`.
- **AC-8** `[frontend]`: Dado filtro de status vazio, quando usuário seleciona `Failed`, então KPI cards exibem dados só de pipelines Failed.
- **AC-9** `[frontend]`: Dado usuário digitando no campo app, quando digita `"my-api"`, então refetch dispara somente após 400 ms de inatividade.
- **AC-10** `[frontend]`: Dado filtro environment=production ativo, quando botão "Limpar filtros" é clicado, então todos os filtros são removidos e refetch sem filtros é disparado; botão some.
- **AC-11** `[frontend]`: Dado filtro status=Running ativo, quando evento WebSocket `pipeline.created` chega com `status=Queued`, então pipeline não é pré-pendado na lista.
- **AC-12** `[frontend]`: Dado filtro status=Running ativo e pipeline Running na lista, quando evento `pipeline.updated` chega com mesmo id e `status=Completed`, então pipeline é removido da lista.
- **AC-13** `[e2e]`: Dado usuário autenticado no dashboard, quando seleciona ambiente=staging, então KpiCards e PipelineTable exibem apenas dados de staging.

---

## 14. Open Questions

Nenhuma questão em aberto — escopo definido, sem ambiguidades de negócio.

---

## 15. Frontend Component Hierarchy

```graph TD
    DashboardView --> DateRangeFilter
    DashboardView --> DashboardFilterBar
    DashboardView --> KpiCards
    DashboardView --> PipelineTable

    DashboardFilterBar --> AppFilterInput["AppFilterInput (input texto)"]
    DashboardFilterBar --> EnvironmentSelect["EnvironmentSelect (select)"]
    DashboardFilterBar --> StatusSelect["StatusSelect (select)"]
    DashboardFilterBar --> ClearFiltersButton["ClearFiltersButton (botão condicional)"]

    DashboardView -.-> DashboardStore
    DashboardFilterBar -.-> DashboardStore
```

> `DashboardFilterBar` é novo componente em `frontend/src/components/DashboardFilterBar.vue`. Os selects são elementos `<select>` nativos Bootstrap 5 (sem lib extra). `AppFilterInput` é `<input type="text">` dentro do mesmo componente, sem sub-componente separado.

---

## 16. Infra Topology

N/A — sem alterações em k8s ou Dockerfile.
