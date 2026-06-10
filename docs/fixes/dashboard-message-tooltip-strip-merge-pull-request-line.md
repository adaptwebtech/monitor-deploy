# Triage — dashboard-message-tooltip · strip-merge-pull-request-line

> Branch: refactor
> Criado: 2026-06-10

## 1. Sintoma

A coluna "Mensagem" no `PipelineTable.vue` exibe `pipeline.commitMessage` bruto. Quando o commit é um merge de PR gerado pelo GitHub, a mensagem segue o padrão:

```
Merge pull request #N from repo/branch

<mensagem real do PR>
```

O texto truncado e o atributo `title` do tooltip exibem a primeira linha (`Merge pull request #N from repo/branch`) em vez da mensagem real, tornando a coluna pouco informativa para o usuário.

## 2. Repro

N/A — refactor não muda comportamento

## 3. Root cause

Em `frontend/src/components/PipelineTable.vue` linhas 103–108, o template usa `pipeline.commitMessage` diretamente, sem qualquer transformação:

```vue
<span
  class="d-inline-block text-truncate"
  style="max-width: 220px"
  :title="pipeline.commitMessage"
>{{ pipeline.commitMessage }}</span>
```

Não existe função auxiliar nem computed property que normalize a mensagem antes da renderização. O dado bruto vindo do store/API inclui a linha de cabeçalho do merge gerada automaticamente pelo GitHub. A ausência de um filtro de normalização faz com que essa linha seja exibida tanto no texto truncado quanto no `title` do tooltip.

A invariante quebrada é: *o campo exibido ao usuário deve representar a intenção do commit, não metadados internos do Git/GitHub*.

## 4. Scope de arquivos

- `frontend/src/components/PipelineTable.vue`
- `frontend/src/components/__tests__/PipelineTable.spec.ts`

## 5. Behavior delta

Nenhuma — comportamento idêntico, apenas restruturação interna

> Precisão: o dado em store/API (`pipeline.commitMessage`) permanece inalterado. Apenas a camada de apresentação aplica a normalização via função auxiliar `stripMergeLine(msg: string): string`, que remove a primeira linha quando ela corresponde ao padrão `Merge pull request #\d+ from .+` e descarta linhas vazias subsequentes.

## 6. Risco / blast radius

Baixo. A mudança é estritamente frontend, confinada ao componente `PipelineTable.vue` e ao seu arquivo de testes. Nenhum endpoint público, nenhuma migration, nenhum dado em store ou API é alterado. Features adjacentes (`pipeline-monitor`, `dashboard-status`, colunas de avatar/status) não são afetadas.

## 7. Plano de teste

- CHAR-1: Verificar que `stripMergeLine` com mensagem de merge padrão do GitHub (`"Merge pull request #42 from org/branch\n\nmensagem real"`) retorna apenas `"mensagem real"`.
- CHAR-2: Verificar que `stripMergeLine` com mensagem simples (sem linha de merge) retorna a mensagem inalterada.
- CHAR-3: Verificar que `stripMergeLine` com string vazia retorna string vazia sem lançar erro.
- CHAR-4: Verificar que o atributo `title` do span em `[data-test="commit-message"]` usa o valor normalizado quando a mensagem é um merge de PR.
- CHAR-5: Verificar que o texto renderizado no span também usa o valor normalizado (não exibe a linha `Merge pull request`).
