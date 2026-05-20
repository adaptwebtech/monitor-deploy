---
name: backend-implementation
description: Use this skill whenever the user wants to implement, code, or build NestJS backend code following solid architectural conventions — DTOs, modules, dependency injection, SOLID principles, validation, exception handling, Prisma, Redis caching, and proper folder structure. Triggers on phrases like "implement this feature", "code the module", "build the service", "write the controller", "make the tests pass", or any request to write production backend code. Especially relevant when a spec or tests already exist and code must be written to satisfy them. This is phase 3 of a spec → test → code → doc workflow; the goal is to produce code that satisfies the tests written in phase 2 against the spec written in phase 1.
---

# Backend Implementation — NestJS + Prisma

## 🔒 REGRA ABSOLUTA — Mapa é fonte única

`docs/CODEBASE.md` **já está no contexto** (injetado por hook PreToolUse). Cobre tudo que você precisa:

- §1/§8 estrutura e índice feature → arquivos
- §2/§4 grafo de módulos backend e fluxo de request
- §3/§9 schema Prisma + ERD
- §5 env vars
- §10 índice de símbolos (paths exatos)
- §11 convenções (NestJS/Vue/k8s/Swagger)
- **§12 skeletons canônicos por tipo de artefato (module, controller, service, DTO, health route, etc.)**
- §13 ponteiros para `docs/implementation/<feature>.md` (ground-truth por feature)

### PROIBIDO

- `grep`, `find`, `ls` para "onde está X" ou "como outros fizeram Y".
- `Explore`, `Agent` (qualquer `subagent_type` de descoberta) para localizar arquivos, símbolos ou patterns.
- `Read` em `server/src/`, `frontend/src/`, `k8s/`, `prisma/` **para se inspirar em pattern existente** — use §12 skeletons.

### PERMITIDO

- `Read` em `docs/specs/*.md` e `docs/implementation/<feature>.md` (sob demanda, **só o relevante** à tarefa). É doc, não src.
- `Read`/`Edit`/`Write` no arquivo que você está editando agora.
- `grep`/`find` **apenas** para lógica interna de função específica que o mapa e os docs de implementação não cobrem.

Se §12/§10/§13 não cobrirem seu caso, **pare e avise o usuário**. Não invente, não greppe.

Mapa parecer desatualizado → pare e avise antes de prosseguir.

---

Phase 3: spec → test → code. Spec and tests exist. Skill writes code to make tests pass — no shortcuts tests don't catch.

## When to invoke

- "Implement the orders module"
- "Write the service to make these tests pass"
- "Build the controller for AC-1 through AC-5"
- "Code this feature"

## Folder layout (per feature)

One module per feature. Self-contained. No barrel files unless earned — obscure circular deps, slow tree-shaking debug.

```
server/src/
  orders/
    dto/
      create-order.dto.ts
      update-order.dto.ts
      cancel-order.dto.ts
      order-response.dto.ts
    entities/
      order.entity.ts
      order-item.entity.ts
    interfaces/
      payment-gateway.interface.ts
    orders.controller.ts
    orders.service.ts
    orders.repository.ts          # if you wrap the ORM (recommended)
    orders.module.ts
    tokens.ts                     # injection tokens for interfaces
```

Tests alongside source (`*.spec.ts`), e2e in `server/test/`. See testing skill.

## No inline types — ever

**Every shape must have a name.** No anonymous object types in function signatures, return types, or variable declarations.

```ts
// WRONG — inline object type
async create(data: { userId: string; total: number; status: string }): Promise<Order>

// WRONG — structural utility type used directly
async update(id: string, data: Partial<Omit<Order, 'id'>>): Promise<Order>

// WRONG — Prisma type-kung-fu leaking into interface
create(data: Parameters<typeof this.prisma.order.create>[0]['data']): Promise<Order>

// CORRECT — named DTO (HTTP boundary) or named interface (internal)
async create(data: CreateOrderData): Promise<Order>
async update(id: string, data: UpdateOrderData): Promise<Order>
```

**Rule:** Can't name the shape → spec is incomplete. Go back to Phase 1.

- HTTP boundary → DTO class in `dto/` (with class-validator + `@ApiProperty`)
- Internal contract → TypeScript `interface` in `interfaces/`
- Utility types (`Partial`, `Omit`, `Pick`) allowed **only** inside named type/interface aliases — never naked in a signature

## DTO conventions

DTOs = contract at HTTP boundary. Not entities. Never accept entity as request body or return one directly.

### Separate DTOs for distinct shapes

| DTO | Purpose | Validation |
|---|---|---|
| `CreateXDto` | POST body | strict — every required field |
| `UpdateXDto` | PATCH body | all fields optional via `PartialType` |
| `XQueryDto` | GET query params | `@Type(() => Number)` etc. for transforms |
| `XResponseDto` | API return shape | no validators — only `@Expose()` / serialization rules |

### Example

```ts
// dto/create-order.dto.ts
import { ArrayNotEmpty, IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class OrderItemDto {
  @ApiProperty({ description: 'UUID do produto', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'Quantidade do item', example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemDto], description: 'Lista de itens do pedido' })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({ description: 'UUID do endereço de entrega', example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  @IsUUID()
  shippingAddressId: string;
}
```

```ts
// dto/update-order.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {}
```

```ts
// dto/order-response.dto.ts
import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class OrderResponseDto {
  @ApiProperty({ description: 'UUID do pedido', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @Expose() id: string;

  @ApiProperty({ description: 'Status atual do pedido', example: 'Confirmed', enum: ['Pending', 'Confirmed', 'Shipped', 'Cancelled'] })
  @Expose() status: 'Pending' | 'Confirmed' | 'Shipped' | 'Cancelled';

  @ApiProperty({ description: 'Valor total em reais', example: 150.00 })
  @Expose() total: number;

  @ApiProperty({ description: 'Data de criação do pedido' })
  @Expose() @Type(() => Date) createdAt: Date;
}
```

Enable validation globally in `main.ts`:

```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,        // strip unknown properties
  forbidNonWhitelisted: true, // 400 if unknown property
  transform: true,        // transform plain objects → class instances
  transformOptions: { enableImplicitConversion: true },
}));
```

## Modules — one per feature, explicit boundaries

Every module: clear unit with `imports`, `controllers`, `providers`, `exports`. Export only what other modules genuinely need.

```ts
// orders.module.ts
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { PaymentsModule } from '../payments/payments.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PAYMENT_GATEWAY } from './tokens';
import { StripePaymentGateway } from '../payments/stripe-payment-gateway';

@Module({
  imports: [
    PrismaModule,
    PaymentsModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersRepository,
    { provide: PAYMENT_GATEWAY, useClass: StripePaymentGateway },
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
```

**Rules:**
- Module exposing nothing (`exports: []`) fine — most feature modules are leaf-like.
- Avoid `forwardRef` — almost always wrong module boundaries. Refactor first.
- No `@Global()` on feature modules. Reserve for cross-cutting (logging, config) and even then, sparse.

## Dependency Inversion — code against interfaces

Services depend on **interfaces**, not concretes. Wire concrete in module. Enables testing skill's "swap in fake" pattern.

### Pattern: interface + token + binding

```ts
// orders/interfaces/payment-gateway.interface.ts
export interface PaymentGateway {
  charge(amountCents: number, ref: string): Promise<{ txId: string; status: 'success' | 'failed' }>;
  refund(txId: string): Promise<{ status: 'success' | 'failed' }>;
}

// orders/tokens.ts
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
```

```ts
// orders.service.ts
import { Inject, Injectable } from '@nestjs/common';
import type { PaymentGateway } from './interfaces/payment-gateway.interface';
import { PAYMENT_GATEWAY } from './tokens';

@Injectable()
export class OrdersService {
  constructor(
    private readonly repo: OrdersRepository,
    @Inject(PAYMENT_GATEWAY) private readonly payments: PaymentGateway,
  ) {}
  // ...
}
```

**D** in SOLID. Makes testing cheap.

## SOLID in practice

### S — Single Responsibility

Service = one reason to change. If `OrdersService` sends emails, calculates tax, *and* talks to payment gateway — three things can break it. Split:

- `OrdersService` — order lifecycle
- `TaxCalculator` — tax math
- `OrderNotifications` — emails/webhooks

Class ~300 lines or method ~30 lines = smell worth investigating.

### O — Open/Closed

Add behavior by adding new code, not modifying existing. Strategy pattern = typical NestJS expression — different `PaymentGateway` implementations via different module configs.

### L — Liskov

Subclass must satisfy every parent contract. Matters most for guard/interceptor/pipe inheritance — don't override `canActivate` to mean something parent didn't promise.

### I — Interface Segregation

Don't force consumer to depend on unused methods. If `OrdersService` only calls `payments.charge`, don't depend on `BillingFacade` with 12 invoice methods. Define narrow `PaymentGateway` instead.

### D — Dependency Inversion

Covered above — depend on interfaces, wire concretes in module.

## Service implementation pattern

```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { plainToInstance } from 'class-transformer';
import { Inject } from '@nestjs/common';
import { PAYMENT_GATEWAY } from './tokens';
import type { PaymentGateway } from './interfaces/payment-gateway.interface';

@Injectable()
export class OrdersService {
  constructor(
    private readonly repo: OrdersRepository,
    @Inject(PAYMENT_GATEWAY) private readonly payments: PaymentGateway,
  ) {}

  async create(userId: string, dto: CreateOrderDto): Promise<OrderResponseDto> {
    const total = dto.items.reduce((sum, i) => sum + i.quantity * 50, 0); // priced via product lookup in real code
    const order = await this.repo.create({ userId, items: dto.items, total, status: 'Pending' });

    const payment = await this.payments.charge(total * 100, order.id);
    if (payment.status !== 'success') {
      await this.repo.update(order.id, { status: 'Cancelled' });
      throw new ConflictException('Payment failed');
    }

    const confirmed = await this.repo.update(order.id, { status: 'Confirmed', txId: payment.txId });
    return plainToInstance(OrderResponseDto, confirmed, { excludeExtraneousValues: true });
  }

  async cancel(userId: string, id: string): Promise<OrderResponseDto> {
    const order = await this.repo.findOne(id);
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    if (order.userId !== userId) throw new NotFoundException(`Order ${id} not found`); // don't leak existence
    if (!['Pending', 'Confirmed'].includes(order.status)) {
      throw new ConflictException(`Order in status ${order.status} cannot be cancelled`);
    }

    if (order.txId) await this.payments.refund(order.txId);
    const cancelled = await this.repo.update(id, { status: 'Cancelled' });
    return plainToInstance(OrderResponseDto, cancelled, { excludeExtraneousValues: true });
  }
}
```

## Controller implementation pattern

Controllers thin. Map HTTP to service calls. No business logic.

```ts
import { Body, Controller, Delete, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';

@ApiTags('Pedidos')
@ApiBearerAuth('bearer')
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Criar pedido', description: 'Cria um novo pedido para o usuário autenticado.' })
  @ApiResponse({ status: 201, description: 'Pedido criado com sucesso.', type: OrderResponseDto })
  @ApiResponse({ status: 400, description: 'Dados inválidos no corpo da requisição.' })
  @ApiResponse({ status: 401, description: 'Token de autenticação ausente ou inválido.' })
  @ApiResponse({ status: 409, description: 'Pagamento falhou.' })
  create(@Req() req: AuthedRequest, @Body() dto: CreateOrderDto) {
    return this.orders.create(req.user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancelar pedido', description: 'Cancela um pedido existente do usuário autenticado.' })
  @ApiResponse({ status: 200, description: 'Pedido cancelado com sucesso.', type: OrderResponseDto })
  @ApiResponse({ status: 401, description: 'Token de autenticação ausente ou inválido.' })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado.' })
  @ApiResponse({ status: 409, description: 'Pedido não pode ser cancelado no status atual.' })
  cancel(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.cancel(req.user.id, id);
  }
}
```

## Swagger / OpenAPI

Swagger decorators are **mandatory**. Write them in the same commit as class-validator decorators — never a separate "add swagger later" commit.

### DTOs

- Every field: `@ApiProperty()` or `@ApiPropertyOptional()` with `description` and `example`.
- `PartialType` must be imported from `@nestjs/swagger` (not `@nestjs/mapped-types`) — preserves optionality in Swagger UI.

### Controllers

- `@ApiTags('NomePT-BR')` on every controller class.
- `@ApiBearerAuth('bearer')` on guarded controller classes.
- `@ApiOperation({ summary, description })` on every method — text in PT-BR.
- `@ApiResponse({ status, description, type })` for every possible HTTP status (200/201, 400, 401, 403, 404, 409…).

### main.ts setup (once per app)

```ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('Monitor Deploy API')
  .setDescription('Documentação da API')
  .setVersion('1.0')
  .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('docs', app, document);
```

Swagger UI at `/docs`. Never change the path without updating CLAUDE.md.

## Repository pattern (recommended)

Wrap ORM in own repository class. Service depends on **your** repository interface, not Prisma directly. Benefits:
- ORM-specific code in one place.
- Unit test mock surface tiny and stable.
- Swap ORMs without rewriting services.

```ts
// orders/interfaces/order-repository.interface.ts
import type { Order } from '@prisma/client'

export interface CreateOrderData {
  userId: string;
  items: OrderItemData[];
  total: number;
  status: string;
}

export interface OrderItemData {
  productId: string;
  quantity: number;
}

export interface UpdateOrderData {
  status?: string;
  txId?: string;
}

export interface IOrdersRepository {
  findOne(id: string): Promise<Order | null>;
  create(data: CreateOrderData): Promise<Order>;
  update(id: string, data: UpdateOrderData): Promise<Order>;
}
```

```ts
// orders.repository.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { Order } from '@prisma/client'
import type { IOrdersRepository, CreateOrderData, UpdateOrderData } from './interfaces/order-repository.interface'

@Injectable()
export class OrdersRepository implements IOrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOne(id: string): Promise<Order | null> {
    return this.prisma.order.findUnique({ where: { id } })
  }

  create(data: CreateOrderData): Promise<Order> {
    return this.prisma.order.create({ data })
  }

  update(id: string, data: UpdateOrderData): Promise<Order> {
    return this.prisma.order.update({ where: { id }, data })
  }
}
```

## Exception handling

Use NestJS built-in exceptions. Map to status codes automatically. Don't return `{ error: ... }` from services — throw.

| Built-in | Status |
|---|---|
| `BadRequestException` | 400 |
| `UnauthorizedException` | 401 |
| `ForbiddenException` | 403 |
| `NotFoundException` | 404 |
| `ConflictException` | 409 |
| `UnprocessableEntityException` | 422 |
| `InternalServerErrorException` | 500 |
| `BadGatewayException` | 502 |

Domain errors that don't map cleanly: define own exception extending `HttpException`. Reach for built-ins first.

## Configuration

Use `@nestjs/config`. Never read `process.env` in business code.

```ts
// config/configuration.ts
export default () => ({
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
  },
  payments: {
    stripeKey: process.env.STRIPE_KEY,
  },
});
```

```ts
// usage
constructor(private readonly config: ConfigService) {}
const key = this.config.get<string>('payments.stripeKey');
```

Type-safe config: validate with class-validator + schema class, or Joi via `validationSchema`.

## Redis caching

Use `@nestjs/cache-manager` with ioredis store for caching. Inject via `CACHE_MANAGER` token.

```ts
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { Inject, Injectable } from '@nestjs/common'

@Injectable()
export class OrdersService {
  constructor(
    private readonly repo: OrdersRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async findOne(id: string) {
    const cacheKey = `order:${id}`
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached

    const order = await this.repo.findOne(id)
    if (order) await this.cache.set(cacheKey, order, 300) // 5 min TTL
    return order
  }

  async update(id: string, data: Partial<Order>) {
    const updated = await this.repo.update(id, data)
    await this.cache.del(`order:${id}`) // invalidate on write
    return updated
  }
}
```

Rules:
- Cache reads before DB. Cache writes after DB write. Invalidate on mutations.
- TTL in seconds. Keep short (60-300s) for mutable data.
- Cache keys: `resource:id` pattern. Never cache raw entities with sensitive fields.
- Don't cache in repository — cache in service, so business-level invalidation is clear.

## Order of writing code (TDD-friendly)

Tests exist. Implement in order:

0. **Run `npx prisma generate`** to create the Prisma client before writing any code that imports from `@prisma/client`.
1. **Entities** — match ER diagram from spec.
2. **DTOs** — match API contract section of spec.
2.5. **Swagger decorators on DTOs** — add `@ApiProperty` in the same edit as class-validator decorators.
3. **Interfaces and tokens** — define abstractions services depend on.
4. **Repository** — thin Prisma wrapper satisfying interface.
5. **Service** — pure business logic, depends only on repository + interfaces. Run unit tests; iterate.
6. **Controller** — thin HTTP mapping. Run integration tests; iterate.
6.5. **Swagger decorators on controller** — `@ApiTags`, `@ApiOperation`, `@ApiResponse` before moving on.
7. **Module** — wire together. Run e2e tests; iterate.
8. **Register module** in `AppModule` (or parent).

Each step ends green. Don't move to next layer with red tests behind you.

## What good looks like (checklist)

Before calling implementation done:

- [ ] `npx prisma generate` run after any schema change.
- [ ] Every spec acceptance criterion has passing test referencing it.
- [ ] No service method does more than one thing — split if needed.
- [ ] No `process.env` access outside `ConfigService` setup.
- [ ] No DTOs leak `Date`-as-string ambiguity — use `@Type(() => Date)` where relevant.
- [ ] No inline `{ ... }` types in any function signature — use DTO class (HTTP boundary) or named `interface` (internal).
- [ ] No naked utility types (`Partial<Omit<X,...>>`) in function signatures — wrapped in named type alias or interface.
- [ ] Every internal data contract (repository input/output, service boundaries) has a named interface in `interfaces/`.
- [ ] Every endpoint returns `ResponseDto`, not raw entity.
- [ ] Every external dependency behind interface + token.
- [ ] No `forwardRef` (or, if used, comment explaining why module split isn't possible).
- [ ] Global `ValidationPipe` configured with `whitelist`, `forbidNonWhitelisted`, `transform`.
- [ ] Logging via `Logger` (NestJS) or wrapped logger service — never raw `console.log`.
- [ ] Errors thrown are NestJS exception classes; never return `{ error: ... }` objects.
- [ ] Every DTO field has `@ApiProperty()` or `@ApiPropertyOptional()` with `description` and `example`.
- [ ] Every controller method has `@ApiOperation({ summary, description })` in PT-BR.
- [ ] Every possible HTTP response has `@ApiResponse()` with status + description.
- [ ] Guarded controllers have `@ApiBearerAuth('bearer')`.
- [ ] Every controller class has `@ApiTags()` with PT-BR tag name.
- [ ] `PartialType` imported from `@nestjs/swagger`, not `@nestjs/mapped-types`.
- [ ] Swagger UI accessible at `/docs`.

## Anti-patterns to avoid

- **Fat controllers.** Controller method >~5 lines = service too thin. Move logic down.
- **Returning entities directly.** Internal fields (`passwordHash`, soft-delete flags, internal IDs) leak. Always go through `ResponseDto`.
- **`any` in DTOs or service signatures.** Can't name type = spec incomplete — back to phase 1.
- **Inline object types in signatures.** `create(data: { name: string; email: string })` = DTO or interface missing. Name it.
- **Naked utility types in signatures.** `update(data: Partial<Omit<X, 'id'>>)` = unnamed shape. Define `UpdateXData` interface, use that.
- **`Parameters<typeof prisma.x.create>[0]['data']`** — Prisma internals leaking into your interface. Define your own `CreateXData` interface.
- **Swallowing errors.** `try { ... } catch { return null; }` hides failures. Let exceptions propagate; framework maps them.
- **Module mega-graphs.** A imports B imports C imports A = redraw boundaries, not `forwardRef`.
- **Logic in DTOs.** DTOs declare shape and validate. No compute, no queries.
- **Manual provider instantiation.** Always go through DI. `new SomeService(...)` outside tests = smell.
- **Direct ORM coupling everywhere.** Services reaching into `PrismaService` across codebase = ORM swap is year-long project. Use repository wrapper.
