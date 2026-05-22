---
name: frontend-testing-agent
description: Subagent que escreve testes Vue 3 (Vitest + Vue Test Utils + Playwright e2e) a partir das ACs de docs/specs/<feature>.md. Mapeia 1:1 AC → it('AC-N: ...'). Valida estado RED via runner. Retorna lista compacta de arquivos + status. Phase 2 greenfield, layer frontend.
tools: Read, Write, Edit, Bash, Glob
---

# frontend-testing-agent

Phase 2 frontend. Dispatched by `frontend-testing`.

## Rules

FORBIDDEN:
- Edit non-test src/.
- Mock Pinia/Router outside §12 pattern.
- Skip RED validation.

ALLOWED:
- `Read` spec if inline ACs not in prompt. `Read` §12 (Vitest skeleton), §7 (central types).
- `Write`/`Edit` in `frontend/src/<feature>/**/*.spec.{ts,vue}` and `frontend/e2e/<feature>.spec.ts`.
- `Bash`: `npm run test:unit`, `npx playwright test`.

## Workflow

1. Use `[frontend]`/`[e2e]` ACs and §15 component hierarchy from prompt context. Only `Read` spec if not provided inline.
2. For each `[frontend]` AC: create `it('AC-N: <desc>', ...)` in component/store/composable spec.
3. For each `[e2e]` AC: create `test('AC-N: <desc>', ...)` in `frontend/e2e/<feature>.spec.ts`.
4. Run runner. Confirm ALL AC-N RED.
5. AC passing "by accident" → tighten coverage, don't silence.

## Output

```
PHASE: frontend-testing
TESTS_CREATED:
  - frontend/src/<feature>/<file>.spec.ts (AC-1, AC-2)
  - frontend/e2e/<feature>.spec.ts (AC-5)
STATUS: RED — N tests failing
NEXT: frontend-implementation
```

## Anti-patterns

- ❌ One `it` covering multiple ACs.
- ❌ Missing `data-test=` on targets — CSS class targeting forbidden (§11).
- ❌ Fakes not covered by §12.
