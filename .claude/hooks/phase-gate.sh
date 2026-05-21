#!/bin/bash
# Enforces spec → test → code → doc workflow for full-stack project.
# Layers: frontend (Vue 3), backend (NestJS), infra (k8s/kustomize).
# Runs as PreToolUse hook on Write and Edit tools.

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('file_path', ''))
except Exception:
    print('')
" 2>/dev/null)

[ -z "$FILE_PATH" ] && exit 0

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$HOOK_DIR/../.." && pwd)"

if [[ "$FILE_PATH" != /* ]]; then
    FILE_PATH="$PROJECT_ROOT/$FILE_PATH"
fi

REL_PATH="${FILE_PATH#"$PROJECT_ROOT"/}"

# ─── helpers ────────────────────────────────────────────────────────────────

spec_exists() {
    local feature="$1"
    [ -f "$PROJECT_ROOT/docs/specs/$feature.md" ]
}

spec_has_acs() {
    local feature="$1"
    grep -q "AC-[0-9]" "$PROJECT_ROOT/docs/specs/$feature.md" 2>/dev/null
}

any_spec_exists() {
    find "$PROJECT_ROOT/docs/specs" -name "*.md" 2>/dev/null | grep -q .
}

frontend_tests_exist() {
    local feature="$1"
    local count
    count=$(find "$PROJECT_ROOT/frontend/src/$feature" -name "*.spec.*" 2>/dev/null | wc -l)
    [ "$count" -gt 0 ]
}

backend_tests_exist() {
    local feature="$1"
    local unit_count e2e_count
    unit_count=$(find "$PROJECT_ROOT/server/src/$feature" -name "*.spec.ts" 2>/dev/null | wc -l)
    e2e_count=$(find "$PROJECT_ROOT/server/test" -name "$feature*.e2e-spec.ts" 2>/dev/null | wc -l)
    [ "$((unit_count + e2e_count))" -gt 0 ]
}

infra_validate_exists() {
    find "$PROJECT_ROOT/k8s/validate" -name "*.sh" 2>/dev/null | grep -q .
}

infra_base_exists() {
    [ -f "$PROJECT_ROOT/k8s/base/kustomization.yaml" ]
}

block() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  PHASE GATE BLOCKED                                      ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    echo "$1"
    echo ""
    exit 1
}

# ─── fix-mode helpers ───────────────────────────────────────────────────────

fix_mode() {
    local f="$PROJECT_ROOT/.claude/state/fix-mode.txt"
    if [ -f "$f" ]; then
        tr -d '[:space:]' < "$f" 2>/dev/null || echo "none"
    else
        echo "none"
    fi
}

fix_current_slug() {
    local f="$PROJECT_ROOT/.claude/state/fix-current.txt"
    if [ -f "$f" ]; then
        tr -d '[:space:]' < "$f" 2>/dev/null || echo "none"
    else
        echo "none"
    fi
}

# Caminho do triage doc atual (docs/fixes/<feature>-<slug>.md). "" se inexistente.
triage_doc_path() {
    local slug
    slug=$(fix_current_slug)
    [ -z "$slug" ] || [ "$slug" = "none" ] && return 1
    local p="$PROJECT_ROOT/docs/fixes/${slug}.md"
    [ -f "$p" ] || return 1
    echo "$p"
}

# Verifica se REL_PATH consta em §4 (lista de arquivos) do triage doc.
scope_includes() {
    local triage="$1"
    local rel="$2"
    [ -f "$triage" ] || return 0
    # Procura §4 e captura até próximo cabeçalho ##.
    awk '/^## ?4\.? /,/^## ?5/' "$triage" 2>/dev/null | grep -qF "$rel"
}

# ─── Gate A: frontend test files → spec must exist ──────────────────────────

if [[ "$REL_PATH" =~ ^frontend/src/([^/]+)/.+\.spec\.(ts|js|tsx)$ ]]; then
    FEATURE="${BASH_REMATCH[1]}"
    if ! spec_exists "$FEATURE"; then
        block "Phase 2 (frontend tests) requires Phase 1 (spec) first.

  Missing: docs/specs/$FEATURE.md

  Run the fullstack-spec-mermaid skill to produce the spec, then write tests."
    fi
    if ! spec_has_acs "$FEATURE"; then
        block "Spec at docs/specs/$FEATURE.md has no acceptance criteria (AC-N lines).

  Add acceptance criteria before writing tests — tests must map 1:1 to ACs."
    fi
    exit 0
fi

if [[ "$REL_PATH" =~ ^frontend/e2e/([^/]+)\.spec\.(ts|js)$ ]]; then
    FEATURE="${BASH_REMATCH[1]}"
    if ! spec_exists "$FEATURE"; then
        block "Phase 2 (Playwright e2e tests) requires Phase 1 (spec) first.

  Missing: docs/specs/$FEATURE.md

  Run the fullstack-spec-mermaid skill first."
    fi
    exit 0
fi

# ─── Gate A: backend test files → spec must exist ───────────────────────────

if [[ "$REL_PATH" =~ ^server/src/([^/]+)/.+\.spec\.ts$ ]]; then
    FEATURE="${BASH_REMATCH[1]}"
    if ! spec_exists "$FEATURE"; then
        block "Phase 2 (backend tests) requires Phase 1 (spec) first.

  Missing: docs/specs/$FEATURE.md

  Run the fullstack-spec-mermaid skill to produce the spec, then write tests."
    fi
    if ! spec_has_acs "$FEATURE"; then
        block "Spec at docs/specs/$FEATURE.md has no acceptance criteria (AC-N lines).

  Add acceptance criteria before writing tests — tests must map 1:1 to ACs."
    fi
    exit 0
fi

if [[ "$REL_PATH" =~ ^server/test/([^/]+)\.e2e-spec\.ts$ ]]; then
    FEATURE="${BASH_REMATCH[1]}"
    if ! spec_exists "$FEATURE"; then
        block "Phase 2 (backend e2e tests) requires Phase 1 (spec) first.

  Missing: docs/specs/$FEATURE.md

  Run the fullstack-spec-mermaid skill first."
    fi
    exit 0
fi

# ─── Gate A: infra validate scripts → any spec must exist ───────────────────

if [[ "$REL_PATH" =~ ^k8s/validate/ ]]; then
    if ! any_spec_exists; then
        block "Phase 2 (infra validation scripts) requires Phase 1 (spec) first.

  No spec found in docs/specs/.

  Run the fullstack-spec-mermaid skill to produce the spec, then write infra tests."
    fi
    exit 0
fi

# ─── Gate B: frontend impl → spec + frontend tests ──────────────────────────

if [[ "$REL_PATH" =~ ^frontend/src/([^/]+)/.+\.(vue|ts|js|tsx)$ ]] && [[ "$REL_PATH" != *.spec.* ]]; then
    FEATURE="${BASH_REMATCH[1]}"

    if ! spec_exists "$FEATURE"; then
        block "Phase 3 (frontend implementation) requires Phase 1 (spec) first.

  Missing: docs/specs/$FEATURE.md

  Workflow: spec → test → code → doc. Write the spec first."
    fi

    if ! spec_has_acs "$FEATURE"; then
        block "Spec at docs/specs/$FEATURE.md has no acceptance criteria (AC-N lines).

  Acceptance criteria are required — frontend tests derive from them."
    fi

    if ! frontend_tests_exist "$FEATURE"; then
        block "Phase 3 (frontend implementation) requires Phase 2 (frontend tests) first.

  No *.spec.* files found under frontend/src/$FEATURE/.

  Run the frontend-testing skill against the spec ACs, then implement."
    fi

    exit 0
fi

# ─── Gate B: backend impl → spec + backend tests ────────────────────────────

if [[ "$REL_PATH" =~ ^server/src/([^/]+)/.+\.ts$ ]] && [[ "$REL_PATH" != *.spec.ts ]]; then
    FEATURE="${BASH_REMATCH[1]}"

    if ! spec_exists "$FEATURE"; then
        block "Phase 3 (backend implementation) requires Phase 1 (spec) first.

  Missing: docs/specs/$FEATURE.md

  Workflow: spec → test → code → doc. Write the spec first."
    fi

    if ! spec_has_acs "$FEATURE"; then
        block "Spec at docs/specs/$FEATURE.md has no acceptance criteria (AC-N lines).

  Acceptance criteria are required — backend tests derive from them."
    fi

    if ! backend_tests_exist "$FEATURE"; then
        block "Phase 3 (backend implementation) requires Phase 2 (backend tests) first.

  No *.spec.ts or *.e2e-spec.ts found for feature '$FEATURE' under server/.

  Run the backend-testing skill against the spec ACs, then implement."
    fi

    exit 0
fi

# ─── Gate B: k8s base manifests → spec + infra validate scripts ─────────────

if [[ "$REL_PATH" =~ ^k8s/base/ ]]; then
    if ! any_spec_exists; then
        block "Phase 3 (k8s base manifests) requires Phase 1 (spec) first.

  No spec found in docs/specs/.

  Run the fullstack-spec-mermaid skill first."
    fi

    if ! infra_validate_exists; then
        block "Phase 3 (k8s base manifests) requires Phase 2 (infra validation scripts) first.

  No *.sh files found in k8s/validate/.

  Run the infra-testing skill to write validation scripts, then implement."
    fi

    exit 0
fi

# ─── Gate B: k8s overlays → base must exist + spec + validate ───────────────

if [[ "$REL_PATH" =~ ^k8s/overlays/ ]]; then
    if ! any_spec_exists; then
        block "Phase 3 (k8s overlays) requires Phase 1 (spec) first.

  No spec found in docs/specs/.

  Workflow: spec → test → code → doc. Write the spec first."
    fi

    if ! infra_validate_exists; then
        block "Phase 3 (k8s overlays) requires Phase 2 (infra validation scripts) first.

  No *.sh files found in k8s/validate/.

  Run the infra-testing skill to write validation scripts, then implement."
    fi

    if ! infra_base_exists; then
        block "Phase 3 (k8s overlays) requires k8s/base/ to exist first.

  k8s/base/kustomization.yaml not found.

  Write base manifests before creating environment overlays."
    fi

    exit 0
fi

# ─── Gate C: writing docs/implementation → tests must exist ─────────────────

if [[ "$REL_PATH" =~ ^docs/implementation/([^/]+)\.md$ ]]; then
    FEATURE="${BASH_REMATCH[1]}"

    has_tests=false
    if frontend_tests_exist "$FEATURE" || backend_tests_exist "$FEATURE"; then
        has_tests=true
    fi

    if [[ "$has_tests" == false ]]; then
        block "Phase 4 (docs) requires Phase 2 (tests) to exist.

  No tests found for feature '$FEATURE' in frontend/src/ or server/src/.

  Full workflow: spec → test → code → doc. Tests must exist and pass."
    fi

    if ! spec_exists "$FEATURE"; then
        echo ""
        echo "⚠  WARNING: Writing implementation doc for '$FEATURE' but docs/specs/$FEATURE.md not found."
        echo "   Spec drift section (§12) cannot be populated automatically."
        echo ""
    fi

    exit 0
fi

# ─── Gate F1: writing docs/fixes/<feature>-<slug>.md requires fix-router ────

if [[ "$REL_PATH" =~ ^docs/fixes/([^/]+)\.md$ ]]; then
    MODE=$(fix_mode)
    if [ "$MODE" = "none" ]; then
        block "Triage doc só pode ser criado dentro de um ciclo de fix ativo.

  Rode /fix, /refactor ou /hotfix primeiro — fix-router escreve .claude/state/fix-mode.txt."
    fi
    exit 0
fi

# ─── Gate F4: scope-lock — edits during fix must stay within triage §4 ──────
# Aplica-se a simple-fix e refactor. Hotfix ignora (urgência).
# Editing docs/, .claude/, tests, or the triage doc itself is always allowed.

MODE=$(fix_mode)
if [ "$MODE" = "simple-fix" ] || [ "$MODE" = "refactor" ]; then
    # Exceções: docs, configs, tests, triage doc.
    if [[ ! "$REL_PATH" =~ ^(docs/|\.claude/|\.gitignore|README) ]] \
       && [[ ! "$REL_PATH" =~ \.spec\.(ts|js|tsx|vue)$ ]] \
       && [[ ! "$REL_PATH" =~ \.e2e-spec\.ts$ ]]; then

        TRIAGE=$(triage_doc_path 2>/dev/null || true)

        if [ -z "${TRIAGE:-}" ]; then
            block "Fix ativo (mode=$MODE) mas triage doc não encontrado.

  state/fix-current.txt aponta para slug ausente em docs/fixes/.
  Rode fix-triage skill para criar o triage antes de editar código."
        fi

        if ! scope_includes "$TRIAGE" "$REL_PATH"; then
            block "Edição fora do scope do triage (§4 de $TRIAGE).

  Arquivo: $REL_PATH

  Opções:
    1. Atualizar §4 do triage para incluir este arquivo (justifique no triage)
    2. Re-route via fix-router se o scope mudou substancialmente
    3. rm .claude/state/fix-*.txt para sair do modo fix"
        fi
    fi
fi

exit 0
