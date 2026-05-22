# Triage — pipeline-monitor · ws-completion

> Branch: simple-fix
> Criado: 2026-05-22

## 1. Sintoma

Quando um pipeline transita para `Completed` via webhook `Succeeded`, a tabela do dashboard **não atualiza em tempo real**. O valor correto aparece apenas após F5 (banco está correto). O evento WebSocket `pipeline.updated` é emitido pelo gateway, mas a UI permanece mostrando o status anterior (`Running`).

Três causas independentes foram identificadas e confirmadas em código:

- **Candidato A:** `handleSocketUpdated` descarta silenciosamente o evento se `idx === -1` (pipeline não encontrado em `pipelines.value`).
- **Candidato B:** `handleSocketUpdated` **não chama** `fetchKpis` após atualizar o pipeline; apenas `handleSocketCreated` chama. KPI cards ficam desatualizados após qualquer transição de status.
- **Candidato C:** `DashboardView.onMounted` chama `$patch({ dateRange })` que dispara o `watch(dateRange)` → `fetchInitial()` sem `await`, enquanto `onMounted` também chama `fetchInitial()` explicitamente com `await`. As duas chamadas concorrem e a segunda pode sobrescrever o array `pipelines.value` depois que um evento WS já o atualizou.

## 2. Repro

1. Abrir o dashboard com pelo menos uma pipeline no estado `Running`.
2. Enviar webhook `Succeeded` com o `commitSha` correspondente ao servidor.
3. Observar a linha da pipeline na tabela — o status **não muda** para `Completed`.
4. Pressionar F5 — o status correto aparece.
5. Repetir com pipeline que **não está na página atual** (carregada via scroll infinito) — o evento também é descartado (Candidato A, caso extremo).

## 3. Root cause

**Causa primária (Candidato D — confirmado via Argo WorkflowTemplate):**
O passo `force-deploy` no Argo workflow faz `kubectl rollout restart deployment api` e aguarda `rollout status --timeout=300s`. Isso derruba e sobe o pod da API. O frontend perde a conexão WebSocket com o pod antigo. Em seguida, o passo `onExit: notify-exit` dispara e o backend emite `pipeline.updated` (status `Completed`). Nesse momento o frontend ainda está reconectando — o evento WS é emitido para zero clientes conectados e **perdido**. `usePipelineSocket.ts` não tem handler de `reconnect`/`connect` para acionar `fetchInitial()` ao restabelecer a conexão.

**Causa secundária (Candidato B):**
`frontend/src/stores/dashboard.store.ts`, função `handleSocketUpdated`: não chama `fetchKpis` após atualizar o pipeline. KPI cards ficam desatualizados após qualquer transição de status via WS.

**Causa terciária (Candidato C — race condition):**
`frontend/src/views/DashboardView.vue`, `onMounted`: `$patch({ dateRange })` dispara o `watch(dateRange)` → `fetchInitial()` fire-and-forget concorrente com o `await fetchInitial()` explícito do mount. A chamada do watcher pode sobrescrever `pipelines.value` após um update WS já ter sido aplicado.

**Candidato A (descarte silencioso):** `handleSocketUpdated` descarta eventos se `idx === -1`. Defeito real mas não causa primária no fluxo relatado.

## 4. Scope de arquivos

- `frontend/src/composables/usePipelineSocket.ts`
- `frontend/src/views/DashboardView.vue`
- `frontend/src/stores/dashboard.store.ts`

## 5. Behavior delta

| Situação | Antes (defeito) | Depois (fix) |
|---|---|---|
| Pod API restartado pelo force-deploy; `notify-exit` emite Completed | Frontend desconectado perde o evento; tabela fica em `Running` até F5 | Ao reconectar, socket dispara `fetchInitial()` → tabela atualiza com estado real do banco |
| Webhook `Succeeded` recebido com socket ativo | KPI cards não atualizam | `handleSocketUpdated` chama `fetchKpis` em status Completed/Failed |
| Race condition no mount | `fetchInitial()` do watcher sobrescreve updates WS | Watcher protegido por flag de mount inicial; uma única `fetchInitial()` com await |
| Pipeline fora da janela de scroll recebe `pipeline.updated` | Evento descartado silenciosamente | Upsert no topo da lista |

## 6. Risco / blast radius

- **Escopo isolado ao frontend** — nenhuma alteração em backend, banco ou gateway.
- `fetchInitial()` no reconnect adiciona uma chamada HTTP ao reconectar; impacto mínimo.
- `fetchKpis` adiciona chamada HTTP a cada `pipeline.updated` — endpoint já existente.
- Correção do watcher afeta fluxo de mount; coberta por REG-3.
- Nenhuma migration, endpoint público ou dado em produção afetado.

**Risco: baixo.**

## 7. Plano de teste

- **REG-1:** Socket `connect` após primeira conexão (reconexão) chama `dashboardStore.fetchInitial()` — prova que pod restart não deixa tabela stale.
- **REG-2:** `handleSocketUpdated` chama `fetchKpis` quando status é `Completed` ou `Failed` — prova atualização de KPI cards via WS.
- **REG-3:** `onMounted` em `DashboardView` chama `fetchInitial` exatamente uma vez; watcher `dateRange` não dispara no mount inicial — prova eliminação da race condition.
- **REG-4:** `handleSocketUpdated` com `idx === -1` insere pipeline no topo em vez de descartar — prova robustez para eventos fora da janela de scroll.
- **REG-5:** Sequência `step → Succeeded` via mocks de socket atualiza `pipelines[0].status` para `Completed` e `kpis.succeeded` incrementa — prova fluxo e2e do sintoma original.
