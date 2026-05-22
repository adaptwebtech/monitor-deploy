---
name: feature-router
description: Use this skill whenever the user invokes /feature or wants to start/resume the full greenfield pipeline (spec → test → code → doc) for a new feature. Orchestrates all 4 phases in sequence, tracks state, and supports pause-per-phase or auto mode. Do NOT use for fixing existing features — use fix-router instead.
---

# feature-router (Pipeline Orchestrator — greenfield)

## 🔒 REGRA ABSOLUTA — Mapa é fonte única

`docs/CODEBASE.md` já está no contexto via hook. Use §8 (feature index) apenas para confirmar que a feature pedida **NÃO existe ainda** (se existir, é fix — instrua a usar `/fix`).

### PROIBIDO
- `grep`/`find`/`ls`/`Explore` para descobrir estrutura.
- Pular fase sem verificar artifacts de fase anterior.
- Iniciar fase sem escrever/atualizar `feature-phase.txt` primeiro.

### PERMITIDO
- `Read` `docs/CODEBASE.md`, `docs/specs/<feature>.md`, `docs/implementation/<feature>.md`.
- `Bash` para `date`, leitura de state files, verificação de existência de arquivos.
- `Write` em `.claude/state/*.txt`.
- Invocar skills de fase via tool `Skill`.

---

## Quando invocar

- Slash command `/feature <nome>`.
- Usuário diz "nova feature", "criar feature", "implementar do zero", "greenfield".

NÃO invocar quando:
- Feature já existe em §8 do mapa → use `fix-router`.
- Pergunta sem intenção de implementar → responda direto.

---

## Workflow

### 1. Normalizar nome da feature

Converta o argumento recebido para kebab-case (ex: `User Profile` → `user-profile`).

Se nenhum argumento fornecido, pergunte:
> "Qual o nome da feature? (será usado como kebab-case: ex. `user-profile`)"

### 2. Verificar se feature já existe (não é greenfield)

Consulte §8 do CODEBASE.md. Se a feature já estiver listada:
> "Feature '<name>' já existe em CODEBASE.md §8. Use `/fix <descrição>` para alterar código existente."
> Encerre.

### 3. Detectar fase atual (resume logic)

Execute estas verificações para determinar de onde retomar:

```bash
# Phase 1 done?
[ -f "docs/specs/<name>.md" ] && grep -q "AC-[0-9]" "docs/specs/<name>.md"

# Phase 2 done? (backend)
find "server/src/<name>" -name "*.spec.ts" 2>/dev/null | grep -q .
# Phase 2 done? (frontend)
find "frontend/src/<name>" -name "*.spec.*" 2>/dev/null | grep -q .

# Phase 3 done? (backend non-spec ts files)
find "server/src/<name>" -name "*.ts" ! -name "*.spec.ts" 2>/dev/null | grep -q .
# Phase 3 done? (frontend non-spec files)
find "frontend/src/<name>" \( -name "*.vue" -o -name "*.ts" \) ! -name "*.spec.*" 2>/dev/null | grep -q .

# Phase 4 done?
[ -f "docs/implementation/<name>.md" ]
```

Determine fase de entrada:
- Nenhum artifact → começa em `spec`
- Spec com ACs existe, sem testes → começa em `tests`
- Spec + testes existem, sem impl → começa em `code`
- Spec + testes + impl existem, sem doc → começa em `doc`
- Tudo existe → confirme com usuário se deseja re-executar alguma fase

### 4. Bloquear se pipeline ativo para outra feature

```bash
cat .claude/state/feature-phase.txt 2>/dev/null
cat .claude/state/feature-name.txt 2>/dev/null
```

Se `feature-phase.txt` contém `spec`, `tests`, `code`, ou `doc` E `feature-name.txt` é diferente da feature atual:
> "Pipeline ativo para feature '<outro>'. Finalize-o ou limpe o state:
> `rm .claude/state/feature-*.txt`"
> Encerre.

Se é a mesma feature: resume da fase detectada no passo 3.

### 5. Escolher autonomia

| Default | Opção |
|---|---|
| `pause` — para após cada fase para aprovação | `auto` — encadeia fases automaticamente |

Pergunte UMA VEZ:
> "Autonomia: **pause** (revisar após cada fase, padrão) ou **auto** (executar tudo em sequência)?"

### 6. Gravar state

```
.claude/state/feature-name.txt     → <kebab-case-name>
.claude/state/feature-phase.txt    → <fase-inicial>
.claude/state/feature-autonomy.txt → pause | auto
```

### 7. Confirmar e iniciar

Exiba:

```
FEATURE PIPELINE INICIADO
  feature:   <name>
  fase:      <fase-inicial>
  autonomia: <pause|auto>
```

Em seguida, execute as fases a partir da fase inicial.

---

## Execução das fases

### Fase 1 — Spec

Atualize `feature-phase.txt = spec`.
Invoque skill `fullstack-spec-mermaid` via tool `Skill` com args `<feature-name>`.

Em modo `pause`: aguarde aprovação do usuário antes de avançar.
Em modo `auto`: avance automaticamente quando spec tiver ACs escritos.

### Fase 2 — Testes

Atualize `feature-phase.txt = tests`.

Determine camadas ativas a partir da spec:
- Spec tem §15 (Vue component hierarchy) → camada frontend ativa
- Spec tem API contract (§7 com endpoints HTTP) → camada backend ativa
- Spec tem §16 (infra topology) → camada infra ativa

Invoque skills de teste para cada camada ativa.
Se 2+ camadas ativas: invoque em paralelo (mesmo turno, múltiplos tool calls `Skill`).

Em modo `pause`: aguarde aprovação (confirme que todos testes estão RED) antes de avançar.

### Fase 3 — Implementação

Atualize `feature-phase.txt = code`.

Invoque skills de implementação para cada camada ativa (mesmas camadas de fase 2).
Se 2+ camadas: despache agentes paralelos via `Agent` tool (um por camada), não `Skill` direto — as implementation skills usam subagents.

Em modo `pause`: aguarde aprovação (confirme GREEN + lint + build) antes de avançar.

### Fase 4 — Documentação

Atualize `feature-phase.txt = doc`.
Invoque skill `fullstack-doc-writer` via tool `Skill`.

### Conclusão

Atualize `feature-phase.txt = done`.

Exiba:

```
FEATURE PIPELINE COMPLETO
  feature: <name>
  spec:    docs/specs/<name>.md
  impl:    docs/implementation/<name>.md
  testes:  GREEN
  build:   0 erros

State limpo. Pronto para próxima feature.
```

---

## Comandos de gerenciamento de state

O usuário pode usar estes comandos Bash para inspecionar/resetar o pipeline:

```bash
# Ver estado atual
cat .claude/state/feature-name.txt
cat .claude/state/feature-phase.txt

# Resetar pipeline (sair sem finalizar)
rm .claude/state/feature-*.txt

# Avançar fase manualmente (se algo travou)
echo "code" > .claude/state/feature-phase.txt
```

---

## Anti-patterns

- ❌ Invocar skill de fase sem atualizar `feature-phase.txt` primeiro.
- ❌ Assumir camadas ativas sem ler a spec (§15 e §16 determinam frontend/infra).
- ❌ Pular fase 2 (testes) mesmo que usuário peça — decline e escreva testes.
- ❌ Esquecer de checar se outra feature pipeline está ativa antes de escrever state.
- ❌ Feature existente em §8 → não é greenfield, use fix-router.
