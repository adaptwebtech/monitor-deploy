#!/usr/bin/env bash
# Reads Claude Code PostToolUse JSON from stdin.
# If edited file is in frontend/src/, server/src/, k8s/, prisma/, or .env.example,
# prints a reminder to update docs/CODEBASE.md.

input=$(cat)

file_path=$(echo "$input" | python3 -c "
import sys, json
data = json.load(sys.stdin)
path = (
    data.get('tool_input', {}).get('file_path') or
    data.get('tool_input', {}).get('path') or
    ''
)
print(path)
" 2>/dev/null)

if [[ -z "$file_path" ]]; then
  exit 0
fi

should_remind=false

if [[ "$file_path" == */frontend/src/* ]]; then
  should_remind=true
elif [[ "$file_path" == */server/src/* ]]; then
  should_remind=true
elif [[ "$file_path" == */k8s/* ]]; then
  should_remind=true
elif [[ "$file_path" == *prisma/schema.prisma ]]; then
  should_remind=true
elif [[ "$file_path" == *.env.example ]]; then
  should_remind=true
fi

if [[ "$should_remind" == true ]]; then
  echo ""
  echo "⚠️  CODEBASE.md reminder: '$file_path' was modified."
  echo "   If this change affects module structure, DB schema, Vue components,"
  echo "   k8s resources, env vars, or file tree, update docs/CODEBASE.md"
  echo "   before completing Phase 3 or 4."
  echo ""
fi
