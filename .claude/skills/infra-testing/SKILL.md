---
name: infra-testing
description: Use this skill whenever the user wants to write infra validation tests for k8s + kustomize manifests. Produces validation shell scripts that use minikube kubectl for dry-run validation and smoke testing. Triggers on phrases like "validate the k8s manifests", "test the infra", "write infra tests", "validate overlays", "check the kustomize config", or "write k8s validation". This is phase 2 of a spec → test → code → doc workflow for the infra layer; validation scripts are written before manifests and define the RED state.
---

# Infra Testing — kustomize + minikube

## 🔒 REGRA ABSOLUTA — Mapa é fonte única

`docs/CODEBASE.md` **já está no contexto** (injetado por hook PreToolUse). Cobre tudo: §1/§8 estrutura `k8s/` + feature → arquivos infra, §5 env vars, §11 convenções k8s, **§12 skeletons (Deployment, Service, overlay patch)**, §13 ponteiros para `docs/implementation/<feature>.md`.

### PROIBIDO
- `grep`, `find`, `ls` para descobrir scripts em `k8s/validate/` ou manifests existentes.
- `Explore`, `Agent` (qualquer subagent de descoberta) para localizar resources ou patterns.
- `Read` em `k8s/` **para inspiração de pattern existente** — use §12.

### PERMITIDO
- `Read` em `docs/specs/<feature>.md` e `docs/implementation/<feature>.md` (sob demanda, só o relevante).
- `Read`/`Edit`/`Write` no script/manifest que você está editando agora.
- `grep`/`find` apenas para detalhe não coberto pelo mapa nem pelos docs de implementação.

Se §12/§10/§13 não cobrirem seu caso, **pare e avise o usuário**. Não invente, não greppe.

Mapa desatualizado → pare e avise antes de prosseguir.

---

## What infra "tests" are

K8s manifests don't have unit tests. Infra validation = confirming manifests compile and are accepted by a real k8s API server.

Three layers:

| Layer | Tool | What it checks | Speed |
|---|---|---|---|
| Build | `kustomize build` | Kustomize YAML compiles without errors | seconds |
| Dry-run | `minikube kubectl -- apply --dry-run=server` | K8s API validates resource shapes | seconds |
| Smoke | `minikube kubectl -- apply` + rollout status | Pods actually start in minikube | minutes |

## When to invoke

- "validate the k8s manifests"
- "test the infra"
- "write infra tests"
- "validate overlays"
- "check the kustomize config"
- "write k8s validation"
- Phase 2 of infra workflow (spec approved, manifests not yet written)

## Prerequisite

```bash
minikube start
minikube status  # must show: host: Running, kubelet: Running, apiserver: Running
```

Always document this prereq in README. Skill won't work without minikube running.

## File layout

```
k8s/
  validate/
    validate-base.sh       # kustomize build + dry-run for base
    validate-overlays.sh   # kustomize build + dry-run for each overlay
    smoke-test.sh          # apply to minikube + rollout status check
```

## validate-base.sh (write this file)

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Building base manifests..."
minikube kubectl -- kustomize "$K8S_ROOT/base" > /tmp/base-manifests.yaml

echo "==> Dry-run validating base against minikube API server..."
minikube kubectl -- apply --dry-run=server -f /tmp/base-manifests.yaml

echo "✓ Base manifests valid"
```

## validate-overlays.sh (write this file)

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

OVERLAYS=("development" "staging" "production")

for OVERLAY in "${OVERLAYS[@]}"; do
    OVERLAY_PATH="$K8S_ROOT/overlays/$OVERLAY"
    if [ ! -d "$OVERLAY_PATH" ]; then
        echo "⚠  Skipping $OVERLAY (directory not found)"
        continue
    fi

    echo "==> Building $OVERLAY overlay..."
    minikube kubectl -- kustomize "$OVERLAY_PATH" > "/tmp/$OVERLAY-manifests.yaml"

    echo "==> Dry-run validating $OVERLAY against minikube API server..."
    minikube kubectl -- apply --dry-run=server -f "/tmp/$OVERLAY-manifests.yaml"

    echo "✓ $OVERLAY overlay valid"
done

echo ""
echo "✓ All overlays validated"
```

## smoke-test.sh (write this file)

```bash
#!/bin/bash
# Deploys development overlay to minikube and verifies pods reach Running state.
# Cleans up after test unless KEEP_DEPLOY=1 is set.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NAMESPACE="monitor-deploy-dev"

cleanup() {
    if [[ "${KEEP_DEPLOY:-0}" != "1" ]]; then
        echo "==> Cleaning up..."
        minikube kubectl -- kustomize "$K8S_ROOT/overlays/development" | minikube kubectl -- delete -f - --ignore-not-found=true
    fi
}
trap cleanup EXIT

echo "==> Deploying development overlay to minikube..."
minikube kubectl -- kustomize "$K8S_ROOT/overlays/development" | minikube kubectl -- apply -f -

echo "==> Waiting for api deployment..."
minikube kubectl -- rollout status deployment/api -n "$NAMESPACE" --timeout=120s

echo "==> Waiting for vue-app deployment..."
minikube kubectl -- rollout status deployment/vue-app -n "$NAMESPACE" --timeout=120s

echo "==> Verifying pods are Running..."
minikube kubectl -- get pods -n "$NAMESPACE"

echo ""
echo "✓ Smoke test passed — all deployments healthy"
```

## RED state definition

Tests are in RED when:
- `minikube kubectl -- kustomize` exits non-zero (YAML syntax error, missing reference)
- `--dry-run=server` returns error (invalid resource shape, unknown field, missing CRD)
- `rollout status` times out or fails

Run validate scripts after writing them but BEFORE writing any k8s manifests. If they pass with empty/stub manifests, they're not testing anything — intentionally write scripts that would fail for missing resources.

## Map ACs to infra tests

Infra ACs from spec typically look like:
- "AC-12: api deployment must have resource limits set"
- "AC-13: development overlay must use non-production image tag"
- "AC-14: postgres PVC must request at least 5Gi in production"

For policy-level ACs (not just "does it apply"), use conftest OPA policies:

```
k8s/
  policies/
    resource-limits.rego    # Every container must have resource limits
    image-tags.rego         # Production must use SHA tag, not :latest
```

Optional — add to validate-overlays.sh:

```bash
echo "==> Running OPA policy checks..."
conftest test "/tmp/$OVERLAY-manifests.yaml" --policy "$K8S_ROOT/policies/"
```

## Coverage

- validate-base.sh: must pass before any overlay work begins
- validate-overlays.sh: must pass for every defined environment
- smoke-test.sh: must pass for development overlay minimum; production overlay smoke test optional (CI only)
