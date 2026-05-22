# Triage — pipeline-monitor · lint-hotfix

> Branch: hotfix
> Criado: 2026-05-22
> Status: backfill completo

## 1. Sintoma

Lint falha no frontend. Dois erros identificados em `DashboardView.reg.spec.ts`:

1. Linha 67 — `// @ts-ignore` sem descrição, viola a regra `@typescript-eslint/ban-ts-comment` (configurada como `ts-ignore: 'allow-with-description'` no `frontend/eslint.config.mjs`).
2. Linha 49 — uso de `require("../../lib/apiFetch")` em arquivo `.ts`, viola `@typescript-eslint/no-var-requires` presente no preset `tseslint.configs.recommended`.

Nenhum erro encontrado no servidor (nenhum arquivo novo adicionado em `server/src/`).

Stacktrace esperado (lint output):
```
frontend/src/views/__tests__/DashboardView.reg.spec.ts
  67:5  error  Do not use "@ts-ignore" because it alters compilation errors  @typescript-eslint/ban-ts-comment
  49:27 error  Require statement not part of import statement                 @typescript-eslint/no-var-requires
```

## 2. Repro

```bash
cd frontend && npm run lint
```

Saída esperada (pré-fix):
```
frontend/src/views/__tests__/DashboardView.reg.spec.ts
  67:5  error  Do not use "@ts-ignore" because it alters compilation errors  @typescript-eslint/ban-ts-comment
  49:27 error  Require statement not part of import statement                 @typescript-eslint/no-var-requires
✖ 2 problems (2 errors, 0 warnings)
```

Saída após fix: `0 errors, 0 warnings`.

## 3. Root cause

`DashboardView.reg.spec.ts` foi escrito com dois padrões incompatíveis com as regras ESLint ativas no frontend:

- **`require()` em TypeScript (linha 49):** A função `mockApiFetchSuccess` usa `const { apiFetch } = require("../../lib/apiFetch")` em vez do padrão de import dinâmico ou import estático. `tseslint.configs.recommended` proíbe `require()` em arquivos `.ts` via `@typescript-eslint/no-var-requires`.
- **`@ts-ignore` sem descrição (linha 67):** O comentário `// @ts-ignore` na linha 67 não possui uma descrição explicativa. O `frontend/eslint.config.mjs` configura a regra com `{ 'ts-ignore': 'allow-with-description' }`, exigindo que toda supressão tenha um motivo explícito (ex: `// @ts-ignore mock compatibility`).

Todos os outros arquivos de teste que usam `@ts-ignore` já seguem o padrão correto com a descrição `mock compatibility`.

## 4. Scope de arquivos

- `frontend/src/views/__tests__/DashboardView.reg.spec.ts`

## 5. Behavior delta

Nenhuma alteração funcional em runtime. Mudanças restritas ao arquivo de teste `DashboardView.reg.spec.ts`:

- Linha 49: função `mockApiFetchSuccess` (contendo `require()`) foi removida. A função não era referenciada em nenhum teste do arquivo — remoção sem impacto em cobertura.
- Linha 67: `// @ts-ignore` → `// @ts-ignore mock compatibility`. Comportamento de supressão de erro TypeScript preservado; agora conforme com a regra `allow-with-description`.

Todos os outros arquivos de teste que usam `@ts-ignore` já continham a descrição `mock compatibility` — padrão agora consistente em toda a suite.

## 6. Risco / blast radius

**Risco: mínimo.**

- Escopo restrito a um único arquivo de teste (`DashboardView.reg.spec.ts`).
- Nenhum código de produção alterado.
- A função removida (`mockApiFetchSuccess`) era dead code — zero referências no arquivo.
- O `@ts-ignore` não foi removido, apenas ganhou descrição — comportamento de compilação inalterado.
- Nenhum arquivo `server/` tocado.
- Pipeline de CI desbloqueado após fix.

## 7. Plano de teste

N/A — hotfix backfill

---

## Retrospectiva do incidente

**Detecção:** Erro identificado durante pipeline de fix do branch `hotfix` ao executar `npm run lint` no frontend. Nenhum alerta automático — detecção manual durante revisão do código de teste gerado para a feature `ws-completion`.

**Mitigação:** Fix aplicado no mesmo branch (`hotfix`); lint GREEN confirmado; pipeline de CI desbloqueado sem necessidade de rollback.

**Lições:**
- Arquivos de teste REG devem passar por `npm run lint` antes do commit, assim como o código de produção.
- `require()` em arquivos `.ts` deve ser evitado mesmo em contexto de teste — usar `vi.mock()` / `vi.importMock()` do Vitest ou imports estáticos.
- `@ts-ignore` sem descrição deve ser bloqueado na revisão de código; a regra `allow-with-description` já está configurada mas não foi respeitada na geração inicial do arquivo.
