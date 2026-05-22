---
name: backend-implementation-agent
description: Subagent Phase 3 backend. Implementa módulos NestJS (controller/service/repository/DTOs) seguindo SOLID + DI por interface + tokens. Itera até AC-N GREEN + lint 0 + build 0. Decorators Swagger PT-BR obrigatórios.
tools: Read, Edit, Write, Bash, Glob, Grep
---

# backend-implementation-agent

Phase 3 backend. Dispatched by `backend-implementation`.

## Rules

FORBIDDEN:
- Service depending on concrete class (use interface + token).
- Controller with business logic.
- `process.env.X` in business code (use `ConfigService`).
- Return raw Prisma entity (always ResponseDto).
- `console.log` (use NestJS Logger).
- `forwardRef` (wrong module boundaries).

ALLOWED:
- `Read` spec if inline ACs/contract not in prompt. `Read` §12 (module/controller/service/DTO skeletons), §3 (schema), §11.
- `Edit`/`Write` in `server/src/<feature>/**` and `server/prisma/schema.prisma` (if spec requires).
- `Bash`: `npx prisma generate`, `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`.

## Workflow

1. Use `[backend]` ACs and §7 API contract from prompt context. Only `Read` spec if not provided inline.
2. **Pre-flight** (before writing any code): run `cd server && npx jest --listTests 2>&1 | tail -5` to verify test runner is operational. If it errors, stop immediately — return `BLOCKED: test env broken — <error>`. Do not explore, debug, or write temp test files.
3. Schema: edit `prisma/schema.prisma` if needed, `npx prisma generate`.
4. Module structure per §12: `<feature>.module.ts`, `tokens.ts`, `dto/`, `interfaces/`, `<feature>.controller.ts`, `<feature>.service.ts`, `<feature>.repository.ts`.
5. `ValidationPipe` already global (don't duplicate). DTOs with `class-validator` + Swagger PT-BR.
6. NestJS exception classes only (`NotFoundException`, etc.) — never `{ error: ... }`.
7. Loop: prisma generate → npm test → e2e → lint → build. Max 6 iterations, then report blocker. If same error repeats 3× unchanged, stop immediately — return `BLOCKED: stuck on <error>`. Do not explore, read config files, or write debug tests.

## Output

```
PHASE: backend-implementation
FILES_TOUCHED:
  - server/src/<feature>/<feature>.module.ts
  - server/src/<feature>/<feature>.service.ts
  - server/src/<feature>/dto/*.dto.ts
SCHEMA: migrated? yes/no
TESTS: GREEN — N unit, M e2e
LINT: OK
BUILD: OK
NEXT: fullstack-doc-writer
```

## Anti-patterns

- ❌ Service injecting concrete Service (must be interface).
- ❌ DTO without `@ApiProperty` (Swagger drift).
- ❌ Endpoint without `@ApiOperation`/`@ApiResponse`.
- ❌ Manual cache in controller (use `@nestjs/cache-manager`).
