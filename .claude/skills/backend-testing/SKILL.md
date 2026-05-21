---
name: backend-testing
description: Use this skill whenever the user wants to write tests for the NestJS backend — unit tests, integration tests, or end-to-end (e2e) tests. Covers Jest + Supertest patterns specific to NestJS, including Test.createTestingModule, provider mocking, controller testing, app bootstrap for e2e, guards/interceptors override, and mocking Prisma. Triggers on phrases like "write tests for", "test this service", "unit test", "integration test", "e2e test", "supertest", "TDD this", "test the controller", or "add coverage for". Use this skill even if the user only mentions one test layer — it handles all three coherently. Do NOT use Cypress or Playwright for backend; this stack is Jest + Supertest only. This is phase 2 of a spec → test → code → doc workflow; tests written here should map 1:1 to acceptance criteria from the spec phase, and the backend-implementation phase makes them pass.
---

# Backend Testing — Jest + Supertest (NestJS)

## 🔒 REGRA ABSOLUTA — Mapa é fonte única

`docs/CODEBASE.md` **já está no contexto** (injetado por hook PreToolUse). Cobre tudo: §1/§8 estrutura + feature index, §2/§4 grafo + fluxo, §3/§9 schema + ERD, §5 env vars, §10 símbolos (paths exatos), §11 convenções, **§12 skeletons canônicos (incluindo skeleton de teste Jest+Supertest)**, §13 ponteiros para `docs/implementation/<feature>.md`.

### PROIBIDO
- `grep`, `find`, `ls` para "onde está X" ou "como outros testaram Y".
- `Explore`, `Agent` (qualquer subagent de descoberta) para localizar arquivos, símbolos ou patterns de teste.
- `Read` em `server/src/` **para se inspirar em pattern de teste existente** — use §12.

### PERMITIDO
- `Read` em `docs/specs/<feature>.md` e `docs/implementation/<feature>.md` (sob demanda, só o relevante à tarefa).
- `Read`/`Edit`/`Write` no arquivo de teste que você está editando agora.
- `grep`/`find` apenas para lógica interna não coberta pelo mapa nem pelos docs de implementação.

Se §12/§10/§13 não cobrirem seu caso, **pare e avise o usuário**. Não invente, não greppe.

Mapa desatualizado → pare e avise antes de prosseguir.

---

Three layers. Each answers different question. Don't conflate.

| Layer | Question | Scope | Speed | Mock |
|---|---|---|---|---|
| **Unit** | Class do job in isolation? | One class (service, pipe, guard, interceptor, util) | ms | All deps |
| **Integration** | Classes wire together? | One controller + service + Nest pipes/guards | tens of ms | External boundaries (DB, HTTP, queues) |
| **E2E** | App fulfill contract? | Full app via `app.init()` + HTTP via Supertest | hundreds of ms to seconds | True externals only (3rd-party APIs, payment, email) |

## When to invoke

- "Write tests for the OrdersService"
- "Add e2e tests for the auth endpoints"
- "Test this guard"
- "Cover AC-3 from the spec"
- "TDD the cancel-order flow"

## File layout & naming

```
server/src/
  orders/
    orders.controller.ts
    orders.controller.spec.ts        # integration (controller + real service + mocked repo)
    orders.service.ts
    orders.service.spec.ts           # unit (service in isolation)
    dto/
      create-order.dto.ts
      create-order.dto.spec.ts       # unit (DTO validation rules)
server/test/
  orders.e2e-spec.ts                 # e2e (app bootstrapped, real HTTP via Supertest)
  jest-e2e.json                      # separate Jest config for e2e
  setup-e2e.ts                       # global e2e setup (DB, env)
```

Unit and integration share `jest.config.js` at project root. E2E uses separate config so unit runs stay fast.

## Anatomy of every test

Use **Arrange / Act / Assert** with blank lines between phases. AAA non-negotiable — how implementation skill (and humans) read tests.

```ts
it('returns 404 when the order does not exist', async () => {
  // Arrange
  repo.findOne.mockResolvedValue(null);

  // Act
  const promise = service.findOne('missing-id');

  // Assert
  await expect(promise).rejects.toBeInstanceOf(NotFoundException);
  expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'missing-id' } });
});
```

`describe` blocks group by behavior, not method name. `'when the user is not the owner'` beats `'cancel()'`.

## Map acceptance criteria → tests

Spec has `AC-3: empty items array → 400 with validation error referencing items` → test name must be recognizable:

```ts
describe('POST /orders', () => {
  it('AC-3: rejects an empty items array with 400 + validation error on items', async () => {
    // ...
  });
});
```

Reference AC ID in test name or code comment. Makes spec coverage auditable.

## Layer 1 — Unit tests

Test one class. Mock everything it depends on. No `Test.createTestingModule` needed for plain classes — `new Service(...mocks)` faster and clearer. Use `Test.createTestingModule` only when DI must resolve a graph (rare for pure unit tests).

### Service unit test (preferred, manual instantiation)

```ts
import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let repo: jest.Mocked<OrdersRepository>;
  let payments: jest.Mocked<PaymentGateway>;

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<OrdersRepository>;

    payments = {
      charge: jest.fn(),
      refund: jest.fn(),
    } as unknown as jest.Mocked<PaymentGateway>;

    service = new OrdersService(repo, payments);
  });

  describe('cancel', () => {
    it('throws NotFoundException when order does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.cancel('nope')).rejects.toBeInstanceOf(NotFoundException);
      expect(payments.refund).not.toHaveBeenCalled();
    });

    it('issues a refund and sets status to Cancelled when order is Pending', async () => {
      const order = { id: 'o1', status: 'Pending', txId: 'tx1', total: 100 };
      repo.findOne.mockResolvedValue(order as any);
      repo.update.mockResolvedValue({ ...order, status: 'Cancelled' } as any);
      payments.refund.mockResolvedValue({ status: 'success' });

      const result = await service.cancel('o1');

      expect(payments.refund).toHaveBeenCalledWith('tx1');
      expect(repo.update).toHaveBeenCalledWith('o1', { status: 'Cancelled' });
      expect(result.status).toBe('Cancelled');
    });
  });
});
```

### Service unit test (using TestingModule, when DI resolution helps)

Use when service depends on injection tokens or wiring itself needs verification.

```ts
import { Test } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { ORDERS_REPO, PAYMENT_GATEWAY } from './tokens';

describe('OrdersService (via DI)', () => {
  let service: OrdersService;
  let repo: jest.Mocked<OrdersRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: ORDERS_REPO, useValue: { findOne: jest.fn(), save: jest.fn(), update: jest.fn() } },
        { provide: PAYMENT_GATEWAY, useValue: { charge: jest.fn(), refund: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(OrdersService);
    repo = moduleRef.get(ORDERS_REPO);
  });

  // ... tests
});
```

### Pipe / Guard / Interceptor unit tests

Plain classes. No DI needed for most.

```ts
describe('CreateOrderDto validation', () => {
  it('rejects when items is empty', async () => {
    const errors = await validate(plainToInstance(CreateOrderDto, { items: [] }));
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('arrayNotEmpty');
  });
});

describe('JwtAuthGuard', () => {
  it('returns false when there is no Authorization header', async () => {
    const guard = new JwtAuthGuard(jwtService);
    const ctx = mockExecutionContext({ headers: {} });

    await expect(guard.canActivate(ctx)).resolves.toBe(false);
  });
});
```

## Layer 2 — Integration tests

Wire controller to real service via `Test.createTestingModule`. Mock boundary (repo, external HTTP, queue). Keep validation pipes, guards (or override deliberately), and DTOs real.

```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { OrdersModule } from './orders.module';
import { ORDERS_REPO, PAYMENT_GATEWAY } from './tokens';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('OrdersController (integration)', () => {
  let app: INestApplication;
  const repo = { findOne: jest.fn(), save: jest.fn(), update: jest.fn() };
  const payments = { charge: jest.fn(), refund: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [OrdersModule],
    })
      .overrideProvider(ORDERS_REPO).useValue(repo)
      .overrideProvider(PAYMENT_GATEWAY).useValue(payments)
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.resetAllMocks());

  it('AC-3: returns 400 when items is empty', async () => {
    const res = await request(app.getHttpServer())
      .post('/orders')
      .send({ items: [], shippingAddressId: 'addr-1' });

    expect(res.status).toBe(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([expect.stringMatching(/items/)]),
    );
  });

  it('AC-1: returns 201 with status=Pending on a valid order', async () => {
    repo.save.mockResolvedValue({ id: 'o1', status: 'Pending', total: 100 });
    payments.charge.mockResolvedValue({ txId: 'tx1', status: 'success' });
    repo.update.mockResolvedValue({ id: 'o1', status: 'Confirmed', total: 100, txId: 'tx1' });

    const res = await request(app.getHttpServer())
      .post('/orders')
      .send({ items: [{ productId: 'p1', quantity: 2 }], shippingAddressId: 'addr-1' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'o1' });
  });
});
```

## Layer 3 — End-to-end tests

Boot real `AppModule`. Hit via Supertest. Use real (or test-double) DB. Mock only true externals (payment gateway, SendGrid, Stripe).

### `server/test/jest-e2e.json`

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "setupFilesAfterEach": ["<rootDir>/setup-e2e.ts"]
}
```

### `server/test/orders.e2e-spec.ts`

```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PAYMENT_GATEWAY } from '../src/orders/tokens';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  const payments = { charge: jest.fn(), refund: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PAYMENT_GATEWAY).useValue(payments)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    token = await loginAsTestUser(app);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Clean tables between tests — order matters for FK constraints
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    payments.charge.mockResolvedValue({ txId: 'tx-test', status: 'success' });
  });

  it('AC-1 + AC-7: customer creates an order, payment is charged, order is Confirmed', async () => {
    const product = await seedProduct(prisma, { stockQty: 10, price: 50 });
    const address = await seedAddress(prisma);

    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product.id, quantity: 2 }], shippingAddressId: address.id });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('Confirmed');
    expect(payments.charge).toHaveBeenCalledWith(100);

    const persisted = await prisma.order.findUnique({ where: { id: res.body.id } });
    expect(persisted.status).toBe('Confirmed');
  });
});
```

### Database choice for e2e

Pick one — write it in repo so it's not relitigated:
- **Real Postgres in Docker via Testcontainers or docker-compose.test.yml** — highest fidelity, correct default for this stack. After starting the container, run `npx prisma migrate deploy` to apply migrations against the test DB before tests begin.
- **SQLite in-memory** — fast, but incompatible with Postgres-specific SQL/types/extensions. Avoid unless there is no alternative.
- **Mocked at repository layer** — fastest, but not real e2e. Reserve for emergency speed-ups.

## Mocking patterns by ORM

### Prisma (primary — this project uses Prisma + PostgreSQL)

```ts
// Mock PrismaService
const prismaMock = {
  order: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(async (cb) => cb(prismaMock)),
}

// In TestingModule:
{
  provide: PrismaService,
  useValue: prismaMock,
}

// Reset between tests:
beforeEach(() => {
  jest.resetAllMocks()
})
```

### TypeORM repository (secondary option)

```ts
import { getRepositoryToken } from '@nestjs/typeorm';

const moduleRef = await Test.createTestingModule({
  providers: [
    OrdersService,
    {
      provide: getRepositoryToken(Order),
      useValue: { findOne: jest.fn(), find: jest.fn(), save: jest.fn(), update: jest.fn() },
    },
  ],
}).compile();
```

## Overriding guards, interceptors, and config

```ts
moduleRef
  .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
  .overrideInterceptor(LoggingInterceptor).useValue({ intercept: (_, n) => n.handle() })
  .overrideProvider(ConfigService).useValue({ get: (k) => testConfig[k] });
```

Role-based testing — override guard with stub reading header:

```ts
.overrideGuard(JwtAuthGuard).useValue({
  canActivate: (ctx) => {
    const req = ctx.switchToHttp().getRequest();
    req.user = { id: req.headers['x-test-user'], role: req.headers['x-test-role'] };
    return true;
  },
})
```

Then in tests: `.set('x-test-user', 'u1').set('x-test-role', 'customer')`.

## Coverage strategy

- **Unit**: aim 80–95% on services and pure logic. Don't chase trivial code (constructors, plain getters).
- **Integration**: cover every controller route × every documented status code.
- **E2E**: cover happy path of each user-facing flow + one or two highest-risk error paths (auth failure, ownership violation, payment failure). Don't e2e every 400 — that's integration layer's job.

Every AC must point to specific test. Untested AC = not done.

## What this skill will NOT do

- **No Cypress / Playwright.** Jest + Supertest only. Browser-driven tests = separate decision, separate skill.
- **No snapshot tests for API responses.** Snapshots pass for wrong reasons. Assert on shape and meaningful fields explicitly.
- **No "test the framework" tests.** Don't test `@IsEmail()` rejects bad emails — class-validator's authors did. Test your DTO's specific composition (required fields, conditional rules, custom validators).

## Common mistakes to avoid

- **Mocking what you're testing.** Unit-testing service → service is real, repo is mocked. Not reversed.
- **Sharing state between tests.** Use `beforeEach` to reset mocks (`jest.resetAllMocks()`) and DB state. Test order must not matter.
- **Asserting on logs / `console.log`.** Logs not contracts. Assert on side effects (DB writes, HTTP calls, returned values).
- **`expect(...).toBeDefined()` as only assertion.** Too weak. Assert actual value or shape.
- **Catching errors with try/catch.** Use `await expect(promise).rejects.toBeInstanceOf(...)` — try/catch lets missing throw silently pass.
- **One giant `it` block.** Split. Each test asserts one behavior.

---

## Execution mode — subagent dispatch

Esta skill **delega a execução** ao subagent `backend-testing-agent` (`.claude/agents/backend-testing-agent.md`) para reduzir gasto de contexto na main thread. O subagent recebe contexto compacto (feature, paths relevantes), executa todo o trabalho (Read amplo, iteração test/lint/build, Write), e retorna apenas o bloco de status descrito no §Output do agent.

**Main thread (esta skill):**
1. Validar pré-condições (spec existe, ACs presentes, fases anteriores done).
2. Preparar prompt para o subagent: feature, spec path, contexto extra do usuário.
3. Invocar via Agent tool com `subagent_type: backend-testing-agent`.
4. Apresentar o retorno compacto ao usuário; se autonomy=pause, esperar aprovação.
5. Não duplicar trabalho do subagent inline na main.

**Quando NÃO usar subagent:**
- Tarefa trivial (typo em um teste, rename de uma constante) — edite direto.
- Usuário pediu explicitamente "faça você mesmo passo a passo".

Critérios de done, anti-patterns e regras detalhadas continuam descritos acima — o subagent segue esta SKILL.md como contrato.
