---
name: fix-doc-update
description: Use this skill in phase 4 (final) of the fix pipeline. Syncs docs/specs/<feature>.md §17, docs/implementation/<feature>.md §13, docs/changelogs/<feature>.md (append), and docs/CODEBASE.md §8/§9/§10 when applicable. Hotfix branch also backfills triage §2/§5/§6/§7 + Retrospectiva. Clears .claude/state/fix-*.txt. Despacha fix-doc-update-agent subagent.
---

# fix-doc-update (Phase 4 — doc sync + state cleanup)

## 🔒 REGRA ABSOLUTA — Mapa é fonte única

`docs/CODEBASE.md` é fonte autoritativa. Após patch, §8 (feature index), §9 (ERD), §10 (símbolos) podem ter drifted — sincronize aqui no mesmo commit. Esta é também a única fase em que `Read` direcionado em arquivos modificados é necessário para derivar doc real (exceção `fix-doc-update` registrada em `.claude/CLAUDE.md`).

### PROIBIDO
- Reescrever spec ou impl inteiros — append/edit cirúrgico.
- Pular changelog "fix pequeno".
- Marcar state como limpo sem realmente zerar os 3 arquivos.

### PERMITIDO
- `Read` em qualquer doc + arquivos modificados pelo fix.
- `Edit`/`Write` em `docs/specs/<feature>.md`, `docs/implementation/<feature>.md`, `docs/changelogs/<feature>.md`, `docs/CODEBASE.md`, `README.md`.
- `Bash` para `git diff --name-only`, `date`, escrever em `.claude/state/`.

---

## Pré-condição

- `fix-implementation` concluiu com TESTS GREEN + LINT 0 + BUILD 0.
- `state/fix-mode.txt != none` e `state/fix-current.txt` aponta para triage existente.

## Workflow

Despacha `fix-doc-update-agent`.

1. Validar pré-condições.
2. Invocar agent com path do triage + branch.
3. Agent lê triage, faz `git diff --name-only`, sync de:
   - `docs/specs/<feature>.md` §17 (sempre) + corpo se §5 do triage indicou behavior delta.
   - `docs/implementation/<feature>.md` §13 + seções driftadas.
   - `docs/changelogs/<feature>.md` (append entrada datada).
   - `docs/CODEBASE.md` §8/§9/§10 conforme aplicável.
4. Em hotfix: agent backfill §2/§5/§6/§7 do triage + adiciona "Retrospectiva do incidente".
5. Agent zera state files (mode/autonomy/current = none).
6. Receber confirmação e apresentar.

## Changelog entry (formato canônico)

```markdown
## YYYY-MM-DD · <branch> · <slug>
- Sintoma: <§1 do triage>
- Root cause: <§3 do triage>
- Fix: <1-2 frases>
- Arquivos: <lista de §4>
- REG: REG-1..N (ou CHAR-1..N em refactor)
- Triage: docs/fixes/<feature>-<slug>.md
```

## CODEBASE.md sync (decisão)

| Mudança no patch | §8 | §9 | §10 | §11 | §12 |
|---|---|---|---|---|---|
| Renomear símbolo | — | — | ✅ | — | — |
| Mover arquivo | ✅ | — | ✅ | — | — |
| Schema migration | — | ✅ | — | — | — |
| Nova env var | — | — | — | ✅ | — |
| Novo skeleton emergente | — | — | — | — | ✅ |

Refactor SEMPRE atualiza §10.

## Hand-off

Fim do pipeline. Output:

```
PHASE: doc-update
DOCS_UPDATED: …
STATE: cleared
DONE
```

State zerado libera próximo `/fix`/`/refactor`/`/hotfix`.

## Anti-patterns

- ❌ Hotfix sem backfill na §7 do triage.
- ❌ `git status` mostra arquivos modificados não documentados.
- ❌ Esquecer changelog.
- ❌ Deixar `state/fix-mode.txt` != none ao concluir.
