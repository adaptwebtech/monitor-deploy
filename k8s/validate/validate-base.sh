#!/bin/bash
set -euo pipefail

# Validates k8s/base manifests via kustomize build + minikube dry-run client
# Checks: build succeeds, resources valid, all containers have resource limits,
#         no sensitive values (DATABASE_URL, JWT_*, API_KEY) in ConfigMaps

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

echo "==> Validating k8s/base manifests"
echo ""

# 1. Prereq: minikube running
echo "--- Prerequisite Checks ---"
if minikube status --format='{{.Host}}' 2>/dev/null | grep -q "Running"; then
  check "minikube is running" 0
else
  check "minikube is running" 1
  echo ""
  echo "Results: $PASS passed, $FAIL failed"
  exit 1
fi

# 2. kustomize build k8s/base → /tmp/base-manifests.yaml
echo ""
echo "--- Build Check ---"
if kustomize build "$K8S_ROOT/base" > /tmp/base-manifests.yaml 2>/tmp/kustomize-base-err.txt; then
  check "kustomize build k8s/base succeeds" 0
else
  check "kustomize build k8s/base succeeds" 1
  echo "    Error: $(cat /tmp/kustomize-base-err.txt)"
  echo ""
  echo "Results: $PASS passed, $FAIL failed"
  exit 1
fi

# 3. minikube kubectl -- apply --dry-run=client -f /tmp/base-manifests.yaml
echo ""
echo "--- Dry-run Validation ---"
if minikube kubectl -- apply --dry-run=client -f /tmp/base-manifests.yaml > /tmp/dry-run-base-out.txt 2>&1; then
  check "minikube kubectl dry-run=client accepts base manifests" 0
else
  check "minikube kubectl dry-run=client accepts base manifests" 1
  echo "    Error: $(cat /tmp/dry-run-base-out.txt | head -20)"
fi

# 4. Check all Deployment containers have resources.requests and resources.limits
echo ""
echo "--- Resource Limits Checks ---"

# Extract Deployment sections and verify resources blocks
DEPLOYMENTS=$(grep -c "^kind: Deployment" /tmp/base-manifests.yaml 2>/dev/null || echo "0")
RESOURCES_REQUESTS=$(grep -c "requests:" /tmp/base-manifests.yaml 2>/dev/null || echo "0")
RESOURCES_LIMITS=$(grep -c "limits:" /tmp/base-manifests.yaml 2>/dev/null || echo "0")

# Every deployment should have at least one resources.requests block
if [ "$DEPLOYMENTS" -gt 0 ] && [ "$RESOURCES_REQUESTS" -ge "$DEPLOYMENTS" ]; then
  check "All Deployment containers have resources.requests defined ($DEPLOYMENTS deployments, $RESOURCES_REQUESTS requests blocks)" 0
else
  check "All Deployment containers have resources.requests defined (deployments=$DEPLOYMENTS, requests blocks=$RESOURCES_REQUESTS)" 1
fi

if [ "$DEPLOYMENTS" -gt 0 ] && [ "$RESOURCES_LIMITS" -ge "$DEPLOYMENTS" ]; then
  check "All Deployment containers have resources.limits defined ($DEPLOYMENTS deployments, $RESOURCES_LIMITS limits blocks)" 0
else
  check "All Deployment containers have resources.limits defined (deployments=$DEPLOYMENTS, limits blocks=$RESOURCES_LIMITS)" 1
fi

# 5. Check no DATABASE_URL/JWT/API_KEY values in ConfigMap data
echo ""
echo "--- Secret Hygiene Checks (ConfigMap must not contain sensitive values) ---"

# Extract ConfigMap sections from the manifest
CONFIGMAP_SECTION=$(awk '/^kind: ConfigMap/,/^---/' /tmp/base-manifests.yaml 2>/dev/null || true)

if echo "$CONFIGMAP_SECTION" | grep -qE "^\s+DATABASE_URL\s*:" ; then
  check "No DATABASE_URL value in ConfigMap data" 1
else
  check "No DATABASE_URL value in ConfigMap data" 0
fi

if echo "$CONFIGMAP_SECTION" | grep -qE "^\s+JWT_[A-Z_]+\s*:" ; then
  check "No JWT_* values in ConfigMap data" 1
else
  check "No JWT_* values in ConfigMap data" 0
fi

if echo "$CONFIGMAP_SECTION" | grep -qE "^\s+API_KEY\s*:" ; then
  check "No API_KEY value in ConfigMap data" 1
else
  check "No API_KEY value in ConfigMap data" 0
fi

# 6. AC-3: api Deployment deve ter readinessProbe apontando para /health
echo ""
echo "--- Health Probe Checks ---"

# Extrair seção do Deployment api e verificar readinessProbe
API_SECTION=$(awk '/^kind: Deployment/{found=0} /name: api/{found=1} found{print} /^---/{if(found) exit}' /tmp/base-manifests.yaml 2>/dev/null || true)

if echo "$API_SECTION" | grep -q "readinessProbe:"; then
  check "AC-3: api Deployment contém readinessProbe" 0
else
  check "AC-3: api Deployment contém readinessProbe" 1
fi

if echo "$API_SECTION" | grep -q "path: /health"; then
  check "AC-3: readinessProbe aponta para /health" 0
else
  check "AC-3: readinessProbe aponta para /health" 1
fi

if echo "$API_SECTION" | grep -qE "port: 3000"; then
  check "AC-3: readinessProbe usa port 3000" 0
else
  check "AC-3: readinessProbe usa port 3000" 1
fi

# 7. Summary
echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
