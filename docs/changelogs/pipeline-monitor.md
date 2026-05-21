# Changelog — pipeline-monitor

## 2026-05-21 · simple-fix · websocket-no-update
- Sintoma: dashboard não atualizava KPIs nem status de pipelines em tempo real ao receber eventos WebSocket `pipeline.created` e `pipeline.updated`; UI só refletia mudanças após reload manual
- Root cause: `DashboardView.onMounted` nunca populava `dateStart`/`dateEnd` no store antes de chamar `fetchPipelines`/`fetchKpis`, deixando `store.dateStart = ""` e causando `fetchKpis("")` → `400` silencioso após cada `pipeline.created`; secundariamente, `handleQueued` em `webhook.service.ts` emitia `emitPipelineCreated` com DTO stale (`id_user: null`) antes de reatribuir a variável após o `prisma.pipeline_queue.update`
- Fix: `DashboardView.onMounted` agora chama `dashboardStore.$patch({ dateStart, dateEnd })` antes das chamadas REST, garantindo datas válidas no store desde o primeiro render; `dashboard.store.ts` substituiu atribuição de índice por `splice` (idioma Vue 3 defensivo); `webhook.service.ts` `const queue` → `let queue` com reatribuição após update, garantindo que `emitPipelineCreated` envie o DTO completo com `id_user` preenchido
- Arquivos: `frontend/src/views/DashboardView.vue`, `frontend/src/stores/dashboard.store.ts`, `server/src/webhook/webhook.service.ts`
- REG: REG-3 (store.dateStart não-vazio após mount), REG-4 (fetchKpis não chamado com datas vazias) confirmados RED→GREEN; REG-1, REG-2, REG-5 GREEN
- Triage: docs/fixes/pipeline-monitor-websocket-no-update.md
