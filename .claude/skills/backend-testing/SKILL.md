---
name: backend-testing
description: Internal phase-2 skill dispatched by feature-router. Writes Jest + Supertest tests against spec ACs. Do not invoke directly — use /feature.
---

# Backend Testing — Jest + Supertest (NestJS)

## Map rule
CODEBASE.md in context (hook-injected). Use §1/§8 structure, §2/§4 module graph, §3/§9 schema, §10 symbols, §11 conventions, §12 skeletons, §13 impl docs.
FORBIDDEN: `grep`/`find`/`ls`/`Explore`/`Agent` for discovery. `Read src/` for inspiration.
ALLOWED: `Read docs/specs/*.md`, `docs/implementation/<feature>.md`, current test file.
Map stale or case not covered → stop and tell user.

---

Phase 2: spec exists with ACs. Write tests that fail. No implementation yet.

## Three layers

| Layer | Question | Scope | Mock |
|---|---|---|---|
| Unit | Class works in isolation? | One class | All deps |
| Integration | Controller + service wire together? | Controller + real service + Nest pipes/guards | DB, HTTP, queues |
| E2E | App fulfills HTTP contract? | Full `AppModule` + Supertest | True externals only |

## File layout

```
server/src/<feature>/
  <x>.service.spec.ts          # unit
  <x>.controller.spec.ts       # integration
  dto/create-<x>.dto.spec.ts   # unit (DTO validation)
server/test/
  <feature>.e2e-spec.ts        # e2e
  jest-e2e.json
  setup-e2e.ts
```

Unit + integration share root `jest.config.js`. E2E uses `jest-e2e.json`. See §12 for e2e config skeleton.

## AC mapping
Every test name must reference its AC ID:
```ts
it('AC-3: rejects empty items array with 400 + validation error on items', ...)
```
Untested AC = not done.

## AAA anatomy (mandatory)
Every test: Arrange → Act → Assert with blank line between phases.
`describe` blocks group by behavior, not method: `'when order is Shipped'` beats `'cancel()'`.

## Layer 1 — Unit
One class. Mock all deps. Prefer manual instantiation (`new Service(...mocks)`) over `Test.createTestingModule` — faster, clearer. Use `createTestingModule` only when DI token resolution is under test.

Setup: `jest.fn()` mocks in `beforeEach`. `jest.resetAllMocks()` in `beforeEach`.
See §12 for service unit test + DTO validation skeleton.

## Layer 2 — Integration
Wire controller to real service via `Test.createTestingModule`. Override providers for boundaries (repo, HTTP, queues). Keep `ValidationPipe`, guards (or override deliberately), DTOs real.

`app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))` — same as prod.
`jest.resetAllMocks()` in `beforeEach`. `app.close()` in `afterAll`.
See §12 for full integration test skeleton.

## Layer 3 — E2E
Boot real `AppModule`. Override only true externals (payment gateway, SendGrid, etc.). Use real DB (Postgres in Docker/Testcontainers — SQLite incompatible with Postgres SQL/types). Run `npx prisma migrate deploy` before tests. Clean tables in `beforeEach` in FK order.

See §12 for e2e spec skeleton.

## DB choice (pick one, document it)
- **Real Postgres via docker-compose.test.yml** — correct default for this stack
- **SQLite** — avoid: incompatible types/extensions
- **Mocked at repo layer** — fastest, but not real e2e

## Overriding guards/interceptors
```ts
.overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
// Role-based stub:
.overrideGuard(JwtAuthGuard).useValue({
  canActivate: (ctx) => {
    const req = ctx.switchToHttp().getRequest();
    req.user = { id: req.headers['x-test-user'], role: req.headers['x-test-role'] };
    return true;
  },
})
```

## Coverage strategy
- Unit: 80-95% on services and logic. Skip trivial constructors/getters.
- Integration: every route × every documented status code.
- E2E: happy path per user flow + auth failure, ownership violation, payment failure. Don't e2e every 400 — that's integration layer's job.

## Will NOT do
- No Cypress/Playwright — Jest + Supertest only
- No snapshot tests on API responses — assert shape explicitly
- No "test the framework" — don't test `@IsEmail()` rejects bad emails

## Common mistakes
- Mocking what you're testing (unit test service → service is real, repo is mocked)
- Sharing state between tests (use `beforeEach` to reset mocks + DB)
- Asserting on logs — assert side effects instead
- `expect(...).toBeDefined()` as only assertion — too weak
- `try/catch` instead of `await expect(promise).rejects.toBeInstanceOf(...)`
- One giant `it` block — split, one behavior per test

## Dispatch
Validate preconditions (spec with ACs exists). Read spec §6 — extract `[backend]` ACs + §7 API contract as inline context. Invoke `backend-testing-agent`. Don't duplicate work. Direct edit only for trivial tasks or explicit user request.
