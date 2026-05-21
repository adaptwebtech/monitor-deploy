---
name: fix-router
description: Use this skill whenever the user wants to fix, change, or refactor code that already exists in the codebase (feature já presente em docs/CODEBASE.md §8). Triggers on PT-BR phrases like "corrige", "consertar", "arrumar", "bug em X", "quebrado", "regressão", "mudar comportamento de", "alterar", "refatorar", "hotfix", "está quebrado em prod", "não funciona", "urgente", or issue references like "#123". Also triggers on the explicit slash commands /fix, /refactor, /hotfix. Determines branch (simple-fix/refactor/hotfix), records state, and dispatches downstream fix-* phases via subagents. This is phase 0 of the fix → triage → REG-test → patch → doc-sync pipeline; do NOT use this skill for greenfield features (those without §8 entry) — use fullstack-spec-mermaid instead.
---

# fix-router (Phase 0 — entry router)

## 🔒 REGRA ABSOLUTA — Mapa é fonte única

`docs/CODEBASE.md` já está no contexto via hook. Use §8 (feature index) para confirmar que a feature pedida existe. Se NÃO existir em §8 → não é fix, é greenfield: aborte e instrua usuário a usar `fullstack-spec-mermaid`.

### PROIBIDO
- `grep`/`find`/`ls`/`Explore` para "ver se a feature existe". Use §8.
- Iniciar patch antes de escrever state files.

### PERMITIDO
- `Read` `docs/CODEBASE.md`, `docs/specs/<feature>.md`, `docs/implementation/<feature>.md`.
- `Write` em `.claude/state/*.txt`.
- `Bash` para `date`, leitura simples de state.

---

## Quando invocar

- Usuário diz "corrige", "muda", "refatora", "hotfix" e cita feature presente em §8.
- Slash commands `/fix`, `/refactor`, `/hotfix` (estes pré-selecionam branch).
- Issue tracker reference (`#123`) sobre feature existente.

NÃO invocar quando:
- Feature não existe ainda → `fullstack-spec-mermaid`.
- Pergunta de leitura sem mudança → responda direto.
- Mudança puramente de docs → edite docs direto.

## Workflow

### 1. Detectar feature

Pergunte ao usuário qual feature está afetada (ou infira do texto). Confirme presença em §8 do mapa:

> "A feature mencionada está em CODEBASE.md §8? Confirme nome exato."

Se feature não está em §8 → pare e instrua greenfield.

### 2. Escolher branch

Se `/fix`/`/refactor`/`/hotfix` foram usados, branch já está fixada. Caso contrário, pergunte UMA VEZ:

> "Qual branch?
>   - **simple-fix** — bug/comportamento, REG-N RED→GREEN antes do patch
>   - **refactor** — restruturação sem mudar comportamento, CHAR-N congelam estado atual
>   - **hotfix** — prod quebrada, urgente, REG inline durante patch, backfill na fase 4"

### 3. Escolher autonomia

| Branch | Default |
|---|---|
| simple-fix | `pause` (revisa após cada fase) |
| refactor | `pause` |
| hotfix | `auto` |

Override permitido pelo usuário.

### 4. Bloquear se ciclo anterior aberto

```bash
cat .claude/state/fix-mode.txt 2>/dev/null
```

Se != `none` (ou ausente): instrua usuário a finalizar com `fix-doc-update` ou `rm .claude/state/fix-*.txt` antes de prosseguir.

### 5. Gravar state

```bash
mkdir -p .claude/state
echo "<branch>" > .claude/state/fix-mode.txt
echo "<autonomy>" > .claude/state/fix-autonomy.txt
echo "none" > .claude/state/fix-current.txt   # slug definido pelo fix-triage
```

### 6. Despachar fase 1 (triage)

Invoque subagent `fix-triage-agent` via tool Agent, passando:
- branch
- feature
- sintoma do usuário (texto livre + stacktrace se houver)

### 7. Pacing

Se `autonomy=pause`: aguarde aprovação após cada subagent retornar antes de despachar próximo.
Se `autonomy=auto`: encadeie automaticamente triage → regression → implementation → doc-update, parando só em blocker.

`hotfix` pula `fix-regression-agent` (REG escrito inline pelo `fix-implementation-agent`).

## Output

Apenas confirme ao usuário:

```
FIX PIPELINE INICIADO
  feature: <feature>
  branch: <simple-fix|refactor|hotfix>
  autonomy: <pause|auto>
  próxima fase: fix-triage
```

Em seguida invoque o subagent. Não dump exploração.

## Anti-patterns

- ❌ Iniciar router sem confirmar feature em §8.
- ❌ Esquecer de checar state file pré-existente (`fix-mode != none`).
- ❌ Despachar fix-triage sem gravar state primeiro (gates F1–F4 não funcionam).
- ❌ Auto-escolher branch sem perguntar (exceto via slash command).
