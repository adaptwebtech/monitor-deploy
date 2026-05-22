---
name: backend-implementation
description: Internal phase-3 skill dispatched by feature-router. Implements NestJS modules until tests GREEN. Do not invoke directly — use /feature.
---

# Backend Implementation — NestJS + Prisma

## Map rule
CODEBASE.md in context (hook-injected). Use §1/§8 structure, §2/§4 module graph, §3/§9 schema, §5 env vars, §10 symbols, §11 conventions, §12 skeletons, §13 impl docs.
FORBIDDEN: `grep`/`find`/`ls`/`Explore`/`Agent` for discovery. `Read src/` for inspiration.
ALLOWED: `Read docs/specs/*.md`, `docs/implementation/<feature>.md`, current file under edit.
Map stale or case not covered → stop and tell user.

---

Phase 3: spec + tests exist. Write code to make tests GREEN. No shortcuts tests don't catch.

## Folder layout

```
server/src/<feature>/
  dto/
    create-<x>.dto.ts
    update-<x>.dto.ts
    <x>-query.dto.ts
    <x>-response.dto.ts
  entities/
  interfaces/
  <x>.controller.ts
  <x>.service.ts
  <x>.repository.ts
  <x>.module.ts
  tokens.ts
```

Tests alongside source (`*.spec.ts`). E2E in `server/test/`. See §12 for skeletons.

## No inline types — ever

Every shape must have a name. Naked `{ field: type }` in signatures = missing DTO or interface.
- HTTP boundary → DTO class in `dto/` (class-validator + `@ApiProperty`)
- Internal contract → TypeScript `interface` in `interfaces/`
- Utility types (`Partial`, `Omit`, `Pick`) only inside named type aliases — never naked in signatures

Can't name shape → spec incomplete. Back to Phase 1.

## DTO conventions

| DTO | Purpose |
|---|---|
| `CreateXDto` | POST body — all required fields |
| `UpdateXDto` | PATCH body — `PartialType(CreateXDto)` from `@nestjs/swagger` |
| `XQueryDto` | GET query params — `@Type(() => Number)` etc. |
| `XResponseDto` | Return shape — `@Expose()` only, no validators |

See §12 for full DTO + `ValidationPipe` skeleton.

## Module rules
- One module per feature, self-contained
- No `forwardRef` — wrong boundaries, refactor first
- No `@Global()` on feature modules
- Export only what other modules genuinely need

## Dependency inversion
Services depend on interfaces + tokens, never on concretes directly. Wire concrete in module `providers`.
Pattern: `{ provide: TOKEN, useClass: ConcreteImpl }`. See §12 for interface + token + service skeleton.

## Service rules
- One reason to change (~300 lines or ~30 line methods = smell)
- Use NestJS built-in exceptions — never return `{ error: ... }`
- No `process.env` — use `ConfigService`
- Log via `Logger`, never `console.log`
- Return `plainToInstance(ResponseDto, result, { excludeExtraneousValues: true })`

## Controller rules
- HTTP mapping only — no business logic
- Every guarded controller: `@ApiBearerAuth('bearer')` on class
- Every class: `@ApiTags('PT-BR name')`
- Every method: `@ApiOperation({ summary, description })` in PT-BR
- Every possible status: `@ApiResponse({ status, description, type })`
- `PartialType` imports from `@nestjs/swagger` not `@nestjs/mapped-types`

See §12 for controller + Swagger setup skeleton.

## Repository pattern (recommended)
Service depends on own repository interface, not Prisma directly. ORM code isolated, mock surface minimal.
See §12 for `IXRepository` + `XRepository` skeleton.

## Exception map
| Exception | Status |
|---|---|
| `BadRequestException` | 400 |
| `UnauthorizedException` | 401 |
| `ForbiddenException` | 403 |
| `NotFoundException` | 404 |
| `ConflictException` | 409 |
| `InternalServerErrorException` | 500 |

## Order of writing (TDD)
0. `npx prisma generate` before any `@prisma/client` import
1. Entities
2. DTOs + `@ApiProperty` same edit
3. Interfaces + tokens
4. Repository (unit tests green)
5. Service (unit tests green)
6. Controller + `@ApiOperation`/`@ApiResponse` same edit (integration tests green)
7. Module wiring (e2e tests green)
8. Register in AppModule

Never move to next step with red tests behind.

## Checklist
- [ ] `npx prisma generate` run after any schema change
- [ ] Every AC has passing test referencing it
- [ ] No `process.env` in business code
- [ ] No inline `{ ... }` types in signatures
- [ ] No naked utility types in signatures
- [ ] Every internal contract has named interface in `interfaces/`
- [ ] Every endpoint returns `ResponseDto`, not raw entity
- [ ] Every external dep behind interface + token
- [ ] `ValidationPipe`: `whitelist`, `forbidNonWhitelisted`, `transform`
- [ ] No `forwardRef`
- [ ] Every DTO field: `@ApiProperty()` with `description` + `example`
- [ ] Every controller method: `@ApiOperation` PT-BR
- [ ] Every status code: `@ApiResponse`
- [ ] Guarded controllers: `@ApiBearerAuth('bearer')`
- [ ] `PartialType` from `@nestjs/swagger`
- [ ] Swagger UI at `/docs`

## Anti-patterns
- Fat controllers (>5 lines = service too thin)
- Returning raw entities (use ResponseDto)
- `any` in DTOs or signatures
- Inline `{ name: string }` in signatures
- Naked `Partial<Omit<X,'id'>>` in signatures
- `Parameters<typeof prisma.x.create>` leaking into interface
- Swallowing errors with `try { } catch { return null }`
- `new SomeService(...)` outside tests

## Dispatch
Validate preconditions (spec + tests exist). Read spec §6 — extract `[backend]` ACs + §7 API contract as inline context. Invoke `backend-implementation-agent`. Don't duplicate work. Direct edit only for trivial tasks or explicit user request.
