#!/usr/bin/env bash
# PreToolUse hook: inject docs/CODEBASE.md for all phase skills.
# Additionally inject docs/CODEBASE-SKELETONS.md (§12) for impl + testing skills only.
# Fail-open: any error → exit 0 (don't block).

set -u

PROJECT_ROOT="/home/awtech/Desktop/Projects/monitor_deploy"
MAP_FILE="$PROJECT_ROOT/docs/CODEBASE.md"
SKELETONS_FILE="$PROJECT_ROOT/docs/CODEBASE-SKELETONS.md"

input=$(cat 2>/dev/null || true)

tool_name=$(printf '%s' "$input" | grep -oE '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed -E 's/.*"([^"]+)"$/\1/')
if [ "$tool_name" != "Skill" ]; then
  exit 0
fi

skill_name=$(printf '%s' "$input" \
  | grep -oE '"skill"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -n1 \
  | sed -E 's/.*"([^"]+)"$/\1/')

case "$skill_name" in
  frontend-implementation|backend-implementation|infra-implementation \
  |frontend-testing|backend-testing|infra-testing \
  |fullstack-spec-mermaid|fullstack-doc-writer \
  |feature-router \
  |fix-router|fix-triage|fix-regression-testing|fix-implementation|fix-doc-update)
    ;;
  *)
    exit 0
    ;;
esac

[ ! -f "$MAP_FILE" ] && exit 0

map_content=$(cat "$MAP_FILE")

# Skills that need code skeletons (§12)
needs_skeletons=false
case "$skill_name" in
  frontend-implementation|backend-implementation|infra-implementation \
  |frontend-testing|backend-testing|infra-testing)
    needs_skeletons=true
    ;;
esac

skeletons_content=""
if [ "$needs_skeletons" = "true" ] && [ -f "$SKELETONS_FILE" ]; then
  skeletons_content=$(cat "$SKELETONS_FILE")
fi

python3 - "$skill_name" "$map_content" "$skeletons_content" "$needs_skeletons" <<'PY' 2>/dev/null || true
import json, sys, re

skill = sys.argv[1]
content = sys.argv[2]
skeletons = sys.argv[3]
needs_skeletons = sys.argv[4] == "true"

FIX_SKILLS = {
    "fix-router", "fix-triage", "fix-regression-testing",
    "fix-implementation", "fix-doc-update"
}

# Fix skills only need §8/§10/§11/§13 — extract by section header
if skill in FIX_SKILLS:
    needed_prefixes = ("## 8.", "## 10.", "## 11.", "## 13.")
    # Split on ALL ## sections; keep preamble (before first ##) + needed numbered sections
    parts = re.split(r'\n(?=## )', content)
    preamble = parts[0] if parts else ""
    filtered = [p for p in parts[1:] if p.strip().startswith(needed_prefixes)]
    content = preamble.rstrip() + "\n\n" + "\n\n".join(filtered)
    banner_note = " (§8/§10/§11/§13 — fix subset)"
else:
    banner_note = ""

banner = (
    f"MAPA DE CÓDIGO AUTORITATIVO carregado para skill `{skill}`{banner_note}.\n"
    "Use para localizar arquivos, módulos, símbolos, env vars, schema, convenções.\n"
    "NÃO use grep/find/ls para descoberta — apenas lógica interna não coberta pelo mapa.\n"
    "Mapa desatualizado → pare e avise usuário.\n\n"
    "--- docs/CODEBASE.md ---\n"
)
full_context = banner + content

if needs_skeletons and skeletons:
    full_context += (
        "\n\n--- docs/CODEBASE-SKELETONS.md (§12 — skeletons canônicos) ---\n"
        + skeletons
    )

out = {
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "additionalContext": full_context
    }
}
print(json.dumps(out))
PY

exit 0
