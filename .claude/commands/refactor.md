---
description: Inicia ciclo de refactor (sem mudança de comportamento) para feature existente. Uso — /refactor <descrição da restruturação>
---

Invoque a skill `fix-router` com:
- branch pré-selecionada: **refactor**
- descrição do usuário: `$ARGUMENTS`

Pergunte apenas autonomia (default `pause`).

Se a restruturação proposta mudar assinatura pública (DTO/rota/prop/env var), PARE e instrua o usuário a usar `/fix` (simple-fix) — isso não é refactor.

Demais passos: workflow normal de `fix-router`.
