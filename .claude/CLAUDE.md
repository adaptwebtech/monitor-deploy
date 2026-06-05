# Development Workflow

## Entry points

| Command | When |
|---|---|
| `/feature <name>` | New feature (greenfield) — runs spec → tests → code → doc |
| `/fix <description>` | Bug fix or refactor on existing feature |
| `/hotfix <description>` | Prod broken — urgent, always auto-mode |

Hooks block phase skills invoked outside a pipeline. Never call phase skills directly.

## Codebase Map

`docs/CODEBASE.md` is authoritative. Injected automatically into all pipeline skills.

**FORBIDDEN:** `ls`/`find`/`grep` for discovery · `Explore`/`Agent` to locate files/symbols · `Read` in `src/` for inspiration — use §12 (skeletons).

**PERMITTED:** `Read docs/specs/*.md`, `Read docs/implementation/<feature>.md` (one at a time). `grep`/`find` only for internal function logic not covered by the map. Phase-4 doc skill may `Read src/<feature>/` for listed files in §8/§10 only.

Map stale or case not covered → stop and tell the user. Never invent, never grep around it.

## Zero-assumption policy

Stop and ask for anything not explicitly stated: scope, entities, business rules, naming, edge cases, environment. Never infer from "reasonable defaults". List all questions at once.

## Pipeline — spec → test → code → doc (mandatory, never skip)

1. **Spec** → `docs/specs/<feature>.md` — 16 sections, numbered ACs (AC-N Given/When/Then)
2. **Tests** → one test per AC per active layer, all RED before phase 3
3. **Code** → tests GREEN, lint 0, build 0; parallel agents if 2+ layers active
4. **Doc** → `docs/implementation/<feature>.md` + README updated + CODEBASE.md verified

Active layers from spec: §15 present → frontend · §7 HTTP endpoints → backend · §16 present → infra.
CODEBASE.md gate: new module/file/env var/schema migration/k8s resource → update map before phase 4.

## NestJS conventions

- `ValidationPipe`: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- Services inject interfaces + tokens — never concretions directly
- Controllers: HTTP mapping only, no business logic
- Always return `ResponseDto` — never raw entities
- Throw NestJS exceptions (`NotFoundException`, `ConflictException`, …) — never `{ error: … }`
- Never `process.env` in business code — use `ConfigService`
- No `forwardRef` — wrong module boundaries if needed
- Log via `Logger`, not `console.log`
- ORM: Prisma + custom repository wrapper · Cache: Redis via `@nestjs/cache-manager` or ioredis

## Vue conventions

- Composition API + `<script setup>` — no Options API, no mixed `<script>`
- Pinia for shared state — no component-to-component passing
- Vue Router 4 named routes — no magic string paths
- HTTP via composables — no raw calls from components
- Bootstrap 5 — no custom CSS unless unavoidable
- `PascalCase.vue` components · `use*.ts` composables · `*.store.ts` stores
- All interactive elements: `data-test="..."` — never target by CSS class in tests

## K8s conventions

- `k8s/base/` canonical + `k8s/overlays/<env>/` patches only · Explicit namespace per environment
- Image tags: SHA for production, env-name for others — never `:latest`
- Validate: `minikube kubectl -- kustomize <path> | minikube kubectl -- apply --dry-run=server -f -`
- Never `kustomize` CLI directly
- File prefix groups: `0X` PVs · `1X` PVCs · `2X` ConfigMaps/Secrets · `3X` Deployments · `4X` Services
- Resource requests + limits on every container · No secrets in ConfigMap · All names lowercase kebab-case

## Swagger (backend)

- All decorator text PT-BR: `summary`, `description`, `ApiResponse`, `ApiProperty`
- Every DTO field: `@ApiProperty()` / `@ApiPropertyOptional()` with `description` + `example`
- Every controller method: `@ApiOperation` + `@ApiResponse` per status
- Guarded endpoints: `@ApiBearerAuth('bearer')` on class · `@ApiTags()` in Portuguese
- Swagger UI at `/docs` — never change path

## Language

- Docs (`docs/specs/`, `docs/implementation/`, `README.md`): **PT-BR**
- Mermaid labels and sequence messages: PT-BR · Code identifiers, paths, CLI, constants: English
