---
name: feature-router
description: Use this skill whenever the user invokes /feature or wants to start/resume the full greenfield pipeline (spec → test → code → doc) for a new feature. Orchestrates all 4 phases in sequence, tracks state, and supports pause-per-phase or auto mode. Do NOT use for fixing existing features — use fix-router instead.
---

# feature-router (Pipeline Orchestrator — greenfield)

## Map rule
CODEBASE.md in context (hook-injected). Use §8 (feature index) to confirm feature does NOT exist yet.
FORBIDDEN: `grep`/`find`/`ls`/`Explore` for discovery. Skip phase without checking prior artifacts.
ALLOWED: `Read` CODEBASE.md, spec, impl doc. `Bash` for date + state file reads. `Write` state files. `Skill` to invoke phases.

---

## Workflow

### 1. Normalize feature name
Convert argument to kebab-case (`User Profile` → `user-profile`). No argument → ask.

### 2. Check if feature exists (not greenfield)
Check §8 of CODEBASE.md. If listed:
> "Feature '<name>' already exists in §8. Use `/fix <description>` to change existing code."
Stop.

### 3. Detect current phase (resume logic)

```bash
# Phase 1 done?
[ -f "docs/specs/<name>.md" ] && grep -q "AC-[0-9]" "docs/specs/<name>.md"
# Phase 2 done? (backend)
find "server/src/<name>" -name "*.spec.ts" 2>/dev/null | grep -q .
# Phase 2 done? (frontend)
find "frontend/src/<name>" -name "*.spec.*" 2>/dev/null | grep -q .
# Phase 3 done? (backend)
find "server/src/<name>" -name "*.ts" ! -name "*.spec.ts" 2>/dev/null | grep -q .
# Phase 3 done? (frontend)
find "frontend/src/<name>" \( -name "*.vue" -o -name "*.ts" \) ! -name "*.spec.*" 2>/dev/null | grep -q .
# Phase 4 done?
[ -f "docs/implementation/<name>.md" ]
```

Entry point: no artifacts → `spec` | spec only → `tests` | spec+tests → `code` | spec+tests+impl → `doc` | all → confirm with user.

### 4. Block if another pipeline is active

```bash
cat .claude/state/feature-phase.txt 2>/dev/null
cat .claude/state/feature-name.txt 2>/dev/null
```

If `feature-phase.txt` is `spec`/`tests`/`code`/`doc` AND `feature-name.txt` differs:
> "Pipeline active for '<other>'. Finish it or reset: `rm .claude/state/feature-*.txt`"
Stop. Same feature → resume from step 3.

### 5. Choose autonomy (ask once)
> "Autonomy: **pause** (review after each phase, default) or **auto** (chain phases automatically)?"

### 6. Write state

```
.claude/state/feature-name.txt     → <kebab-case-name>
.claude/state/feature-phase.txt    → <initial-phase>
.claude/state/feature-autonomy.txt → pause | auto
```

### 7. Confirm and start

```
FEATURE PIPELINE STARTED
  feature:   <name>
  phase:     <initial-phase>
  autonomy:  <pause|auto>
```

---

## Phase execution

### Phase 1 — Spec
Set `feature-phase.txt = spec`. Invoke `fullstack-spec-mermaid` via `Skill`.
`pause`: wait for approval. `auto`: advance when spec has ACs.

### Phase 2 — Tests
Set `feature-phase.txt = tests`.

Determine active layers from spec:
- §15 present → frontend active
- §7 has HTTP endpoints → backend active
- §16 present → infra active

Invoke test skills for each active layer. 2+ layers → invoke in parallel (same turn, multiple `Skill` calls).
`pause`: wait for approval (all tests RED confirmed). `auto`: advance automatically.

### Phase 3 — Implementation
Set `feature-phase.txt = code`.

#### Pre-phase-3 gate (pause mode only)

When `feature-autonomy.txt = pause`, before invoking implementation agents, ask:

> **Validation before implementation — choose:**
> 1. **Manual** — I'll validate the tests myself. Skip runner, proceed to code.
> 2. **Feature only** — Run tests for this feature only.
> 3. **Full coverage** — Run full test suite.

Wait for user response. Then:
- **1 (Manual)**: proceed directly to implementation agents.
- **2 (Feature only)**: run `npm test -- --testPathPattern=<feature>` (backend) and `npm run test:unit -- <feature>` (frontend) for active layers. Show summary. Proceed after user confirmation.
- **3 (Full coverage)**: run full `npm test` + `npm run test:unit` for active layers. Show summary. Proceed after user confirmation.

Skip this gate entirely in auto mode.

Same layers as phase 2. 2+ layers → parallel `Agent` calls (not `Skill` — impl skills use subagents).
`pause`: wait for approval (GREEN + lint + build). `auto`: advance automatically.

### Phase 4 — Doc
Set `feature-phase.txt = doc`. Invoke `fullstack-doc-writer` via `Skill`.

### Done
Set `feature-phase.txt = done`. Display:
```
FEATURE PIPELINE COMPLETE
  feature: <name>
  spec:    docs/specs/<name>.md
  impl:    docs/implementation/<name>.md
  tests:   GREEN
  build:   0 errors
```

---

## State management commands

```bash
cat .claude/state/feature-name.txt       # current feature
cat .claude/state/feature-phase.txt      # current phase
rm .claude/state/feature-*.txt           # reset pipeline
echo "code" > .claude/state/feature-phase.txt  # advance manually
```

## Anti-patterns
- Update `feature-phase.txt` BEFORE invoking phase skill — not after
- Active layers from spec §15/§16 — don't assume, read spec
- Never skip phase 2 (tests) even if user asks — decline and write tests
- Check for active pipeline before writing state
- Feature in §8 → not greenfield, use fix-router
