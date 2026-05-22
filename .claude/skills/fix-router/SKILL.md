---
name: fix-router
description: Invoked by /fix and /hotfix commands. Routes bug fixes, refactors, and hotfixes for existing features (present in CODEBASE.md §8). Determines branch (simple-fix/refactor/hotfix), records state, dispatches fix pipeline phases. Do NOT use for greenfield — use /feature.
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

Se `/hotfix` foi usado → branch = **hotfix**, autonomia = **auto** (fixado, não pergunte).

Se `/fix` foi usado → pergunte UMA VEZ:

> "É um bug/mudança de comportamento ou uma restruturação sem mudar comportamento?
>   - **simple-fix** — bug, comportamento incorreto, REG-N RED→GREEN antes do patch
>   - **refactor** — restruturação interna sem mudar comportamento externo, CHAR-N congelam estado"

### 3. Escolher autonomia

| Branch | Default |
|---|---|
| simple-fix | `pause` (revisa após cada fase) |
| refactor | `pause` |
| hotfix | `auto` (forçado) |

Override permitido pelo usuário (exceto hotfix — sempre `auto`).

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
