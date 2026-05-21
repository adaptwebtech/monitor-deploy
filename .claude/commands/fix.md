---
description: Inicia ciclo de fix (simple-fix) para feature existente. Uso — /fix <descrição do bug ou stacktrace>
---

Invoque a skill `fix-router` com:
- branch pré-selecionada: **simple-fix**
- descrição do usuário: `$ARGUMENTS`

Pergunte ao usuário apenas autonomia (pause vs auto). Default: `pause`.

Depois prossiga com o workflow normal de `fix-router` (validar feature em CODEBASE.md §8, gravar `.claude/state/fix-mode.txt`, despachar `fix-triage-agent`).
