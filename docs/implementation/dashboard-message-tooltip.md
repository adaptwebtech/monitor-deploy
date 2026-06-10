# Dashboard Message Tooltip

> **Status:** stable
> **Spec:** docs/specs/dashboard-message-tooltip.md
> **Frontend:** frontend/src/components/PipelineTable.vue

## 1. Overview

Trunca o campo `commitMessage` na coluna "Mensagem" da tabela de pipelines do dashboard. O texto é cortado com reticências quando excede 220px. O valor completo fica acessível via tooltip nativo do browser (atributo HTML `title`) ao passar o cursor.

## 2. Public API (HTTP)

None — feature puramente frontend; nenhum endpoint novo ou modificado.

## 2b. Frontend pages & components

| Componente | Caminho | Alteração |
|---|---|---|
| `PipelineTable` | `frontend/src/components/PipelineTable.vue` | Célula `commit-message`: texto normalizado por `normalizeCommitMessage()` antes de exibir; `:title` e texto da célula usam o valor normalizado |

**Markup da célula após refactor (strip-merge-pull-request-line):**
```html
<td data-test="commit-message">
  <span
    class="d-inline-block text-truncate"
    style="max-width: 220px"
    :title="normalizeCommitMessage(pipeline.commitMessage)"
    >{{ normalizeCommitMessage(pipeline.commitMessage) }}</span>
</td>
```

**Função auxiliar exportada (refactor 2026-06-10):**
- `stripMergeLine(msg: string): string` — remove a primeira linha quando corresponde ao padrão `Merge pull request #\d+ from .+` e descarta linhas vazias subsequentes. Exportada de `PipelineTable.vue` para permitir testes unitários isolados.
- `normalizeCommitMessage` é o alias interno usado no template (chama `stripMergeLine`).

O dado em store/API (`pipeline.commitMessage`) permanece inalterado; a normalização é estritamente na camada de apresentação.

Nenhum prop, emit, store ou composable novo adicionado.

## 3. Module surface

Exportação nova: `stripMergeLine` (função utilitária) em `frontend/src/components/PipelineTable.vue`.

## 4. System architecture

Alteração isolada — nenhum diagrama de arquitetura necessário.

## 5. Data model

None — nenhuma alteração de schema ou tipo. Campo `commitMessage: string` já presente em `PipelineQueue`.

## 6. DTOs

None.

## 7. Configuration

None.

## 8. Dependencies

- **Bootstrap 5** — classes `d-inline-block`, `text-truncate` (já presente no projeto)
- Nenhuma dependência nova

## 9. Extension points

None.

## 10. Errors

None — sem lógica de negócio ou chamadas HTTP.

## 11. Operational notes

- `title` vazio quando `commitMessage` é `""` ou `undefined` — sem erro.
- Tooltip é nativo do browser (sem JS); comportamento visual pode variar entre browsers.
- Largura máxima `220px` hardcoded no `style` inline; ajustar direto no componente se necessário.

## 12. Spec drift

Alinhado com spec. Nenhuma divergência.

## 13. Changelog

- **2026-05-22** — Feature implementada. `PipelineTable.vue` linha 73: célula `commit-message` agora usa `<span>` com `text-truncate` + `title`. Testes: `PipelineTable.spec.ts` (AC-1, AC-2, AC-3 GREEN).
- **2026-06-10** — Refactor `strip-merge-pull-request-line`. Adicionada função `stripMergeLine(msg)` (exportada) que remove linha de cabeçalho de merge do GitHub antes da exibição. Template atualizado para usar `normalizeCommitMessage(pipeline.commitMessage)` em `:title` e texto da célula. Testes: `PipelineTable.spec.ts` (CHAR-1..CHAR-5 GREEN).
