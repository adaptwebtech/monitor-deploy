# Triage — pipeline-monitor · dockerfile-lint-fix

> Branch: hotfix
> Criado: 2026-05-22
> ✅ Hotfix aplicado em 2026-05-22. REG inline N/A (Dockerfile change). Backfill completo em Phase 4.

## 1. Sintoma

Erros de lint auto-corrigíveis não são resolvidos durante o Docker build. O processo atual executa `npm run lint` (server) e `npx eslint "src/**/*.{ts,vue}"` (frontend) no estágio builder apenas para validação — falha caso haja violações auto-fixáveis que poderiam ter sido corrigidas em tempo de build, sem oportunidade de aplicar `--fix` antes da verificação.

## 2. Repro

TODO — backfill em Phase 4

## 3. Root cause

Em ambos os Dockerfiles, o estágio `builder` executa lint apenas como gate de qualidade (sem `--fix`), o que rejeita o build quando existem violações auto-corrigíveis. O `--fix` nunca é invocado, portanto erros corrigíveis automaticamente pelo ESLint bloqueiam o build desnecessariamente.

- **`server/Dockerfile` linha 7:** `RUN npm run lint && npm run test` — lint sem `--fix`; o script `npm run lint` mapeia para ESLint sem flag `--fix`.
- **`frontend/Dockerfile` linha 6:** `RUN npx eslint "src/**/*.{ts,vue}" && npm run test:unit` — invocação ESLint direta sem `--fix`.

O patch correto é inserir um passo `--fix` **antes** da execução de lint, ainda no estágio `builder`, após o `COPY . .` e antes do lint-gate existente. Isso garante que correções automáticas são aplicadas na camada do build sem alterar o comportamento runtime.

## 4. Scope de arquivos

- server/Dockerfile
- frontend/Dockerfile

## 5. Behavior delta

TODO — backfill em Phase 4

## 6. Risco / blast radius

TODO — backfill em Phase 4

## 7. Plano de teste

N/A — hotfix backfill

---

## Patch exato

### server/Dockerfile

Linha atual (7):
```
RUN npm run lint && npm run test
```

Substituir por:
```
RUN npm run lint -- --fix || true
RUN npm run lint && npm run test
```

> O `|| true` garante que o passo `--fix` não falhe o build caso não haja arquivos alterados ou em casos onde `--fix` retorna exit code não-zero mesmo após corrigir. O lint-gate subsequente ainda bloqueia violações não-corrigíveis.

### frontend/Dockerfile

Linha atual (6):
```
RUN npx eslint "src/**/*.{ts,vue}" && npm run test:unit
```

Substituir por:
```
RUN npx eslint "src/**/*.{ts,vue}" --fix || true
RUN npx eslint "src/**/*.{ts,vue}" && npm run test:unit
```

> Mesma lógica: `--fix` aplica correções automáticas; o lint-gate original permanece como verificação final.
