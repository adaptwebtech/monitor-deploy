---
name: infra-testing
description: Internal phase-2 skill dispatched by feature-router. Writes k8s validate scripts. Do not invoke directly — use /feature.
---

# Infra Testing — kustomize + minikube

## Map rule
CODEBASE.md in context (hook-injected). Use §1/§8 k8s structure, §5 env vars, §11 k8s conventions, §12 skeletons.
FORBIDDEN: `grep`/`find`/`ls`/`Explore`/`Agent` for discovery. `Read k8s/` for inspiration.
ALLOWED: `Read docs/specs/<feature>.md`, `docs/implementation/<feature>.md`, current script.
Map stale or case not covered → stop and tell user.

---

Phase 2: spec with infra ACs exists. Write validate scripts that FAIL (RED) against current empty k8s tree.

## What infra "tests" are

| Layer | Tool | Checks | Speed |
|---|---|---|---|
| Build | `kustomize build` | YAML compiles | seconds |
| Dry-run | `minikube kubectl -- apply --dry-run=server` | K8s API validates shapes | seconds |
| Smoke | apply + rollout status | Pods actually start | minutes |

Prerequisite: `minikube start` + `minikube status` showing Running.

## File layout

```
k8s/validate/
  validate-base.sh       # kustomize build + dry-run for base
  validate-overlays.sh   # kustomize build + dry-run for each overlay
  smoke-test.sh          # apply to minikube + rollout status
```

## validate-base.sh

```bash
#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Building base manifests..."
minikube kubectl -- kustomize "$K8S_ROOT/base" > /tmp/base-manifests.yaml

echo "==> Dry-run validating base..."
minikube kubectl -- apply --dry-run=server -f /tmp/base-manifests.yaml
echo "✓ Base valid"
```

## validate-overlays.sh

```bash
#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

for OVERLAY in development staging production; do
    OVERLAY_PATH="$K8S_ROOT/overlays/$OVERLAY"
    [ ! -d "$OVERLAY_PATH" ] && echo "⚠ Skipping $OVERLAY (not found)" && continue
    echo "==> Validating $OVERLAY..."
    minikube kubectl -- kustomize "$OVERLAY_PATH" > "/tmp/$OVERLAY-manifests.yaml"
    minikube kubectl -- apply --dry-run=server -f "/tmp/$OVERLAY-manifests.yaml"
    echo "✓ $OVERLAY valid"
done
echo "✓ All overlays validated"
```

## smoke-test.sh

```bash
#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NAMESPACE="monitor-deploy-dev"

cleanup() {
    [[ "${KEEP_DEPLOY:-0}" != "1" ]] && \
    minikube kubectl -- kustomize "$K8S_ROOT/overlays/development" | \
    minikube kubectl -- delete -f - --ignore-not-found=true
}
trap cleanup EXIT

echo "==> Deploying development overlay..."
minikube kubectl -- kustomize "$K8S_ROOT/overlays/development" | minikube kubectl -- apply -f -

minikube kubectl -- rollout status deployment/api -n "$NAMESPACE" --timeout=120s
minikube kubectl -- rollout status deployment/vue-app -n "$NAMESPACE" --timeout=120s
echo "✓ Smoke test passed"
```

## RED gate
Scripts are RED when: kustomize exits non-zero (YAML error), dry-run returns error (invalid shape), rollout times out. Write scripts BEFORE manifests — scripts that pass empty tree = not testing anything.

## AC mapping
Infra ACs like "AC-12: api deployment must have resource limits" → add assertions to validate scripts (check YAML fields) or use conftest OPA policies in `k8s/policies/`.

## Coverage
- validate-base.sh: must pass before overlay work
- validate-overlays.sh: every defined environment
- smoke-test.sh: development minimum; production optional (CI only)

## Dispatch
Validate preconditions (spec with `[infra]` ACs exists). Extract `[infra]` ACs + §16 topology as inline context. Invoke `infra-testing-agent`. Don't duplicate work. Direct edit only for trivial tasks or explicit user request.
