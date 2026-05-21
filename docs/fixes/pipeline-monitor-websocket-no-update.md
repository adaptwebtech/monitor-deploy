# Triage — pipeline-monitor · websocket-no-update

> Branch: simple-fix
> Criado: 2026-05-21

## 1. Sintoma

O dashboard não atualiza a exibição do pipeline em execução (`RunningIndicator`), os status na tabela (`PipelineTable`) nem os KPIs quando um novo evento chega via WebSocket. A UI fica com os dados do carregamento inicial (REST) e só reflete mudanças após reload manual da página. Eventos `pipeline.created` e `pipeline.updated` chegam ao socket mas a UI não responde.

## 2. Repro

1. Abrir o dashboard (`/`).
2. Enviar webhook `queued` via `POST /webhook` — novo pipeline aparece na tabela apenas após F5.
3. Enviar webhook `step` para o mesmo `commitSha` — status não muda de `Queued` para `Running` sem reload.
4. Enviar webhook `Succeeded` ou `Error` — status permanece `Running` na tabela.
5. Em nenhum dos passos acima o `RunningIndicator` pisca ou desaparece sem reload.

## 3. Root cause

> **Nota pós-patch (2026-05-21):** o triage original identificou dois defeitos. Após implementação e execução dos testes REG, constatou-se que o Defeito A (atribuição por índice não reativa no Vue 3) estava **incorreto** — o Vue 3 Proxy rastreia corretamente mutações de slot por `array[idx] = x` em `ref<T[]>`. A causa raiz real é exclusivamente o **Defeito B**. O `splice` foi mantido no patch como prática idiomática, mas não era a correção do bug de UI. O defeito secundário (`handleQueued` emitindo DTO stale antes de `id_user` ser preenchido) foi identificado durante a implementação e corrigido como parte do mesmo patch.

### Defeito A — `handleSocketUpdated`: substituição de índice (NÃO é causa do bug de UI)

~~Em `dashboard.store.ts`, `pipelines.value[idx] = x` não disparava reatividade.~~

**Incorreto.** O Vue 3 Proxy rastreia atribuições de índice em arrays reativos normalmente. A UI re-renderizaria corretamente com a atribuição direta. O `splice` foi introduzido como idioma mais explícito e defensivo, mas **não é a causa do bug de renderização**.

### Defeito B — `DashboardView` nunca popula `dateStart`/`dateEnd` no store (causa principal)

Em `DashboardView.vue`, `dateStart` e `dateEnd` eram variáveis locais ao componente e **nunca escritas no store** (`dashboardStore.dateStart` / `dashboardStore.dateEnd` permaneciam `""`). No `onMounted`, o componente chamava `fetchPipelines` e `fetchKpis` diretamente sem antes chamar `dashboardStore.$patch({ dateStart, dateEnd })`. Quando `handleSocketCreated` disparava e o store chamava `fetchKpis` internamente, lia `dateStart.value === ""` e `dateEnd.value === ""`, gerando `GET /dashboard/kpis?dateStart=&dateEnd=` → `400 Bad Request` (o `KpisQueryDto` rejeita strings vazias com `@IsNotEmpty()`). A exceção era silenciosa e os KPIs ficavam desatualizados após cada novo deploy recebido via WebSocket.

**Correção:** `onMounted` em `DashboardView.vue` passa a chamar `dashboardStore.$patch({ dateStart, dateEnd })` antes de `fetchPipelines`/`fetchKpis`, garantindo que o store registre o intervalo de datas ativo desde o primeiro render.

### Defeito C — `handleQueued` emitia DTO stale antes de `id_user` ser preenchido

Em `webhook.service.ts`, `handleQueued` declarava `const queue` e reatribuía a variável após o update de `id_user`, mas por ser `const` a referência original (sem `id_user`) era a enviada para `emitPipelineCreated`. O evento WebSocket `pipeline.created` chegava ao frontend com `id_user: null`, causando inconsistência entre o pipeline inserido via socket e o carregado via REST.

**Correção:** `const queue` → `let queue`; a variável é reatribuída após o `prisma.pipeline_queue.update` que popula `id_user`, e somente então `emitPipelineCreated` é chamado com o DTO completo.

## 4. Scope de arquivos

- `frontend/src/views/DashboardView.vue`
- `frontend/src/stores/dashboard.store.ts`
- `server/src/webhook/webhook.service.ts`

## 5. Behavior delta

**Antes:** `DashboardView.onMounted` chamava `fetchPipelines`/`fetchKpis` diretamente sem popular `dateStart`/`dateEnd` no store; `handleSocketCreated` internamente chamava `fetchKpis("")` → `400`, silenciando o erro e deixando os KPIs defasados após cada evento WebSocket `pipeline.created`. Em `webhook.service.ts`, `handleQueued` emitia `emitPipelineCreated` com o DTO original (`id_user: null`) antes de reatribuir a variável após o update de `id_user`.

**Depois:** `DashboardView.onMounted` chama `dashboardStore.$patch({ dateStart, dateEnd })` antes de `fetchPipelines`/`fetchKpis`, garantindo que `store.dateStart` e `store.dateEnd` sejam não-vazios desde o primeiro render; `handleSocketCreated` dispara `fetchKpis` com datas válidas e os KPIs são atualizados corretamente. Em `webhook.service.ts`, `const queue` → `let queue` e reatribuição após update garante que `emitPipelineCreated` envie o DTO completo com `id_user` preenchido. `handleSocketUpdated` substituído por `splice` (idioma Vue 3 explícito — comportamento reativo estava correto antes, mas o `splice` torna a mutação mais defensiva).

## 6. Risco / blast radius

- **Scope restrito ao frontend** — nenhum dado em produção ou migration envolvida.
- `handleSocketUpdated` usa `splice` que é wrapper padrão do Vue 3 para arrays reativos — sem risco de regressão em outros consumers de `pipelines`.
- Trocar chamadas diretas por `setDateRange` no mount unifica o fluxo de inicialização; qualquer componente que dependa de `dashboardStore.dateStart`/`dateEnd` (ex: `DateRangeFilter`) passará a ler os valores corretos — comportamento desejado, não regressão.
- `ProfileView` e `UsersView` não consomem `dashboardStore` — sem impacto.
- Nenhum endpoint público alterado; nenhuma mudança de contrato de API.

## 7. Plano de teste

- **REG-1:** Disparar evento `pipeline.updated` via callback do socket com `id` existente em `pipelines` → `pipelines.value[idx].status` deve refletir o novo status imediatamente (prova que `splice` aciona reatividade no Pinia ref array).
- **REG-2:** Computed `runningPipeline` deve retornar o pipeline correto após `handleSocketUpdated` atualizar seu `status` para `Running` sem reload (prova reatividade da computed).
- **REG-3:** Montar `DashboardView` com `dateStart`/`dateEnd` — store deve ter `dateStart` e `dateEnd` não-vazios após `onMounted` (prova que `setDateRange` é chamado e popula o store).
- **REG-4:** Disparar evento `pipeline.created` → `fetchKpis` chamado com datas não-vazias; mock de `apiFetch` não deve receber URL com `dateStart=&dateEnd=` (prova que Defeito B está corrigido).
- **REG-5:** `handleSocketUpdated` com `id` inexistente → `pipelines.value` inalterado, sem exceção (prova guarda do `idx !== -1`).
