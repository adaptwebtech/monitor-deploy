# Changelog — pipeline-queue

## 2026-05-21 · simple-fix · pipeline-queue-current-step
- Sintoma: frontend não exibia step atual ao lado do ambiente na tabela de pipelines
- Root cause: queries Prisma sem `include: { steps }`, DTO sem campo `currentStep`, e `handleStep` emitia evento `pipeline.updated` antes de criar o step (payload stale)
- Fix: adicionado `include: { steps: true }` nas queries do service com derivação de `currentStep`; campo `currentStep: string | null` adicionado ao DTO com decorators Swagger/class-validator; emissão do evento movida para após o `await prisma.step.create()`; tipo frontend e renderização em `PipelineTable.vue` atualizados
- Arquivos: `server/src/pipeline-queue/pipeline-queue.service.ts`, `server/src/pipeline-queue/dto/pipeline-queue-response.dto.ts`, `server/src/webhook/webhook.service.ts`, `frontend/src/types/index.ts`, `frontend/src/components/PipelineTable.vue`
- REG: REG-1, REG-2, REG-3
- Triage: docs/fixes/pipeline-queue-current-step.md
