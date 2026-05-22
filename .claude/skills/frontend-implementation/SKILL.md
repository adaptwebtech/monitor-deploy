---
name: frontend-implementation
description: Internal phase-3 skill dispatched by feature-router. Implements Vue 3 components/stores/composables until tests GREEN. Do not invoke directly — use /feature.
---

# Frontend Implementation — Vue 3 + Bootstrap 5

## Map rule
CODEBASE.md in context (hook-injected). Use §1/§8 structure, §7 central types, §10 symbols (stores/composables/views — exact paths), §11 Vue conventions, §12 skeletons, §13 impl docs.
FORBIDDEN: `grep`/`find`/`ls`/`Explore`/`Agent` for discovery. `Read src/` for inspiration.
ALLOWED: `Read docs/specs/*.md`, `docs/implementation/<feature>.md`, current file under edit.
Map stale or case not covered → stop and tell user.

---

Phase 3: spec + tests exist. Write code to make tests GREEN. No shortcuts tests don't catch.

## Folder layout

```
frontend/src/<feature>/
  components/    # reusable, presentational
  views/         # page-level, wired to routes
  stores/        # Pinia stores
  composables/   # reusable reactive logic
  types/         # TypeScript interfaces for this feature
```

See §12 for component, store, composable, and view skeletons.

## Vue 3 rules
- `<script setup>` always — no Options API
- `defineProps<T>()` with explicit TypeScript interface
- `defineEmits<T>()` with explicit event types
- Props read-only in — never mutate a prop, emit events out
- `defineExpose()` only when tests need internal state

## Bootstrap 5 rules
- `.container`/`.row`/`.col-*` for layout
- `.btn btn-<variant>` on all buttons — never raw `<button>` without class
- `.badge`, `.alert`, `.card`, `.modal` — use semantic components
- Semantic color classes only (`.text-primary`, `.bg-danger`) — never hardcode colors
- No custom CSS unless Bootstrap utilities insufficient — scope with `<style scoped>`
- Every interactive element: `data-test="..."` attribute
- Never target by CSS class in tests — only `[data-test]` selectors

## Pinia store rules
- Setup-style store: `defineStore('id', () => { ... })` — not options-style
- Every async action: `isLoading = true` at start, `false` in `finally`
- Every async action: catch errors, set `error` ref — no uncaught rejections
- Return only what components need
- No `fetch` from components — always a store action

## Composable rules
- Name starts with `use`
- Return computed refs (read-only), not raw store refs
- No `fetch` in composables — delegate to store actions
- Thin wrappers with no reason = don't create

## Router rules
- Named routes only: `router.push({ name: 'orders' })` — never magic path strings
- Lazy-load all views: `() => import(...)`
- Auth guard in `beforeEach`, not in components
- Route params via `props: true` + typed `defineProps`

## View rules
- Views coordinate — delegate logic to composables, rendering to components
- View > ~100 lines = extract a component
- Always handle 3 states: loading, error, empty
- `onMounted` triggers data fetch

## Order of writing (TDD)
1. Types (`types/<feature>.types.ts`)
2. Store (store unit tests green)
3. Composables if needed (composable tests green)
4. Leaf components (component tests green)
5. Composite components (component tests green)
6. Views (integration tests green)
7. Router config (Playwright e2e tests green)

Never move to next layer with red tests.

## Checklist
- [ ] Every AC has passing test referencing it
- [ ] No `fetch` in components — all through store actions
- [ ] No raw CSS colors — Bootstrap utilities only
- [ ] All interactive elements + meaningful containers have `data-test`
- [ ] Named routes everywhere — no magic strings
- [ ] No Options API
- [ ] No prop mutation
- [ ] `isLoading` + `error` + empty state in every view
- [ ] All views lazy-loaded in router
- [ ] No `any`, no unjustified non-null assertions

## Anti-patterns
| Anti-pattern | Fix |
|---|---|
| `fetch` in component | Move to store action |
| `router.push('/orders')` | Use named route |
| Custom color CSS | Bootstrap semantic utilities |
| Options API | Rewrite as `<script setup>` |
| View > ~100 lines | Extract child component |
| No `data-test` on interactive elements | Add before writing tests |
| Missing loading/error/empty state | Handle all 3 |
| Non-lazy view imports | `() => import(...)` in router |

## Dispatch
Validate preconditions (spec + tests exist). Read spec §6 — extract `[frontend]` ACs + §15 component hierarchy as inline context. Invoke `frontend-implementation-agent`. Don't duplicate work. Direct edit only for trivial tasks or explicit user request.
