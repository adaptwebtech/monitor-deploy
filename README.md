# Pipeline Monitor

Plataforma de monitoramento em tempo real de pipelines de deploy gerados pelo Argo CI/CD. Recebe webhooks, persiste histórico e exibe dashboard reativo via WebSocket.

## Stack

- **Backend:** NestJS 11 · Prisma 7 · PostgreSQL · Socket.IO · JWT
- **Frontend:** Vue 3 · Pinia · Vue Router 4 · Bootstrap 5 · Socket.IO Client
- **Infra:** Docker multi-stage · Kubernetes/Kustomize · docker-compose

## Início Rápido

```bash
# Clonar e subir ambiente local
cp server/.env.example server/.env   # ajustar DATABASE_URL, JWT secrets, API_KEY
docker compose up --build

# API disponível em: http://localhost:3000
# Frontend em:       http://localhost:9065
# Swagger em:        http://localhost:3000/docs
```

## Variáveis de Ambiente (`.env`)

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL (localhost para CLI, `postgres` para Docker) |
| `JWT_ACCESS_SECRET` | Secret para assinar access tokens (15 min) |
| `JWT_REFRESH_SECRET` | Secret para assinar refresh tokens (sem expiração) |
| `API_KEY` | Chave de autenticação do webhook (base64) |
| `PORT` | Porta da API (default: 3000) |

## Documentação

| Feature | Spec | Implementação |
|---|---|---|
| Pipeline Monitor | [docs/specs/pipeline-monitor.md](docs/specs/pipeline-monitor.md) | [docs/implementation/pipeline-monitor.md](docs/implementation/pipeline-monitor.md) |
| Botão de Logout | [docs/specs/logout-button.md](docs/specs/logout-button.md) | [docs/implementation/logout-button.md](docs/implementation/logout-button.md) |
| Health Route | [docs/specs/health.md](docs/specs/health.md) | [docs/implementation/health.md](docs/implementation/health.md) |
| Workflow Timeout | [docs/specs/workflow-timeout.md](docs/specs/workflow-timeout.md) | [docs/implementation/workflow-timeout.md](docs/implementation/workflow-timeout.md) |

**Mapa do codebase:** [docs/CODEBASE.md](docs/CODEBASE.md)

## Estrutura

```
server/     # NestJS API
frontend/   # Vue 3 SPA
k8s/        # Manifests Kubernetes (base + overlays dev/staging/prod)
docs/       # Specs e documentação de implementação
```

## Deploy K8s

```bash
# Validar (dry-run)
minikube kubectl -- kustomize k8s/overlays/production | minikube kubectl -- apply --dry-run=server -f -

# Aplicar
minikube kubectl -- kustomize k8s/overlays/production | minikube kubectl -- apply -f -
```
