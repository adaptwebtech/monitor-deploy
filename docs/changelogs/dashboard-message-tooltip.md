# Changelog — dashboard-message-tooltip

## 2026-06-10 · refactor · strip-merge-pull-request-line
- Sintoma: Coluna "Mensagem" exibia a linha `Merge pull request #N from repo/branch` em vez da mensagem real do PR tanto no texto truncado quanto no tooltip
- Root cause: `PipelineTable.vue` usava `pipeline.commitMessage` bruto no template, sem filtro de normalização, expondo o cabeçalho de merge gerado automaticamente pelo GitHub
- Fix: Adicionada função exportada `stripMergeLine(msg: string): string` que remove a linha de cabeçalho de merge e linhas vazias subsequentes; template atualizado para usar `normalizeCommitMessage(pipeline.commitMessage)` em `:title` e no texto da célula `commit-message`
- Arquivos: `frontend/src/components/PipelineTable.vue`, `frontend/src/components/__tests__/PipelineTable.spec.ts`
- REG: CHAR-1, CHAR-2, CHAR-3, CHAR-4, CHAR-5
- Triage: docs/fixes/dashboard-message-tooltip-strip-merge-pull-request-line.md
