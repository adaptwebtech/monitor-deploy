# Development Workflow

## Codebase Map (única fonte de estrutura)

`docs/CODEBASE.md` é fonte autoritativa. Hook `PreToolUse` (`.claude/hooks/inject-codebase-map.sh`) injeta automaticamente seu conteúdo no contexto sempre que skills de Phase 1–4 rodam. **Não abra `src/` para descobrir nada — o mapa já cobre.**

**O mapa cobre:**
- §1 estrutura · §2 grafo de módulos backend · §3 schema · §4 fluxo de request · §5 env vars · §6 scripts npm · §7 tipos centrais frontend
- §8 **índice feature → arquivos** (qual arquivo mexer para feature X)
- §9 ERD Prisma · §10 **índice de símbolos** (paths exatos)
- §11 convenções rápidas
- §12 **skeletons canônicos** (copy-paste de module, controller, service, DTO, store, view, component, Deployment, Service, test) — use isto em vez de abrir `src/`
- §13 ponteiros para `docs/implementation/<feature>.md` (ground-truth por feature)

**PROIBIDO:**
- `ls`, `find`, `grep` para "onde está X" ou "como outros fizeram Y".
- `Explore`/`Agent` (qualquer subagent de descoberta) para localizar arquivos, símbolos ou patterns.
- `Read` em `server/src/`, `frontend/src/`, `k8s/`, `prisma/` para se inspirar em pattern existente — use §12.

**PERMITIDO:**
- `Read` em `docs/specs/*.md` e `docs/implementation/<feature>.md` (sob demanda, **um por vez**, só o relevante à tarefa atual).
- `Read`/`Edit`/`Write` no arquivo que está sendo editado/criado agora.
- `grep`/`find` apenas para lógica interna de função específica não coberta pelo mapa nem pelos docs de implementação.
- **Exceção `fullstack-doc-writer`:** pode `Read` direcionado em `src/<feature>/` da feature sendo documentada (Phase 4 = derivar doc de código real). Mesmo assim, só arquivos listados em §8/§10 — nunca varredura ampla.

**Regras gerais:**
- Mapa desatualizado (arquivo recém-criado ausente, símbolo renomeado) → parar e avisar o usuário antes de prosseguir.
- Mapa/§12/§13 não cobrem seu caso → parar e avisar. Não inventar, não greppar.
- Phase 4 (`fullstack-doc-writer`) obriga atualizar §8/§9/§10/§11/§12 do mapa quando aplicável, no mesmo commit do `docs/implementation/<feature>.md`.

## Always ask — never assume

**Zero-assumption policy:** If any detail is not explicitly stated, stop and ask. Do not fill gaps with "reasonable defaults", "common patterns", or inferred intent.

This applies to **everything**:

- Feature scope or boundaries (frontend, backend, infra, or all three?)
- Entities, fields, or relations not explicitly named
- Business rules or validation logic not stated
- Whether to extend an existing module or create a new one
- Naming conventions for any new artifact
- Any requirement that would require a non-trivial assumption to proceed
- Expected behavior for edge cases or error states
- Which environment or layer a change targets
- Any ambiguity in user intent, even if "obvious"

**Hard rules:**
- Never invent requirements. Never infer missing specs. Never proceed on assumptions.
- One targeted question beats a wrong implementation every time.
- If multiple things are unclear, list all questions at once — never ask one and silently assume the rest.
- Assumption is a bug. Treat it as one.

## Mandatory: spec → test → code → doc

4 phases, in order. Never skip. Never reorder.

| Phase | Skill | Output | Gate to next phase |
|---|---|---|---|
| 1. Spec | `fullstack-spec-mermaid` | `docs/specs/<feature>.md` | Spec reviewed and approved |
| 2. Tests | `frontend-testing` / `backend-testing` / `infra-testing` | test files + `k8s/validate/*.sh` | All tests written, all RED |
| 3. Code | `frontend-implementation` / `backend-implementation` / `infra-implementation` | `frontend/src/` + `server/src/` + `k8s/` | Tests GREEN, lint clean, build passes |
| 4. Doc | `fullstack-doc-writer` | `docs/implementation/<feature>.md` + `README.md` updated | Doc committed |

**Hard rules:**
- No code before spec. User asks to code with no spec → write spec first.
- No implementation before tests. Tests written against spec ACs; implementation makes them pass.
- No "docs later" — doc phase mandatory every cycle.
- User jumps mid-workflow → check which phase artifacts exist, resume from right point.

## Phase 1 — Spec

### Before starting Phase 1

Ask user:

> "Prefere pausar para sua revisão após cada fase (Spec → Teste → Código → Doc), ou posso avançar automaticamente quando cada fase estiver completa?"

Record answer for session:

- **Pause after each phase (default):** Stop at end of each phase, present output, wait for explicit approval.
- **Autonomous:** Run all 4 phases end-to-end; pause only if blocker requires input (ambiguous req, unfixable test failure, etc.).

Default: **pause after each phase**.

Skill `fullstack-spec-mermaid`.

- Write to `docs/specs/<feature-name>.md` (kebab-case).
- All 16 sections required ("N/A" if truly absent).
- Sections 15 (Vue component hierarchy) and 16 (k8s infra topology) write "N/A" for backend-only features.
- Functional requirements: testable, numbered (FR-1, FR-2…).
- Acceptance criteria: Given/When/Then, numbered (AC-1, AC-2…).
- ACs = source of truth for tests in all layers.

## Phase 2 — Tests

Run skills for **active layers only**. Determine active layers from spec sections:

| Layer active if... | Skill | Output location | RED state |
|---|---|---|---|
| Spec has section 15 (frontend) | `frontend-testing` | `frontend/src/<feature>/**/*.spec.*` + `frontend/e2e/<feature>.spec.ts` | Vitest/Playwright tests fail |
| Spec has backend API contract (section 7) | `backend-testing` | `server/src/<feature>/**/*.spec.ts` + `server/test/<feature>.e2e-spec.ts` | Jest/Supertest tests fail |
| Spec has section 16 (infra) | `infra-testing` | `k8s/validate/validate-base.sh` + `k8s/validate/validate-overlays.sh` + `k8s/validate/smoke-test.sh` | `minikube kubectl -- kustomize <path> \| minikube kubectl -- apply --dry-run=server -f -` fails |

- Minimum one test per AC per active layer.
- Reference AC IDs in test names: `it('AC-3: ...')`.
- All must be RED before moving to Phase 3.

## Phase 3 — Implementation

### Parallel agent orchestration

**Before spawning agents, check Phase 2 artifacts:**
1. `frontend/src/**/*.spec.*` or `frontend/e2e/**/*.spec.*` exist → **frontend layer active**
2. `server/src/**/*.spec.ts` or `server/test/**/*.e2e-spec.ts` exist → **backend layer active**
3. `k8s/validate/*.sh` exists → **infra layer active**

**Rules:**
- **1 layer active** → run that layer's implementation skill sequentially.
- **2+ layers active** → spawn one Agent per active layer **in the same message** (parallel). Each uses its own implementation skill.
- Each agent independently iterates until own test suite GREEN + lint + build pass.
- **Phase 3 complete when ALL active-layer agents report done.**

### Per-layer completion criteria

| Layer | Skill | Done when |
|---|---|---|
| Frontend | `frontend-implementation` | `npm run test:unit` GREEN + `npx playwright test` GREEN + `npm run lint` exits 0 + `npm run build` exits 0 |
| Backend | `backend-implementation` | `npx prisma generate` done + `npm test` GREEN + `npm run test:e2e` GREEN + `npm run lint` 0 + `npm run build` 0 |
| Infra | `infra-implementation` | `k8s/validate/validate-base.sh` passes + `k8s/validate/validate-overlays.sh` passes + `k8s/validate/smoke-test.sh` pods Running |

**CODEBASE.md gate:** new module, new file in any layer's src, new env var, schema migration, or new k8s resource → update `docs/CODEBASE.md` before Phase 4.

## Phase 4 — Doc

Skill `fullstack-doc-writer`.

- Write to `docs/implementation/<feature-name>.md`.
- Covers all active layers: frontend components, backend API, infra topology.
- Deployment topology diagram derived from actual `k8s/` manifests (not docker-compose).
- Doc exists → update, not rewrite; preserve human-added content.
- Append to changelog, never rewrite.
- Note spec drift in section 12 honestly.
- Update `README.md`: add/update feature row in Documentação table (link to both `docs/specs/<feature>.md` and `docs/implementation/<feature>.md`). Keep all existing README content.
- **CODEBASE.md gate:** verify `docs/CODEBASE.md` accurate, commit alongside implementation doc.

## When the user skips phases

| User says | What to do |
|---|---|
| "Just implement X" with no spec | Write spec first, confirm ACs, then proceed |
| "Write tests" with no spec | Ask for or write spec first |
| "Skip tests, just code it" | Decline. Write the tests. |
| "We'll doc it later" | Doc after implementation, same session |
| "Write a spec" | Phase 1 — use `fullstack-spec-mermaid` |
| "Write tests for this spec" | Phase 2 — run layer skills for layers spec covers |
| "Implement this" (spec + tests exist) | Phase 3 — parallel if 2+ layers active |
| "Write the docs" | Phase 4 — use `fullstack-doc-writer` |

## Project structure

```
frontend/
  src/
    <feature>/
      components/
      views/
      stores/
      composables/
      types/
  e2e/
    <feature>.spec.ts
server/
  src/
    <feature>/
      dto/
      entities/
      interfaces/
      <feature>.controller.ts
      <feature>.service.ts
      <feature>.repository.ts
      <feature>.module.ts
      tokens.ts
  test/
    <feature>.e2e-spec.ts
  prisma/
    schema.prisma
k8s/
  base/
    kustomization.yaml
    00-postgres-pv.yaml      01-redis-pv.yaml
    10-postgres-pvc.yaml     11-redis-pvc.yaml
    20-env-configmap.yaml    21-docker-registry-secret.yaml
    30-postgres-deployment.yaml  31-redis-deployment.yaml
    32-api-deployment.yaml       33-vue-deployment.yaml
    40-postgres-service.yaml  41-redis-service.yaml
    42-api-service.yaml       43-vue-service.yaml
  overlays/
    development/  staging/  production/
      kustomization.yaml
      namespace.yaml
      env-patch.configmap.yaml
      *-deployment-patch.yaml
  validate/
    validate-base.sh
    validate-overlays.sh
    smoke-test.sh
docs/
  specs/<feature>.md            # Phase 1 output
  implementation/<feature>.md   # Phase 4 output
  CODEBASE.md                   # authoritative structure map
```

## NestJS conventions (backend — always apply)

- Global `ValidationPipe`: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- Services depend on interfaces + injection tokens — never concretions directly.
- Controllers thin: HTTP mapping only, no business logic.
- Never return raw entities — always through `ResponseDto`.
- Throw NestJS exception classes (`NotFoundException`, `ConflictException`, etc.) — never `{ error: ... }`.
- Never read `process.env` in business code — use `ConfigService`.
- No `forwardRef` — if needed, module boundaries are wrong.
- Log via NestJS `Logger`, not `console.log`.
- ORM: Prisma (preferred) + custom repository wrapper.
- Cache: Redis via `@nestjs/cache-manager` or ioredis.

## Vue conventions (frontend — always apply)

- Vue 3 Composition API — no Options API.
- State management: Pinia stores. No direct component-to-component state passing for shared state.
- Routing: Vue Router 4. Named routes only — no magic string paths.
- HTTP: composables wrapping `fetch` or axios — no raw API calls from components.
- Bootstrap 5 for layout/components — no custom CSS unless unavoidable.
- Components in `PascalCase.vue`. Composables in `use*.ts`. Stores in `*.store.ts`.
- `<script setup>` throughout — never mix with `<script>`.
- All interactive elements have `data-test="..."` attributes — never target by CSS class in tests.

## K8s conventions (infra — always apply)

- Structure: `k8s/base/` + `k8s/overlays/<env>/`. Base = canonical; overlays = patches only.
- Explicit namespace per environment (`namespace.yaml` in each overlay).
- Image tags: SHA for production, env-name for others. Never `:latest`.
- Validate with minikube before committing: `minikube kubectl -- kustomize <path> | minikube kubectl -- apply --dry-run=server -f -`
- Never use `kustomize` CLI directly — always `minikube kubectl -- kustomize`.
- Base file naming: numeric group prefix — `0X-*` PVs, `1X-*` PVCs, `2X-*` ConfigMaps/Secrets, `3X-*` Deployments, `4X-*` Services. Zero-padded two digits. Example: `00-postgres-pv.yaml`, `10-postgres-pvc.yaml`, `20-env-configmap.yaml`, `30-postgres-deployment.yaml`, `40-postgres-service.yaml`.
- Resource requests + limits on every container — no limits = blocked.
- No passwords/secrets in ConfigMap — use Secrets or external secrets operator.
- All resource names lowercase kebab-case.

## Language (always apply)

- All docs — `docs/specs/`, `docs/implementation/`, `README.md` — **Portuguese (PT-BR)**.
- Mermaid node labels, sequence messages: PT-BR where natural language.
- Code identifiers, file paths, CLI commands, technical constants: English.

## Swagger / OpenAPI (backend — always apply)

- All Swagger decorator text **PT-BR**: `summary`, `description`, `ApiResponse` descriptions, `ApiProperty` descriptions, examples.
- Every DTO field: `@ApiProperty()` or `@ApiPropertyOptional()` with `description` and `example`.
- Every controller method: `@ApiOperation({ summary, description })` + `@ApiResponse()` for each possible HTTP status.
- Guarded endpoints: `@ApiBearerAuth('bearer')` on controller class.
- Group controllers with `@ApiTags()` (tag name in Portuguese).
- Swagger UI at `/docs`. Never change path without updating this file.
- New DTO class: Swagger decorators in same commit as class-validator decorators.
