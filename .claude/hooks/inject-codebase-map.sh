#!/usr/bin/env bash
# PreToolUse hook: when one of the project's phase skills (spec / testing /
# implementation / doc-writer) is invoked via the Skill tool, inject the full
# contents of docs/CODEBASE.md as additional context so the model uses the
# authoritative map instead of grepping the tree.
#
# Fail-open: any error or missing file → exit 0 with empty output (don't block).

set -u

PROJECT_ROOT="/home/awtech/Desktop/Projects/monitor_deploy"
MAP_FILE="$PROJECT_ROOT/docs/CODEBASE.md"

# stdin = JSON from Claude Code. Read it once.
input=$(cat 2>/dev/null || true)

# Only react when the tool is Skill.
tool_name=$(printf '%s' "$input" | grep -oE '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed -E 's/.*"([^"]+)"$/\1/')
if [ "$tool_name" != "Skill" ]; then
  exit 0
fi

# Extract the `skill` argument from tool_input.
skill_name=$(printf '%s' "$input" \
  | grep -oE '"skill"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -n1 \
  | sed -E 's/.*"([^"]+)"$/\1/')

case "$skill_name" in
  frontend-implementation|backend-implementation|infra-implementation \
  |frontend-testing|backend-testing|infra-testing \
  |fullstack-spec-mermaid|fullstack-doc-writer \
  |fix-router|fix-triage|fix-regression-testing|fix-implementation|fix-doc-update)
    ;;
  *)
    exit 0
    ;;
esac

# Bail if map missing.
if [ ! -f "$MAP_FILE" ]; then
  exit 0
fi

map_content=$(cat "$MAP_FILE")

# Emit JSON with additionalContext using a hookSpecificOutput.
# Use python3 for safe JSON encoding (avoids escaping mistakes).
python3 - "$skill_name" "$map_content" <<'PY' 2>/dev/null || true
import json, sys
skill = sys.argv[1]
content = sys.argv[2]
banner = (
    f"MAPA DE CÓDIGO AUTORITATIVO carregado para skill `{skill}`.\n"
    "Use este mapa para localizar arquivos, módulos, símbolos, env vars, schema, e convenções.\n"
    "NÃO use grep/find/ls para descobrir estrutura — apenas para lógica interna de uma função "
    "específica não coberta pelo mapa.\n"
    "Se mapa parecer desatualizado, pare e avise o usuário antes de prosseguir.\n\n"
    "--- docs/CODEBASE.md ---\n"
)
out = {
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "additionalContext": banner + content
    }
}
print(json.dumps(out))
PY

exit 0
