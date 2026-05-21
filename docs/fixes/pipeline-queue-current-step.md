# Fix Triage — pipeline-queue-current-step

**Slug:** `pipeline-queue-current-step`
**Data:** 2026-05-21
**Branch:** simple-fix/pipeline-queue-current-step

---

## §1 Sintoma

O frontend não exibe o step atual ao lado do nome do ambiente na tabela de pipelines. A coluna de ambiente aparece sem indicação de qual etapa está em execução, mesmo quando o pipeline possui steps registrados no banco.

---

## §2 Root Cause

Três causas independentes convergem para o mesmo sintoma:

1. **Queries Prisma sem `include: { steps }`** — `pipeline-queue.service.ts` carrega registros de `PipelineQueue` sem incluir a relação `steps`, de modo que `pipeline.steps` chega `undefined` em runtime. Nenhum campo `currentStep` pode ser derivado.

2. **DTO sem campo `currentStep`** — `pipeline-queue-response.dto.ts` não declara `currentStep`, portanto o campo é descartado pelo `ValidationPipe` (`whitelist: true`) mesmo que o service o inclua manualmente. A resposta REST e o payload WebSocket nunca carregam o campo.

3. **`handleStep` emite evento de queue stale antes de criar o step** — em `webhook.service.ts`, a emissão do evento `pipeline.updated` via WebSocket ocorre antes do `prisma.step.create()` ser aguardado. O cliente recebe o snapshot sem o novo step e nunca recebe atualização corrigida.

---

## §3 Scope

| Arquivo | Camada | Mudança necessária |
|---|---|---|
| `server/src/pipeline-queue/pipeline-queue.service.ts` | Backend | Adicionar `include: { steps: true }` nas queries; derivar `currentStep` do último step com status `running` ou `pending` |
| `server/src/pipeline-queue/dto/pipeline-queue-response.dto.ts` | Backend | Adicionar campo `currentStep: string \| null` com `@ApiPropertyOptional` + `@IsOptional()` + `@IsString()` |
| `server/src/webhook/webhook.service.ts` | Backend | Mover `emit('pipeline.updated', ...)` para depois do `await prisma.step.create(...)` |
| `frontend/src/pipeline-queue/types/index.ts` | Frontend | Adicionar `currentStep: string \| null` ao tipo `PipelineQueue` |
| `frontend/src/pipeline-queue/components/PipelineTable.vue` | Frontend | Exibir `currentStep` abaixo do nome do ambiente quando não-nulo |

Total: **5 arquivos**. Nenhuma migration Prisma. Nenhum novo módulo.

---

## §4 Behavior Delta

**Antes:**
- `GET /pipeline-queue` retorna objetos sem `currentStep`.
- Evento WebSocket `pipeline.updated` chega sem `currentStep`.
- `PipelineTable` exibe apenas o nome do ambiente.

**Depois:**
- `GET /pipeline-queue` retorna `currentStep: string | null` em cada item — preenchido com o nome do step em execução, ou `null` se não houver step ativo.
- Evento WebSocket `pipeline.updated` carrega o mesmo campo `currentStep` já atualizado (emitido após a criação do step).
- `PipelineTable` exibe o nome do ambiente e, logo abaixo, o step atual em texto menor quando `currentStep !== null`.

---

## §5 Risco

**Baixo.**

- Campo `currentStep` é nullable — clientes que não o consomem não são afetados (sem breaking change).
- Nenhuma migration de banco — apenas `include` na query e campo novo no DTO.
- Reordenação do `emit` em `handleStep` é local ao método; não altera fluxo de outros handlers.
- Mudança no frontend é aditiva — linha extra no template, sem remoção de markup existente.

---

## §6 Plano de Implementação

Ordem sequencial recomendada (uma camada por vez, backend antes de frontend):

1. Atualizar queries em `pipeline-queue.service.ts` com `include: { steps: true }` e lógica de derivação de `currentStep`.
2. Adicionar `currentStep` ao `pipeline-queue-response.dto.ts`.
3. Corrigir ordem de operações em `webhook.service.ts` (`await create` antes do `emit`).
4. Adicionar `currentStep` ao tipo frontend em `types/index.ts`.
5. Renderizar `currentStep` em `PipelineTable.vue`.

---

## §7 Plano de Teste (Regressão)

| ID | Camada | Cenário | Critério de aceite |
|---|---|---|---|
| REG-1 | Backend / REST | `GET /pipeline-queue` com pipeline que possui steps registrados | Resposta contém `currentStep` preenchido com o nome do step em execução (status `running` ou `pending` mais recente) |
| REG-2 | Backend / REST | `GET /pipeline-queue` com pipeline sem steps | Resposta contém `currentStep: null` |
| REG-3 | Backend / WebSocket | Evento `pipeline.updated` emitido após webhook de step | Payload do evento inclui `currentStep` com o nome do step recém-criado (não o snapshot anterior) |
