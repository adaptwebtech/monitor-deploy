# Changelog — workflow-timeout

## 2026-05-26 · refactor · refactor-remove-timeout
- Sintoma: status `Timeout` no enum `PipelineStatus` criava um estado separado para pipelines expirados, causando drift em KPIs (não contabilizados em `failed`/`errorRate`) e complexidade desnecessária no frontend
- Root cause: decisão original de design usou status dedicado `Timeout`; na prática `Timeout` é semanticamente idêntico a `Failed` com causa de expiração, e o dashboard não distinguia os dois nos KPIs
- Fix: `PipelineStatus.Timeout` removido do schema Prisma e da migration; `WorkflowCleanupService` passou a marcar pipelines expirados e duplicatas como `Failed`; entrada `Timeout` removida de `StatusBadge.vue` e do union type em `frontend/src/types/index.ts`; KPIs agora contabilizam corretamente pipelines expirados em `failed` e `errorRate`
- Arquivos: `server/prisma/schema.prisma`, `server/prisma/migrations/`, `server/src/workflow-cleanup/workflow-cleanup.service.ts`, `frontend/src/components/StatusBadge.vue`, `frontend/src/types/index.ts`, `server/src/dashboard/dashboard.service.ts`
- REG: REG-1, REG-2, REG-3, REG-4
- Triage: docs/fixes/workflow-timeout-refactor-remove-timeout.md
