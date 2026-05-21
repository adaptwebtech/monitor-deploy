# Triage — profile · historico-deploys

> Branch: simple-fix
> Criado: 2026-05-21

## 1. Sintoma

`ProfileView.vue` exibe "Nenhum deploy encontrado" na tabela "Histórico de Deploys" para o usuário `pedro-php`, mesmo que o Dashboard liste deploys atribuídos a esse mesmo usuário via `commitAuthor` / `commitAuthorId`. A chamada `GET /pipeline-queue/mine` retorna lista vazia (`data: []`).

## 2. Repro

1. Fazer login como `pedro-php` (usuário que possui deploys visíveis no Dashboard).
2. Navegar para `/profile`.
3. Observar a seção "Histórico de Deploys" — exibe "Nenhum deploy encontrado".
4. Abrir DevTools → Network → verificar resposta de `GET /pipeline-queue/mine`: `{ data: [], total: 0, page: 1, limit: 10 }`.
5. Comparar com `GET /pipeline-queue` (Dashboard): retorna os mesmos deploys com `commitAuthor: "pedro-php"` e `commitAuthorId: "<github_id>"`, mas `id_user: null`.

## 3. Root cause

O método `findMine` em `pipeline-queue.service.ts` (linha 86) filtra exclusivamente pelo campo relacional `id_user`:

```typescript
const where: Prisma.PipelineQueueWhereInput = { id_user: userId };
```

Os registros de `PipelineQueue` são criados por um webhook GitHub (via `create` no mesmo service, linha 139–154) que popula `commitAuthor` e `commitAuthorId` (GitHub numeric ID), mas **deixa `id_user: null`** porque, no momento da criação, não há resolução do GitHub ID para o UUID interno do usuário. O campo `id_user` só seria preenchido se houvesse uma etapa de reconciliação que fizesse o join entre `User.githubId` e `PipelineQueue.commitAuthorId` — etapa essa inexistente no fluxo atual.

Portanto, para o usuário `pedro-php`, `id_user` é `null` em todos os seus registros de pipeline, e a query de `findMine` retorna zero resultados.

A correção deve ampliar o filtro `where` para incluir registros onde `commitAuthorId` bata com `User.githubId` do usuário autenticado — ou, alternativamente, preencher `id_user` no momento da criação do pipeline via lookup por `githubId`.

A abordagem mais robusta e de menor blast radius: modificar `findMine` para usar um `OR` entre `id_user` e `commitAuthorId` (resolvendo o `githubId` do usuário previamente), mantendo retrocompatibilidade com registros já existentes.

## 4. Scope de arquivos

- `server/src/pipeline-queue/pipeline-queue.service.ts`

## 5. Behavior delta

**Antes:** `findMine(userId)` filtra `WHERE id_user = $userId` → retorna `[]` porque todos os registros têm `id_user = NULL`.

**Depois:** `findMine(userId)` busca o `githubId` do usuário e filtra `WHERE id_user = $userId OR commitAuthorId = $githubId` → retorna todos os deploys cujo commit veio do mesmo GitHub ID vinculado ao perfil do usuário.

## 6. Risco / blast radius

- **Baixo.** Mudança restrita a `findMine` — não afeta `findAll` (Dashboard), `findById`, `create`, `update` nem `softDelete`.
- Nenhuma migration de schema necessária — `commitAuthorId` e `id_user` já existem.
- Nenhum endpoint público novo; endpoint `GET /pipeline-queue/mine` já está exposto.
- Usuários sem `githubId` cadastrado no perfil continuarão filtrando apenas por `id_user` (comportamento anterior preservado).
- Dados em produção: leitura apenas, sem risco de corrupção.

## 7. Plano de teste

- REG-1: Usuário autenticado com `githubId` preenchido e deploys cujo `commitAuthorId` = `githubId` (e `id_user = null`) — `GET /pipeline-queue/mine` deve retornar esses deploys.
- REG-2: Usuário autenticado com `githubId` preenchido e deploys vinculados via `id_user` (fluxo antigo) — endpoint deve continuar retornando esses deploys.
- REG-3: Usuário autenticado sem `githubId` no perfil — endpoint deve retornar apenas deploys com `id_user` correspondente (sem erro de query).
- REG-4: Usuário autenticado sem nenhum deploy associado (nem `id_user` nem `commitAuthorId`) — endpoint retorna `data: []` sem erro.
- REG-5: `ProfileView.vue` renderiza linha `data-test="history-row"` para cada deploy retornado; ausência de `data-test="history-empty"` quando `data` não está vazio.
