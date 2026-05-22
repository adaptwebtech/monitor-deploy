---
name: fix-triage
description: Internal fix-pipeline phase-1 skill. Dispatched by fix-router. Do not invoke directly — use /fix or /hotfix.
---

# fix-triage (Phase 1 — triage doc)

## Map rule
CODEBASE.md in context (hook-injected). Read-only for `src/` except stacktrace files.
FORBIDDEN: broad `grep`/`find` in `server/src`, `frontend/src`, `k8s/`.
ALLOWED: `Read` stacktrace files (max 3) + §8/§10 symbols for target feature + spec/impl docs. `AskUserQuestion` freely. `Write` triage doc + state file.

---

## Precondition
`.claude/state/fix-mode.txt ∈ {simple-fix, refactor, hotfix}`. If `none` → abort, run fix-router first.

## Execution modes

**simple-fix / refactor → interactive main thread.** Ask user through all 7 sections. No subagent.

**hotfix → dispatch `fix-triage-agent`.** Urgency over rigor. Agent writes stub (§1/§3/§4 required, rest TODO). Phase 2 skipped.

## Output
`docs/fixes/<feature>-<slug>.md`
- `<feature>`: exact name from §8 of map
- `<slug>`: kebab-case describing the defect (ex.: `stale-cache`, `null-on-logout`)

## Mandatory structure

```markdown
# Triage — <feature> · <slug>

> Branch: <simple-fix|refactor|hotfix>
> Criado: YYYY-MM-DD

## 1. Sintoma
<reproduzível description + literal stacktrace if provided>

## 2. Repro
<numbered steps; refactor: "N/A">

## 3. Root cause
<technical analysis from evidence read — file, function, line, broken invariant>

## 4. Scope de arquivos
- server/src/<feature>/<file>.ts
- frontend/src/<feature>/<file>.vue

## 5. Behavior delta
<before vs after; refactor: "None">

## 6. Risco / blast radius
<adjacent features, prod data, migrations, public endpoints>

## 7. Plano de teste
- REG-1: <description>     ← simple-fix
- CHAR-1: <description>    ← refactor
- "N/A — hotfix backfill"  ← hotfix stub
```

## Workflow (simple-fix / refactor)

1. Collect input: feature, symptom, stacktrace.
2. Locate feature in §8. If absent → abort.
3. Directed reads: spec + impl doc + stacktrace files (max 3) + §10 symbols cited in symptom.
4. **Q&A round 1 — symptom + repro**: confirm repro steps, expected vs observed, always/sometimes/regression.
5. **Q&A round 2 — root cause**: present hypothesis with evidence, request confirmation or counter-evidence. Multiple hypotheses → list and ask user to discriminate.
6. **Q&A round 3 — scope + risk**: confirm §4 file list, §6 blast radius, §5 behavior delta.
7. Compose §7 test plan: REG-N for simple-fix, CHAR-N for refactor.
8. Write `docs/fixes/<feature>-<slug>.md`.
9. Write slug to `.claude/state/fix-current.txt`.
10. Present summary, wait for approval if `autonomy=pause`.

## Pushback doctrine
Triage is not passive. Push back when input is vague, contradictory, or hides scope.

| Input | Pushback |
|---|---|
| "Fix this" / "it's broken" without repro | "No repro = no triage. List: env, payload, role, last known-good state." |
| Generic stacktrace ("500 error") | "500 is symptom, not cause. Server logs? Request payload? DB response?" |
| "Refactor to be cleaner" | "Refactor needs measurable goal: which symbol, which smell, which metric?" |
| §4 growing past 5 files | "Large scope = poorly isolated root cause OR this is a refactor. Split into smaller fixes." |
| User proposes fix before §3 is closed | "Fix proposed before root cause confirmed. Risk: treating symptom. Back to §3." |
| "No need for REG, it's simple" | "No REG = no regression gate. If too trivial for a test, it's too trivial for a dedicated fix." |
| Change to public contract "quickly" | "DTO/route/prop/env change = breaking change. Route via spec or version it." |

Use 1-3 focused questions per round. Ask for concrete artifacts, not opinions.

## Anti-patterns
- Skip Q&A in simple-fix ("symptom seems clear") — user has context you don't
- 10 questions at once — use focused rounds
- Triage without stacktrace AND without code read — root cause becomes a guess
- §4 listing "entire module" — useless scope-lock
- Dispatch subagent in simple-fix/refactor — loses Q&A loop
- Forget slug in `state/fix-current.txt` — Phase 4 gate breaks

## Hand-off
§7 must have REG-N or CHAR-N IDs that `fix-regression-testing` materializes 1:1.
