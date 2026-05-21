#!/usr/bin/env bash
# PreToolUse hook: durante um ciclo de fix ativo (state/fix-mode.txt != none),
# bloqueia descoberta ampla (ls/find/grep/rg em server/src, frontend/src, k8s)
# e subagents genéricos (Explore, general-purpose). Força uso do mapa §10 e
# do triage doc §4.
#
# Modos:
#   simple-fix | refactor  → block estrito
#   hotfix                 → warn-only (urgência > rigor)
#   none / arquivo ausente → exit 0 (greenfield ou idle)
#
# Fail-open em qualquer erro de parsing/IO.

set -u

PROJECT_ROOT="/home/awtech/Desktop/Projects/monitor_deploy"
STATE_FILE="$PROJECT_ROOT/.claude/state/fix-mode.txt"

# Modo atual.
FIX_MODE="none"
if [ -f "$STATE_FILE" ]; then
  FIX_MODE=$(tr -d '[:space:]' < "$STATE_FILE" 2>/dev/null || echo "none")
fi

# Idle → não interfere.
if [ -z "$FIX_MODE" ] || [ "$FIX_MODE" = "none" ]; then
  exit 0
fi

input=$(cat 2>/dev/null || true)

tool_name=$(printf '%s' "$input" \
  | grep -oE '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -n1 \
  | sed -E 's/.*"([^"]+)"$/\1/')

# Helpers --------------------------------------------------------------------

warn_or_block() {
  local msg="$1"
  if [ "$FIX_MODE" = "hotfix" ]; then
    echo ""
    echo "⚠  DISCOVERY-GATE WARN (hotfix — não bloqueado)"
    echo "$msg"
    echo ""
    exit 0
  fi
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║  DISCOVERY GATE BLOCKED (fix-mode=$FIX_MODE)"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""
  echo "$msg"
  echo ""
  echo "Use docs/CODEBASE.md §8 (feature index), §10 (símbolos), §12 (skeletons)."
  echo "Ou §4 do triage doc atual em docs/fixes/."
  echo ""
  exit 1
}

# Extract field helper.
json_field() {
  local key="$1"
  printf '%s' "$input" \
    | grep -oE "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" \
    | head -n1 \
    | sed -E 's/.*"([^"]+)"$/\1/'
}

# Bash ----------------------------------------------------------------------

if [ "$tool_name" = "Bash" ]; then
  cmd=$(printf '%s' "$input" \
    | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('command', ''))
except Exception:
    print('')
" 2>/dev/null)

  # Recursive discovery patterns over src trees.
  if printf '%s' "$cmd" | grep -qE '(\bls\b.*-[A-Za-z]*R|\bfind\b|\bgrep\b.*-[A-Za-z]*r|\brg\b)' ; then
    if printf '%s' "$cmd" | grep -qE '(server/src|frontend/src|frontend/e2e|k8s/base|k8s/overlays|prisma/schema)' ; then
      warn_or_block "Bash command tenta descoberta ampla em src/k8s durante fix ativo:
  $cmd"
    fi
  fi
  exit 0
fi

# Grep / Glob ---------------------------------------------------------------

if [ "$tool_name" = "Grep" ] || [ "$tool_name" = "Glob" ]; then
  path=$(printf '%s' "$input" \
    | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    ti = d.get('tool_input', {})
    print(ti.get('path', '') or ti.get('pattern', ''))
except Exception:
    print('')
" 2>/dev/null)

  if printf '%s' "$path" | grep -qE '(server/src|frontend/src|frontend/e2e|k8s/base|k8s/overlays)' ; then
    warn_or_block "$tool_name em src/k8s durante fix ativo: $path"
  fi
  exit 0
fi

# Agent (subagent dispatch) -------------------------------------------------

if [ "$tool_name" = "Agent" ]; then
  sub=$(printf '%s' "$input" \
    | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('subagent_type', ''))
except Exception:
    print('')
" 2>/dev/null)

  case "$sub" in
    Explore|general-purpose)
      warn_or_block "Subagent de descoberta '$sub' durante fix ativo.
  Use cavecrew:cavecrew-investigator ou fix-triage-agent ao invés."
      ;;
  esac
  exit 0
fi

exit 0
