---
description: Inicia ciclo de hotfix urgente (prod quebrada, REG inline, backfill posterior). Uso — /hotfix <descrição do incidente>
---

Invoque a skill `fix-router` com:
- branch pré-selecionada: **hotfix**
- autonomia forçada: **auto**
- descrição do usuário: `$ARGUMENTS`

Não pergunte autonomia — hotfix sempre roda em modo `auto`.

Fluxo:
1. Confirme feature presente em CODEBASE.md §8.
2. Grave `.claude/state/fix-mode.txt = hotfix` e `fix-autonomy.txt = auto`.
3. Despache `fix-triage-agent` em modo stub (apenas §1/§3/§4; §2/§5/§6/§7 = TODO backfill).
4. Pule fase 2 (regression-testing) — REG vai inline com patch.
5. Despache `fix-implementation-agent` que escreve patch + REG mínimo.
6. Despache `fix-doc-update-agent` que faz backfill obrigatório + Retrospectiva.

`discovery-gate.sh` em hotfix opera em warn-only (não bloqueia).
