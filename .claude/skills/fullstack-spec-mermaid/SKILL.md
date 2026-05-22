---
name: fullstack-spec-mermaid
description: Internal phase-1 skill dispatched by feature-router. Produces docs/specs/<feature>.md. Do not invoke directly — use /feature.
---

# Full-Stack Spec with Mermaid

## Map rule
CODEBASE.md in context (hook-injected). Use §1/§8 existing features/structure, §2/§4 graph, §3/§9 schema, §10 symbols, §11 conventions, §12 skeletons.
FORBIDDEN: `grep`/`find`/`ls`/`Explore`/`Agent` for discovery. `Read src/` for inspiration.
ALLOWED: `Read docs/specs/*.md`, `docs/implementation/*.md`, current spec file.
Map stale or case not covered → stop and tell user.

---

Phase 1: produce `docs/specs/<feature-name>.md`. Spec = contract all downstream phases must satisfy. Precise about behavior, data, boundaries, component hierarchy, infra topology.

## Output
`docs/specs/<feature-name>.md` (kebab-case). Create `docs/specs/` if missing. One spec per feature.

## Required sections (all, in order — write "N/A" if absent)

```
# <Feature Name>
## 1. Context        — why it exists, what problem, who uses it
## 2. Scope          — In scope / Out of scope bullets (explicit, prevents creep)
## 3. Glossary       — non-obvious domain terms only
## 4. Functional requirements — FR-N: atomic, testable statements
## 5. Non-functional requirements — NFR-N: perf, security, rate limits
## 6. Data model     — erDiagram + field table (type, constraints, indexes, default)
## 7. API contract   — HTTP endpoints + Vue Router named routes
## 8. Module boundaries — classDiagram: NestJS modules + Vue module structure
## 9. Flows          — sequenceDiagram per primary use case
## 10. State machines — stateDiagram-v2 for every status field
## 11. Business rules — flowchart for non-trivial branching
## 12. Edge cases & error handling — bullet list
## 13. Acceptance criteria — AC-N: Given X, when Y, then Z + layer tag
## 14. Open questions — ambiguities that can't be answered yet
## 15. Frontend component hierarchy — graph TD (required if feature has frontend)
## 16. Infra topology — graph TD with subgraphs (required if feature changes k8s)
```

## Diagram type → use case

| Type | Use for |
|---|---|
| `sequenceDiagram` | Request/response flows, multi-actor interactions over time |
| `erDiagram` | Schema, entity relationships, cardinality |
| `classDiagram` | Module structure, interfaces, dependency direction |
| `stateDiagram-v2` | Entity lifecycle (status fields) |
| `flowchart TD` | Business decision logic, branching, validation pipelines |
| `graph TD` | Vue component tree, k8s topology |

## Functional requirements
Each FR: one statement, one behavior, testable. Can't write a test for it → rewrite it.

| Bad | Good |
|---|---|
| "Users should be able to log in." | "FR-1: `POST /auth/login` with valid email + password returns 200 with `{ accessToken }` and 7-day refresh cookie." |
| "Orders need to be paid." | "FR-7: Order moves `Pending` → `Confirmed` only after `PaymentGateway.charge` returns success. Failure → `Cancelled`, persists failure reason." |
| "The system should be fast." | "NFR-2: P95 latency for `GET /orders/:id` ≤ 150ms warm, ≤ 400ms cold." |

## Acceptance criteria
Bridge to phases 2+3. Use Given/When/Then. Tag layer: `[backend]`, `[frontend]`, `[e2e]`, `[infra]`.
Every FR in at least one AC. Each AC = at least one test case.

```
- **AC-1** `[backend]`: Given authenticated user, when POST valid CreateOrderDto, then 201 with OrderResponseDto status=Pending.
- **AC-3** `[frontend]`: Given user on /orders, when page loads, then OrderList renders one OrderCard per order.
- **AC-4** `[e2e]`: Given authenticated user, when checkout completes via UI, then order appears in list with status Confirmed.
```

## API contract format

### HTTP endpoint
```
### POST /orders
- **Auth**: Bearer JWT (role: customer)
- **Request**: CreateOrderDto — items[{productId:uuid, quantity:int>=1}], shippingAddressId:uuid
- **Responses**: 201 OrderResponseDto | 400 validation | 401 auth | 404 product not found | 409 stock
```

### Vue Router routes
| Named route | Path | Component | Auth |
|---|---|---|---|
| `orders-list` | `/orders` | `OrdersView.vue` | yes |

## Workflow
1. Clarify scope — name what's in/out before drafting. Ambiguous load-bearing point → ask before writing.
2. Sketch ER diagram — entity list usually reveals missing requirements.
3. List endpoints. List frontend routes.
4. Draw primary flow (sequenceDiagram) — surfaces hidden dependencies.
5. Identify lifecycles — status fields → state diagrams.
6. Draw component hierarchy (§15).
7. Draw infra topology (§16).
8. Write ACs last — by now enough info to phrase precisely.
9. Hunt ambiguity — could two engineers read this and build different things? Tighten.

## Anti-patterns
- Pseudocode in spec — describe behavior, not implementation
- One mega-diagram — split into focused diagrams
- Mermaid that doesn't render — unquoted labels with spaces in erDiagram, reserved words as node IDs, unescaped `()` in graph TD labels (use `["..."]`)
- "TBD" scattered — unknowns → §14 with owner/decision needed
- Skip §15 for features with frontend — draw the component hierarchy
- Skip §16 for features with infra changes — draw the topology
- Frontend routes missing from §7 — must cover HTTP + Vue Router
