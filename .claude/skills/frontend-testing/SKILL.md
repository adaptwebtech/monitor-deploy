---
name: frontend-testing
description: Internal phase-2 skill dispatched by feature-router. Writes Vitest + Playwright tests against spec ACs. Do not invoke directly — use /feature.
---

# Frontend Testing — Vitest + Vue Test Utils + Playwright

## Map rule
CODEBASE.md in context (hook-injected). Use §1/§8 structure, §10 symbols (stores/composables/views — exact paths), §11 Vue conventions, §12 skeletons, §13 impl docs.
FORBIDDEN: `grep`/`find`/`ls`/`Explore`/`Agent` for discovery. `Read src/` for inspiration.
ALLOWED: `Read docs/specs/*.md`, `docs/implementation/<feature>.md`, current test file.
Map stale or case not covered → stop and tell user.

---

Phase 2: spec exists with ACs. Write tests that fail. No implementation yet.

## Three layers

| Layer | Question | Scope | Mock |
|---|---|---|---|
| Component unit | Renders + behaves correctly? | One `.vue` file | All external deps (stores, router, fetch) |
| Integration | Components + stores + router wire together? | Feature sub-tree + real Pinia + real Router | HTTP only |
| E2E (Playwright) | User flows work in browser? | Full app | None |

## File layout

```
frontend/src/<feature>/
  components/
    OrderCard.spec.ts        # component unit
  views/
    OrdersView.spec.ts       # integration (view + store + router)
  stores/
    orders.store.spec.ts     # store unit
  composables/
    useOrders.spec.ts        # composable unit
frontend/e2e/
  orders.spec.ts             # Playwright e2e
```

One spec file per source file. Tests next to source (except e2e → `e2e/`).

## AC mapping
Every test name must reference its AC ID from the spec:
```ts
it('AC-3: shows cancel button only when status is Pending', ...)
it('AC-4: hides cancel button when status is Shipped', ...)
```
Minimum one test per AC. Multiple edge cases → multiple tests, same AC ID.

## AAA anatomy (mandatory)
Every test: Arrange → Act → Assert with blank line between phases. See §12 for full examples.

## Layer 1 — Component unit setup rules
- `mount` or `shallowMount` from `@vue/test-utils`
- Mock Pinia with `createTestingPinia` from `@pinia/testing`
- Mock router with `vi.fn()` stubs
- `setActivePinia(createPinia())` in `beforeEach` — never share state
- `vi.restoreAllMocks()` in `afterEach`

Assert: rendered text, classes, `wrapper.emitted()`, slot content, `exists()`, `findAll().length`.
Target elements only with `[data-test="..."]` — never CSS classes.

## Layer 1 — Pinia store unit setup rules
- `setActivePinia(createPinia())` in `beforeEach`
- `vi.stubGlobal('fetch', vi.fn())` for HTTP
- `vi.restoreAllMocks()` in `afterEach`

## Layer 1 — Composable unit setup rules
Same as store. Stub fetch. Wrap in `withSetup` helper if composable requires Vue context.

## Layer 2 — Integration setup rules
- Real Pinia (`createPinia()`), not `createTestingPinia`
- Real Vue Router with `createMemoryHistory`
- Stub HTTP — no real network
- `await router.isReady()` before asserting navigation-dependent state
- `await flushPromises()` after async store actions

## Layer 3 — Playwright e2e
Use `baseURL: 'http://localhost:5173'` + `webServer: { command: 'npm run dev', ... }`.
Target `[data-test="..."]` selectors. Never CSS classes. See §12 for `playwright.config.ts` skeleton.

## Coverage strategy
- Component: every prop variation, every `v-if`/`v-show` branch, every emitted event
- Integration: every route + every user action + success/empty/error API shapes
- E2E: one test per AC tagged `[e2e]` + highest-risk error paths

## Will NOT do
- No Cypress — Playwright only
- No snapshot tests — assert elements explicitly
- No testing Bootstrap internals — test app behavior

## Common mistakes
- Forget `await flushPromises()` after async actions → DOM won't update
- Skip `vi.restoreAllMocks()` in `afterEach` → test pollution
- Leak Pinia state → call `setActivePinia(createPinia())` in `beforeEach`
- Playwright relying on animation timing → use `waitFor`/`toBeVisible()`, never `sleep`
- Assert `.btn-danger` class → testing Bootstrap, not your app
- Skip `await router.isReady()` before navigation assertions

## Dispatch
Validate preconditions (spec with ACs exists). Read spec §6 — extract `[frontend]` + `[e2e]` ACs + §15 component hierarchy as inline context. Invoke `frontend-testing-agent`. Don't duplicate work. Direct edit only for trivial tasks or explicit user request.
