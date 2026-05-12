#!/bin/bash
set -euo pipefail

# Validates each overlay (development, staging, production) via kustomize build + minikube dry-run server
# Checks per overlay:
# - build succeeds
# - minikube kubectl -- apply --dry-run=server -f - accepts
# - namespace is correct (monitor-deploy-dev, monitor-deploy-staging, monitor-deploy-production)
# - replicas: 1 for all Deployments
# - dev/staging image tags are NOT :latest and are env-name strings (not 40-char hex SHA)
# - production image tag matches 40-char hex SHA pattern

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

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

echo "==> Validating k8s overlay manifests"
echo ""

# Prereq: minikube running
echo "--- Prerequisite Checks ---"
if minikube status --format='{{.Host}}' 2>/dev/null | grep -q "Running"; then
  check "minikube is running" 0
else
  check "minikube is running" 1
  echo ""
  echo "Results: $PASS passed, $FAIL failed"
  exit 1
fi

OVERLAYS=("development" "staging" "production")
EXPECTED_NAMESPACES=("monitor-deploy-dev" "monitor-deploy-staging" "monitor-deploy-production")

for i in "${!OVERLAYS[@]}"; do
  OVERLAY="${OVERLAYS[$i]}"
  EXPECTED_NS="${EXPECTED_NAMESPACES[$i]}"
  MANIFEST_FILE="/tmp/overlay-${OVERLAY}-manifests.yaml"

  echo ""
  echo "--- Overlay: $OVERLAY (expected namespace: $EXPECTED_NS) ---"

  # Build overlay
  if kustomize build "$K8S_ROOT/overlays/$OVERLAY" > "$MANIFEST_FILE" 2>/tmp/kustomize-overlay-err.txt; then
    check "[$OVERLAY] kustomize build succeeds" 0
  else
    check "[$OVERLAY] kustomize build succeeds" 1
    echo "    Error: $(cat /tmp/kustomize-overlay-err.txt)"
    # Skip remaining checks for this overlay if build fails
    continue
  fi

  # Dry-run server
  if kustomize build "$K8S_ROOT/overlays/$OVERLAY" | minikube kubectl -- apply --dry-run=server -f - > /tmp/dry-run-overlay-out.txt 2>&1; then
    check "[$OVERLAY] minikube kubectl dry-run=server accepts manifests" 0
  else
    check "[$OVERLAY] minikube kubectl dry-run=server accepts manifests" 1
    echo "    Error: $(cat /tmp/dry-run-overlay-out.txt | head -20)"
  fi

  # Namespace check
  ACTUAL_NS=$(grep -E "^\s+namespace:" "$MANIFEST_FILE" | head -1 | awk '{print $2}' || true)
  if [ -z "$ACTUAL_NS" ]; then
    # Try metadata.namespace in full document
    ACTUAL_NS=$(awk '/^metadata:/,/^[a-z]/' "$MANIFEST_FILE" | grep "namespace:" | head -1 | awk '{print $2}' || true)
  fi

  if grep -q "namespace: $EXPECTED_NS" "$MANIFEST_FILE"; then
    check "[$OVERLAY] namespace is '$EXPECTED_NS'" 0
  else
    check "[$OVERLAY] namespace is '$EXPECTED_NS' (found: $(grep 'namespace:' "$MANIFEST_FILE" | head -3 | tr '\n' ' ' | xargs))" 1
  fi

  # Replicas check: all Deployments must have replicas: 1
  WRONG_REPLICAS=$(grep -E "^\s+replicas:" "$MANIFEST_FILE" | grep -v "replicas: 1" || true)
  if [ -z "$WRONG_REPLICAS" ]; then
    check "[$OVERLAY] all Deployments have replicas: 1" 0
  else
    check "[$OVERLAY] all Deployments have replicas: 1 (found non-1 replicas: $(echo "$WRONG_REPLICAS" | tr '\n' ' '))" 1
  fi

  # Image tag checks
  if [ "$OVERLAY" = "production" ]; then
    # Production: image tags must match 40-char hex SHA pattern
    IMAGE_LINES=$(grep -E "^\s+image:" "$MANIFEST_FILE" || true)
    NON_SHA_IMAGES=$(echo "$IMAGE_LINES" | grep -vE ":[0-9a-f]{40}$" || true)
    if [ -z "$NON_SHA_IMAGES" ]; then
      check "[$OVERLAY] all image tags are 40-char hex SHA" 0
    else
      check "[$OVERLAY] all image tags are 40-char hex SHA (non-SHA found: $(echo "$NON_SHA_IMAGES" | head -3 | tr '\n' ' '))" 1
    fi
  else
    # dev/staging: image tags must NOT be :latest AND must be env-name strings (not 40-char SHA)
    IMAGE_LINES=$(grep -E "^\s+image:" "$MANIFEST_FILE" || true)

    LATEST_IMAGES=$(echo "$IMAGE_LINES" | grep ":latest" || true)
    if [ -z "$LATEST_IMAGES" ]; then
      check "[$OVERLAY] no image tag is :latest" 0
    else
      check "[$OVERLAY] no image tag is :latest (found: $(echo "$LATEST_IMAGES" | tr '\n' ' '))" 1
    fi

    SHA_IMAGES=$(echo "$IMAGE_LINES" | grep -E ":[0-9a-f]{40}$" || true)
    if [ -z "$SHA_IMAGES" ]; then
      check "[$OVERLAY] image tags are env-name strings (not SHA)" 0
    else
      check "[$OVERLAY] image tags are env-name strings (not SHA) (SHA tags found: $(echo "$SHA_IMAGES" | tr '\n' ' '))" 1
    fi

    # Tags should contain overlay name
    WRONG_TAG_IMAGES=$(echo "$IMAGE_LINES" | grep -v ":$OVERLAY" || true)
    if [ -z "$WRONG_TAG_IMAGES" ]; then
      check "[$OVERLAY] image tags match overlay name ':$OVERLAY'" 0
    else
      check "[$OVERLAY] image tags match overlay name ':$OVERLAY' (mismatched: $(echo "$WRONG_TAG_IMAGES" | head -3 | tr '\n' ' '))" 1
    fi
  fi

done

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
