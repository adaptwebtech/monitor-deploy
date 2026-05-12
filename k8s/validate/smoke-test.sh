#!/bin/bash
set -euo pipefail

# Smoke test: docker-compose up, verify API health, verify postgres+redis running, tear down

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$K8S_ROOT/.." && pwd)"

PASS=0
FAIL=0

check() {
  local description="$1"
  local result="$2"  # 0 = pass, non-zero = fail

  if [ "$result" -eq 0 ]; then
    echo "  [PASS] $description"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $description"
    FAIL=$((FAIL + 1))
  fi
}

cleanup() {
  echo ""
  echo "==> Tearing down docker-compose..."
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" down --volumes 2>/dev/null || true
}
trap cleanup EXIT

echo "==> Running smoke tests against docker-compose"
echo ""

# 1. Prereq: docker compose available
echo "--- Prerequisite Checks ---"
if docker compose version > /dev/null 2>&1; then
  check "docker compose is available" 0
else
  check "docker compose is available" 1
  echo ""
  echo "Results: $PASS passed, $FAIL failed"
  exit 1
fi

if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
  check "docker-compose.yml exists at project root" 0
else
  check "docker-compose.yml exists at project root" 1
  echo ""
  echo "Results: $PASS passed, $FAIL failed"
  exit 1
fi

# 2. docker compose up -d
echo ""
echo "--- Startup ---"
if docker compose -f "$PROJECT_ROOT/docker-compose.yml" up -d > /tmp/compose-up.txt 2>&1; then
  check "docker compose up -d succeeded" 0
else
  check "docker compose up -d succeeded" 1
  echo "    Error: $(cat /tmp/compose-up.txt | tail -10)"
  echo ""
  echo "Results: $PASS passed, $FAIL failed"
  exit 1
fi

# 3. Wait for API health: retry GET http://localhost:3000/health up to 30 times, 2s sleep
echo ""
echo "--- API Health Check ---"
API_HEALTHY=0
MAX_ATTEMPTS=30
for attempt in $(seq 1 $MAX_ATTEMPTS); do
  echo "    Attempt $attempt/$MAX_ATTEMPTS: checking http://localhost:3000/health ..."
  if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    API_HEALTHY=1
    break
  fi
  sleep 2
done

if [ "$API_HEALTHY" -eq 1 ]; then
  check "API responds at http://localhost:3000/health" 0
else
  check "API responds at http://localhost:3000/health (timed out after $MAX_ATTEMPTS attempts)" 1
fi

# 4. Check postgres container running
echo ""
echo "--- Service Status Checks ---"
if docker compose -f "$PROJECT_ROOT/docker-compose.yml" ps postgres 2>/dev/null | grep -qiE "running|up"; then
  check "postgres container is running" 0
else
  check "postgres container is running" 1
fi

# 5. Check redis container running
if docker compose -f "$PROJECT_ROOT/docker-compose.yml" ps redis 2>/dev/null | grep -qiE "running|up"; then
  check "redis container is running" 0
else
  check "redis container is running" 1
fi

# 6. Summary (cleanup runs via EXIT trap)
echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
