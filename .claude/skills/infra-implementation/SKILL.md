---
name: infra-implementation
description: Use this skill whenever the user wants to implement, write, or update k8s + kustomize manifests, Dockerfiles, or docker-compose for the project. Covers base manifests, environment overlays, kustomization.yaml structure, patches, image tagging, namespaces, multi-stage Dockerfiles, and docker-compose setup. Modeled on kustomize overlay patterns from production deployments. Triggers on phrases like "write the k8s manifests", "create the deployment", "set up the overlays", "implement the infra", "configure kustomize", "make the infra tests pass", "write the Dockerfile", "update docker-compose", "dockerize the app", or "add Docker support". This is phase 3 of a spec → test → code → doc workflow for the infra layer.
---

# Infra Implementation — k8s + Kustomize

## 🔒 REGRA ABSOLUTA — Mapa é fonte única

`docs/CODEBASE.md` **já está no contexto** (injetado por hook PreToolUse). Cobre tudo: §1/§8 estrutura `k8s/` (base + overlays) + feature → arquivos infra, §5 env vars (ConfigMap), §11 convenções k8s (naming numérico, image tags, namespaces, resources/limits), **§12 skeletons canônicos (Deployment base, Service base, overlay patch)**, §13 ponteiros para `docs/implementation/<feature>.md`.

### PROIBIDO
- `grep`, `find`, `ls` para "onde está manifest X" ou "como outro deployment fez Y".
- `Explore`, `Agent` (qualquer subagent de descoberta) para localizar manifests, resources ou patterns.
- `Read` em `k8s/` **para inspiração de pattern existente** — use §12.

### PERMITIDO
- `Read` em `docs/specs/<feature>.md` e `docs/implementation/<feature>.md` (sob demanda, só o relevante).
- `Read`/`Edit`/`Write` no manifest que você está editando agora.
- `grep`/`find` apenas para detalhe não coberto pelo mapa nem pelos docs de implementação.

Se §12/§10/§13 não cobrirem seu caso, **pare e avise o usuário**. Não invente, não greppe.

Mapa desatualizado → pare e avise antes de prosseguir.

---

## Overlay structure philosophy

Base = canonical, complete resource definition. Overlays = surgical patches for environment differences. Never duplicate full resource in overlay — patch only what changes.

## Base kustomization.yaml

```yaml
# k8s/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - 00-postgres-pv.yaml
  - 01-redis-pv.yaml
  - 10-postgres-pvc.yaml
  - 11-redis-pvc.yaml
  - 20-env-configmap.yaml
  - 21-docker-registry-secret.yaml
  - 30-postgres-deployment.yaml
  - 31-redis-deployment.yaml
  - 32-api-deployment.yaml
  - 33-vue-deployment.yaml
  - 40-postgres-service.yaml
  - 41-redis-service.yaml
  - 42-api-service.yaml
  - 43-vue-service.yaml
```

## Base resource templates (write these for every project)

**32-api-deployment.yaml**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 1
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      imagePullSecrets:
        - name: registry-secret
      containers:
        - name: api
          image: registry.example.com/monitor-deploy/api:latest
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef:
                name: env
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

**vue-deployment.yaml**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vue-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: vue-app
  template:
    metadata:
      labels:
        app: vue-app
    spec:
      imagePullSecrets:
        - name: registry-secret
      containers:
        - name: vue-app
          image: registry.example.com/monitor-deploy/vue-app:latest
          ports:
            - containerPort: 80
          resources:
            requests:
              memory: "64Mi"
              cpu: "50m"
            limits:
              memory: "128Mi"
              cpu: "200m"
```

**postgres-deployment.yaml**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
          envFrom:
            - configMapRef:
                name: env
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
      volumes:
        - name: postgres-data
          persistentVolumeClaim:
            claimName: postgres-data-pvc
```

**env-configmap.yaml** (base — values overridden per overlay):

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: env
data:
  NODE_ENV: "production"
  PORT: "3000"
  DATABASE_URL: "postgresql://postgres:password@postgres:5432/monitor_deploy"
  REDIS_URL: "redis://redis:6379"
```

## Overlay kustomization.yaml pattern

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
  - name: registry.example.com/monitor-deploy/vue-app
    newTag: development

patches:
  - path: env-patch.configmap.yaml
    target:
      kind: ConfigMap
      name: env
  - path: api-deployment-patch.yaml
    target:
      kind: Deployment
      name: api
```

## namespace.yaml

```yaml
# k8s/overlays/development/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: monitor-deploy-dev
```

## ConfigMap patch (env vars differ per environment)

```yaml
# k8s/overlays/development/env-patch.configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: env
data:
  NODE_ENV: "development"
  DATABASE_URL: "postgresql://postgres:devpassword@postgres:5432/monitor_deploy_dev"
  LOG_LEVEL: "debug"
```

## Deployment patch (replicas, resource limits differ per environment)

```yaml
# k8s/overlays/production/api-deployment-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: api
          resources:
            requests:
              memory: "256Mi"
              cpu: "200m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
```

## Image tag strategy

| Environment | Tag format | Example |
|---|---|---|
| development | branch/env name | `development` |
| staging | branch/env name | `staging` |
| production | Git SHA (40 chars) | `a1b2c3d4...` |

Production always uses immutable SHA tag. Never `:latest` in any environment.

## PV/PVC patterns (storage per environment)

```yaml
# k8s/base/00-postgres-pv.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: postgres-data-pv
spec:
  capacity:
    storage: 5Gi
  accessModes:
    - ReadWriteOnce
  hostPath:
    path: /data/postgres

---
# k8s/base/10-postgres-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
```

For production, patch storage path and size:

```yaml
# k8s/overlays/production/postgres-pv-patch.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: postgres-data-pv
spec:
  capacity:
    storage: 50Gi
  hostPath:
    path: /data/prod/postgres
```

## Order of writing manifests

1. `k8s/base/kustomization.yaml` — list of resources (file refs only, no inline)
2. Base ConfigMap + Secrets (`20-env-configmap.yaml`, `21-docker-registry-secret.yaml`) — with placeholder values
3. Base PVs (`00-*-pv.yaml`) — storage volumes
4. Base PVCs (`10-*-pvc.yaml`) — storage claims
5. Base Deployments (`30-*-deployment.yaml`, `32-*-deployment.yaml`, `33-*-deployment.yaml`) — canonical resource shape
6. Base Services (`40-*-service.yaml`, etc.) — service definitions
5. `k8s/overlays/development/` — first overlay (closest to dev reality)
6. `k8s/overlays/staging/` and `k8s/overlays/production/`
7. Run validate scripts after each environment overlay

After each step: `minikube kubectl -- kustomize k8s/base/ | minikube kubectl -- apply --dry-run=server -f -`

## What good looks like (checklist)

- [ ] `minikube kubectl -- kustomize k8s/base/` exits 0
- [ ] `minikube kubectl -- kustomize k8s/overlays/development/` exits 0
- [ ] All overlays dry-run validate: validate-overlays.sh passes
- [ ] Smoke test: all pods reach Running in minikube
- [ ] No `:latest` image tags anywhere
- [ ] Every environment has own namespace
- [ ] Resource requests + limits set on every container
- [ ] Sensitive values NOT in ConfigMap — only in Secrets (registry-secret etc.)
- [ ] Production uses SHA image tags

## Anti-patterns to avoid

- **Full resource duplication in overlay.** Patch only what differs. Copy-paste full Deployment = drift nightmare.
- **`:latest` tags.** Unpredictable. Every environment should pin a tag.
- **Hardcoded secrets in ConfigMap.** DATABASE_URL with password = exposure. Use Secrets or external secrets operator.
- **No resource limits.** Containers without limits = noisy neighbor problem on cluster.
- **Single namespace for all environments.** Always separate namespaces. Test cleanup from prod = data loss.
- **Inline resources in kustomization.yaml.** Always separate YAML files — easier to patch, diff, and review.

## Docker / docker-compose

Docker is part of infra. Manage `docker-compose.yml` and both `Dockerfile`s here alongside k8s manifests.

### docker-compose.yml (project root)

Lives at repo root. Create or update whenever any service, env var, port, or volume changes — never leave stale.

Rules:
- Services: `api`, `vue`, `postgres`, `redis`
- Health checks on `postgres` and `redis` — `api` must depend on them with `condition: service_healthy`
- Named volumes for DB data — never anonymous volumes
- Env vars via `.env` file at root — never hardcode secrets inline in compose file
- `vue` service proxies `/api/` → `api:3000` via nginx (configured in `frontend/nginx.conf`)

```yaml
# docker-compose.yml
services:
  api:
    build: ./server
    ports: ["3000:3000"]
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

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

### server/Dockerfile (multi-stage, optimized)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
USER app
EXPOSE 3000
CMD ["node", "dist/main"]
```

### frontend/Dockerfile (multi-stage, nginx runner)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### frontend/nginx.conf (required)

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    proxy_pass http://api:3000/;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### Rules

- Layer order always: `COPY package*.json` → `npm ci` → `COPY source` → build. Never `COPY . .` before `npm ci`.
- Base images: `node:20-alpine` for Node stages, `nginx:alpine` for Vue runner. Never `:latest`.
- Non-root user in backend `runner` stage: `USER app`. Nginx uses its default unprivileged user.
- `.dockerignore` required in both `frontend/` and `server/`. Exclude: `node_modules`, `dist`, `.env*`, test files (`**/*.spec.*`, `test/`).
- New env var added to backend or frontend → update `docker-compose.yml` in the same commit.
- Never serve Vue build with Node in production — nginx runner only.

### What good looks like (Docker checklist)

- [ ] `docker-compose.yml` at root exists and reflects current services/env vars
- [ ] `server/Dockerfile` uses multi-stage build (`builder` → `runner`) with non-root user
- [ ] `frontend/Dockerfile` uses multi-stage build with nginx runner (not Node)
- [ ] `frontend/nginx.conf` present and proxies `/api/` → `api:3000`
- [ ] `server/.dockerignore` and `frontend/.dockerignore` present and correct
- [ ] New env vars added to `docker-compose.yml` env_file or environment section in same commit
- [ ] `docker compose up --build` starts all services without errors
