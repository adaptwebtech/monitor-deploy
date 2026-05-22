#!/usr/bin/env bash
# PreToolUse hook: blocks greenfield phase skills (spec/testing/implementation/doc-writer)
# when no active feature pipeline exists. Forces entry via /feature <name>.
#
# Fail-open: errors or missing state → exit 0 (don't block on infra failure).

set -u

PROJECT_ROOT="/home/awtech/Desktop/Projects/monitor_deploy"

input=$(cat 2>/dev/null || true)

# Only react when the tool is Skill.
tool_name=$(printf '%s' "$input" | grep -oE '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed -E 's/.*"([^"]+)"$/\1/')
if [ "$tool_name" != "Skill" ]; then
  exit 0
fi

# Extract skill name.
skill_name=$(printf '%s' "$input" \
  | grep -oE '"skill"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -n1 \
  | sed -E 's/.*"([^"]+)"$/\1/')

# Gate only on greenfield phase skills.
case "$skill_name" in
  fullstack-spec-mermaid \
  |frontend-testing|backend-testing|infra-testing \
  |frontend-implementation|backend-implementation|infra-implementation \
  |fullstack-doc-writer)
    ;;
  *)
    exit 0
    ;;
esac

# Allow if fix pipeline is active (different pipeline, different state).
fix_mode_file="$PROJECT_ROOT/.claude/state/fix-mode.txt"
if [ -f "$fix_mode_file" ]; then
  fix_mode=$(tr -d '[:space:]' < "$fix_mode_file" 2>/dev/null || echo "none")
  if [ "$fix_mode" != "none" ] && [ -n "$fix_mode" ]; then
    exit 0
  fi
fi

# Allow if feature pipeline is active.
phase_file="$PROJECT_ROOT/.claude/state/feature-phase.txt"
if [ -f "$phase_file" ]; then
  phase=$(tr -d '[:space:]' < "$phase_file" 2>/dev/null || echo "none")
  case "$phase" in
    spec|tests|code|doc)
      exit 0
      ;;
  esac
fi

# No active pipeline — block.
feature_name=""
name_file="$PROJECT_ROOT/.claude/state/feature-name.txt"
if [ -f "$name_file" ]; then
  feature_name=$(tr -d '[:space:]' < "$name_file" 2>/dev/null || echo "")
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  FEATURE GATE BLOCKED                                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Skill '$skill_name' invocada sem pipeline de feature ativo."
echo ""
echo "  Use: /feature <nome-da-feature>"
echo ""
echo "  Isso inicializa o state e despacha as fases em ordem:"
echo "  spec → tests → code → doc"
echo ""
if [ -n "$feature_name" ] && [ "$feature_name" != "none" ]; then
  echo "  Pipeline anterior: '$feature_name' (fase: ${phase:-none})"
  echo "  Para resetar: rm .claude/state/feature-*.txt"
  echo ""
fi

exit 1
