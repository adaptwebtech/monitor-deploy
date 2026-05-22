---
name: fix-implementation
description: Internal fix-pipeline phase-3 skill. Dispatched by fix-router. Do not invoke directly — use /fix or /hotfix.
---

# fix-implementation (Phase 3 — scope-locked patch)

## 🔒 REGRA ABSOLUTA — Mapa é fonte única

`docs/CODEBASE.md` §11 (convenções) + §12 (skeletons) + §10 (símbolos exatos) cobrem o que você precisa. Não greppe atrás de "como outros fizeram".

### PROIBIDO
- Editar arquivo fora de §4 do triage. Hook F4 bloqueia, e você não deve burlar.
- Refatorar "de passagem" em simple-fix.
- Mudar assinatura pública (DTO/rota/prop/env) em refactor — re-route para simple-fix se necessário.
- Adicionar dependência nova sem aprovação.
- `Grep` em src/ para "ver onde mais isso é usado" — §10 já lista.

### PERMITIDO
- `Read`/`Edit`/`Write` em arquivos §4 do triage.
- `Read` em arquivos importados diretamente por §4 (1 hop) para entender contrato.
- `Bash` para `npm test`, `npm run lint`, `npm run build`, `npx prisma generate`.

---

## Pré-condição

- `.claude/state/fix-mode.txt ∈ {simple-fix, refactor, hotfix}`.
- Triage doc existe.
- Se branch ∈ {simple-fix, refactor}: tests REG-N/CHAR-N existem (saída de fase 2).
- Se branch = hotfix: pulou fase 2; agent escreverá REG inline.

## Workflow

Despacha `fix-implementation-agent` — não edite código na main.

1. Validar pré-condições.
2. Invocar agent passando path do triage.
3. Agent itera: read → edit → test → lint → build, até estabilizar.
4. Receber retorno compacto (lista de arquivos tocados + status).
5. `autonomy=pause` → mostrar e esperar; `auto` → seguir para `fix-doc-update`.

## Critérios de done (por camada)

| Camada | Critério |
|---|---|
| Backend | `npx prisma generate` ok + `npm test` GREEN + `npm run test:e2e` GREEN + `npm run lint` 0 + `npm run build` 0 |
| Frontend | `npm run test:unit` GREEN + `npx playwright test` GREEN + `npm run lint` 0 + `npm run build` 0 |
| Infra | manifests validados via `minikube kubectl -- kustomize ... \| ... apply --dry-run=server` |

## Hand-off

```
PHASE: implementation
FILES_TOUCHED: …
TESTS: GREEN
LINT: OK
BUILD: OK
NEXT: fix-doc-update
```

## Anti-patterns

- ❌ Reescrever 200 linhas quando 5 resolvem.
- ❌ Suprimir REG com `.skip` em vez de fazer passar.
- ❌ Atualizar docs aqui (é fase 4).
- ❌ Mexer fora de §4 e "esquecer" de atualizar o triage.
- ❌ `console.log` debug deixados no final.
