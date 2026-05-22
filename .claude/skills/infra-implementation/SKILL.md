---
name: infra-implementation
description: Internal phase-3 skill dispatched by feature-router. Implements k8s manifests until validate scripts pass. Do not invoke directly — use /feature.
---

# Infra Implementation — k8s + Kustomize + Docker

## Map rule
CODEBASE.md in context (hook-injected). Use §1/§8 k8s structure, §5 env vars, §11 k8s conventions, §12 skeletons, §13 impl docs.
FORBIDDEN: `grep`/`find`/`ls`/`Explore`/`Agent` for discovery. `Read k8s/` for inspiration.
ALLOWED: `Read docs/specs/<feature>.md`, `docs/implementation/<feature>.md`, current manifest under edit.
Map stale or case not covered → stop and tell user.

---

Phase 3: spec + validate scripts exist. Write manifests to make validate scripts pass.

## Overlay structure philosophy
Base = complete canonical resource. Overlays = surgical patches for environment differences only. Never copy-paste full resource into overlay.

## File naming convention
```
k8s/base/
  0X-<name>-pv.yaml           # PersistentVolumes
  1X-<name>-pvc.yaml          # PersistentVolumeClaims
  2X-<name>-configmap.yaml    # ConfigMaps / Secrets
  3X-<name>-deployment.yaml   # Deployments
  4X-<name>-service.yaml      # Services
  kustomization.yaml
k8s/overlays/<env>/
  namespace.yaml
  kustomization.yaml
  *-patch.yaml                # patches only
```

## kustomization.yaml pattern

```yaml
# k8s/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - 00-postgres-pv.yaml
  - 10-postgres-pvc.yaml
  - 20-env-configmap.yaml
  - 30-postgres-deployment.yaml
  - 32-api-deployment.yaml
  - 33-vue-deployment.yaml
  - 40-postgres-service.yaml
  - 42-api-service.yaml
  - 43-vue-service.yaml
```

```yaml
# k8s/overlays/development/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
  - namespace.yaml
namespace: monitor-deploy-dev
images:
  - name: registry.example.com/monitor-deploy/api
    newTag: development
patches:
  - path: env-patch.configmap.yaml
    target: { kind: ConfigMap, name: env }
  - path: api-deployment-patch.yaml
    target: { kind: Deployment, name: api }
```

See §12 for base Deployment/Service and overlay patch skeletons.

## Image tag strategy
| Environment | Format | Example |
|---|---|---|
| development | env name | `development` |
| staging | env name | `staging` |
| production | Git SHA | `a1b2c3d4...` |

Never `:latest` in any environment.

## ConfigMap env pattern
Base has placeholder values. Overlays patch real per-environment values.
```yaml
# k8s/overlays/development/env-patch.configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: env
data:
  NODE_ENV: "development"
  DATABASE_URL: "postgresql://postgres:devpassword@postgres:5432/monitor_deploy_dev"
```

## Order of writing
1. `k8s/base/kustomization.yaml` (file list only, no inline resources)
2. Base ConfigMap + Secrets
3. Base PVs + PVCs
4. Base Deployments
5. Base Services
6. `k8s/overlays/development/` (first overlay)
7. `k8s/overlays/staging/` + `k8s/overlays/production/`

After each step: `minikube kubectl -- kustomize k8s/base/ | minikube kubectl -- apply --dry-run=server -f -`

## Docker + compose rules
- `docker-compose.yml` at repo root — update in same commit as any service/env/port/volume change
- Services: `api`, `vue`, `postgres`, `redis`
- `postgres` + `redis` require healthchecks — `api` `depends_on` with `condition: service_healthy`
- Named volumes for DB data, never anonymous
- Env vars via `.env` file, never inline secrets in compose
- `vue` proxies `/api/` → `api:3000` via nginx (`frontend/nginx.conf`)

```yaml
# docker-compose.yml (key structure)
services:
  api:
    build: ./server
    ports: ["3000:3000"]
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
  vue:
    build: ./frontend
    ports: ["80:80"]
    depends_on: [api]
  postgres:
    image: postgres:16-alpine
    env_file: .env
    volumes: [postgres-data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER"]
      interval: 10s
      retries: 5
  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      retries: 5
volumes:
  postgres-data:
```

## Dockerfile rules
- Layer order: `COPY package*.json` → `npm ci` → `COPY source` → build. Never `COPY . .` before `npm ci`.
- Base images: `node:20-alpine` for Node, `nginx:alpine` for Vue runner. Never `:latest`.
- Backend: non-root user in runner stage (`adduser app`, `USER app`).
- Frontend: nginx runner (never Node in prod). `nginx.conf` must proxy `/api/` → `api:3000`.
- `.dockerignore` required in both `server/` and `frontend/`: exclude `node_modules`, `dist`, `.env*`, `**/*.spec.*`, `test/`.

## k8s checklist
- [ ] `minikube kubectl -- kustomize k8s/base/` exits 0
- [ ] All overlay dry-runs pass (validate-overlays.sh)
- [ ] All pods reach Running in minikube smoke test
- [ ] No `:latest` image tags
- [ ] Each environment has own namespace
- [ ] Resource requests + limits on every container
- [ ] No secrets in ConfigMap — Secrets only
- [ ] Production uses SHA image tags

## Docker checklist
- [ ] `docker-compose.yml` reflects current services/env/ports
- [ ] `server/Dockerfile` multi-stage, non-root user
- [ ] `frontend/Dockerfile` multi-stage, nginx runner
- [ ] `frontend/nginx.conf` present and proxies `/api/`
- [ ] Both `.dockerignore` present and correct
- [ ] `docker compose up --build` starts all services clean

## Anti-patterns
- Full resource in overlay (patch only what differs)
- `:latest` tags (unpredictable deployments)
- Secrets in ConfigMap (use k8s Secret)
- No resource limits (noisy neighbor)
- Single namespace for all environments
- Inline resources in kustomization.yaml
- Node.js serving Vue in production (use nginx)

## Dispatch
Validate preconditions (spec + validate scripts exist). Read spec §6 — extract `[infra]` ACs + §16 topology as inline context. Invoke `infra-implementation-agent`. Don't duplicate work. Direct edit only for trivial tasks or explicit user request.
