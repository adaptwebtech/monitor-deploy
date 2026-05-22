---
name: fullstack-doc-writer
description: Internal phase-4 skill dispatched by feature-router. Derives implementation doc from code on disk. Do not invoke directly — use /feature.
---

# Full-Stack Implementation Doc Writer

## Map rule
CODEBASE.md in context (hook-injected). §1–§12 general, §13 existing impl docs.
FORBIDDEN: `grep`/`find`/`ls`/`Explore`/`Agent`. `Read src/` for inspiration.
ALLOWED: `Read docs/specs/*.md`, `docs/implementation/*.md`, current doc file.
PHASE 4 EXCEPTION: `Read` directed at `server/src/<feature>/`, `frontend/src/<feature>/`, `k8s/` — ONLY files listed in §8/§10 for the feature being documented. No broad scans.
§8/§10 doesn't list the feature → stop, tell user (map stale or feature not implemented).

## Mandatory deliverable — sync CODEBASE.md
Every run MUST update `docs/CODEBASE.md`:
- **§8** — add/update feature → files entry
- **§9** — regenerate ERD if `schema.prisma` changed
- **§10** — add new services, controllers, stores, composables, views, components, public DTOs
- **§11** — add new convention only if new architectural decision was made

Commit `docs/CODEBASE.md` in the **same commit** as `docs/implementation/<feature>.md`.

---

Phase 4: runs after implementation. Reads actual code. Produces developer-facing reference — NOT the spec (spec = design intent; this doc = code-derived ground truth).

## Output
`docs/implementation/<feature-name>.md`. If doc exists: **update**, don't rewrite — preserve human-added operational notes unless implementation invalidated them.

## Source extraction

| File pattern | Extract |
|---|---|
| `*.controller.ts` | Endpoint table: method, path, guards, request DTO, return type, status codes |
| `*.module.ts` | imports, exports, providers (especially token bindings) |
| `dto/*.ts` | Field names, types, validators, transforms |
| `entities/*.ts` / schema | Columns, types, indexes, relations |
| `*.service.ts` | Public method signatures |
| `interfaces/*.ts` + `tokens.ts` | Extension points |
| `ConfigService.get(...)` + `process.env` | Configuration table |
| `*.vue` | Component props, emits, slots |
| `stores/*.ts` | State shape, actions, getters |
| `composables/*.ts` | Inputs/outputs |
| `k8s/base/*.yaml` + `overlays/**/*.yaml` | Resources per env, env var keys, replicas |
| `k8s/validate/*.sh` | Validation commands |

No source material for section → write "None". Never invent.

## Required doc structure

```markdown
# <Feature Name>
> **Status:** stable | in-progress | deprecated
> **Spec:** docs/specs/<feature>.md
> **Backend:** server/src/<feature>/
> **Frontend:** frontend/src/<feature>/

## 1. Overview — what it does, present tense, full system role
## 2. Public API (HTTP) — endpoint table + per-endpoint request/response detail + curl example
## 2b. Frontend pages & components — route table + component detail
## 3. Module surface — import recipe, exports, required config, peer modules
## 4. System architecture — 4 Mermaid diagrams (class, sequence, state machine, deployment topology)
## 5. Data model — erDiagram from actual columns
## 6. DTOs — field tables with validators inline
## 7. Configuration — env var table: key, type, default, required, behavior if missing
## 8. Dependencies — internal modules, external services, non-obvious libs
## 9. Extension points — swappable interfaces, emitted events, hooks
## 10. Errors — exception class → status → trigger condition table
## 11. Operational notes — perf, observability, idempotency, known limits, validation commands
## 12. Spec drift — divergences from spec (empty if aligned)
## 13. Changelog — append-only, date-stamped
```

## Workflow
1. Read `*.module.ts` — map surface (imports, exports, providers)
2. Walk controller — build endpoint table, follow chains into service for every thrown exception
3. Walk DTOs — field tables with validator decorators
4. Walk entities — generate ER from actual columns
5. Walk frontend module — views, components, stores, composables
6. Walk k8s manifests — base resources + overlay patches
7. Grep `ConfigService.get` + `process.env` + `import.meta.env` — config table
8. Diff against spec — note drift honestly
9. Preserve human-added content (operational notes, changelog entries)
10. Append to changelog — never rewrite

## Include vs skip
Include: endpoints, routes, exports, config, errors, extension points, k8s resource names + overlay diffs.
Skip: internal helpers, private methods, spec "why we built this" (link to spec), test details, Pinia internal mutations.

## Anti-patterns
- Regenerating the spec — doc ≠ spec, different artifact
- Lying about coverage — if event emitter not in code, don't write it emits events
- Rewriting changelog — always append
- Prose blobs for tabular data — use tables for endpoints/DTOs/config/errors
- Out-of-date curl examples — derive from current DTOs
- Ignoring drift — note it, don't hide it
- Inventing k8s names — read actual YAML

## Dispatch
Validate preconditions (implementation done). Read spec §6 — extract all ACs as inline context. Invoke `fullstack-doc-writer-agent`. Don't duplicate work. Direct edit only for trivial tasks or explicit user request.
