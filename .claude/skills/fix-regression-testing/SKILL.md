---
name: fix-regression-testing
description: Use this skill in phase 2 of the fix pipeline, AFTER fix-triage produced docs/fixes/<feature>-<slug>.md. Writes REG-N RED tests (simple-fix) or CHAR-N GREEN tests (refactor) one-to-one with the §7 plan in the triage doc. Validates RED/GREEN status via test runner. Skipped entirely in hotfix branch (REG goes inline with patch). Despacha fix-regression-agent subagent to execute.
---

# fix-regression-testing (Phase 2 — regression / characterization tests)

## 🔒 REGRA ABSOLUTA — Mapa é fonte única

`docs/CODEBASE.md` §12 contém skeletons canônicos de teste para Jest/Supertest (backend), Vitest (frontend) e Playwright (e2e). Use estes — não invente padrão.

### PROIBIDO
- Editar código de produção. Apenas arquivos de teste.
- Mockar Prisma/Redis em forma diferente do mapa §12.
- Skip de RED gate. Se REG-N passa antes do patch → o teste não prova o bug.

### PERMITIDO
- `Read` triage doc, mapa §12, arquivos §4 do triage (só para entender contrato).
- `Write`/`Edit` em `*.spec.ts`, `*.spec.vue`, `*.e2e-spec.ts`, `frontend/e2e/*.spec.ts`.
- `Bash` para `npm test`, `npm run test:unit`, `npm run test:e2e`, `npx playwright test`.

---

## Pré-condição

- `.claude/state/fix-mode.txt ∈ {simple-fix, refactor}` (NÃO roda em hotfix).
- `docs/fixes/<feature>-<slug>.md` existe (validado por `state/fix-current.txt`).

## Output location

| Caso | Path |
|---|---|
| Backend unit/integration | `server/src/<feature>/**/*.spec.ts` |
| Backend e2e | `server/test/<feature>.e2e-spec.ts` |
| Frontend component | `frontend/src/<feature>/**/*.spec.ts` |
| Frontend e2e | `frontend/e2e/<feature>.spec.ts` |

Match com camada conforme §4 do triage.

## Workflow

Despacha subagent `fix-regression-agent` — não escreva tests inline na main.

1. Validar pré-condições (mode + triage doc).
2. Invocar `fix-regression-agent` passando path do triage.
3. Agent escreve testes, roda runner, valida RED/GREEN, retorna lista compacta.
4. Se `autonomy=pause` → mostra retorno ao usuário e espera.
5. Se `autonomy=auto` → encadeia para `fix-implementation`.

## Naming convention

- `it('REG-N: <descrição do §7>', ...)` em simple-fix
- `it('CHAR-N: <descrição do §7>', ...)` em refactor

IDs (REG-1, REG-2, CHAR-1…) devem casar 1:1 com §7 do triage.

## Hand-off

Subagent retorna:
```
PHASE: regression-testing
STATUS: RED (simple-fix) ou GREEN (refactor)
NEXT: fix-implementation
```

## Anti-patterns

- ❌ Um único teste cobrindo REG-1 + REG-2 — quebra rastreabilidade.
- ❌ Escrever REG sem rodar e validar RED.
- ❌ Editar src/ "só pra fazer compilar" — REG deve compilar e falhar.
- ❌ Inventar fakes não cobertos em §12 do mapa.
