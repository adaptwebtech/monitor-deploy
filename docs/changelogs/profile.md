# Changelog — profile

Histórico append-only de fixes, refactors e hotfixes na feature `profile`.

---

## 2026-05-21 · simple-fix · historico-deploys

- Sintoma: `GET /pipeline-queue/mine` retornava `[]` — histórico de deploys exibia "Nenhum deploy encontrado" na `ProfileView` mesmo para usuários com deploys visíveis no Dashboard.
- Root cause: `findMine` filtrava exclusivamente por `id_user`; registros criados pelo webhook GitHub têm `id_user = null` e autoria rastreada apenas via `commitAuthorId = User.githubId`.
- Fix: `findMine` agora faz lookup de `User.githubId` pelo `userId` do JWT e aplica `WHERE id_user = $userId OR commitAuthorId = $githubId`, cobrindo ambos os fluxos de criação de pipeline.
- Arquivos:
  - `server/src/pipeline-queue/pipeline-queue.service.ts`
  - `server/src/pipeline-queue/__tests__/pipeline-queue-findmine.spec.ts`
  - `server/src/pipeline-queue/pipeline-queue.service.spec.ts`
  - `frontend/src/views/__tests__/ProfileView.spec.ts`
- REG: REG-1, REG-2, REG-3, REG-4, REG-5
- Triage: docs/fixes/profile-historico-deploys.md
