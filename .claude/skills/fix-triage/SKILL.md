---
name: fix-triage
description: Internal fix-pipeline phase-1 skill. Dispatched by fix-router. Do not invoke directly — use /fix or /hotfix.
---

# fix-triage (Phase 1 — triage doc, interativa)

## 🔒 REGRA ABSOLUTA — Mapa é fonte única

CODEBASE.md injetado por hook. Triage é read-only para `src/`. Exceção registrada em `.claude/CLAUDE.md`: `Read` direcionado em arquivos exatos citados no stacktrace OU listados em §8/§10 do mapa para a feature alvo.

### PROIBIDO
- `Grep`/`Glob`/`find` em `server/src`, `frontend/src`, `k8s/base|overlays` para varredura ampla.
- Especular root cause sem ler arquivo correspondente.
- Listar mais arquivos em §4 do que evidência justifica.
- Avançar para fase 2 sem revisão do usuário (em simple-fix/refactor).

### PERMITIDO
- `Read` em stacktrace files (max 3).
- `Read` em §8/§10 do mapa para feature.
- `Read` em `docs/specs/<feature>.md` e `docs/implementation/<feature>.md`.
- `AskUserQuestion` livremente — esta é fase interativa.
- `Write` em `docs/fixes/<feature>-<slug>.md`.
- `Write` em `.claude/state/fix-current.txt`.

---

## Pré-condição

`.claude/state/fix-mode.txt ∈ {simple-fix, refactor, hotfix}`. Se `none` → aborte; rode `fix-router` primeiro.

## Modos de execução

### simple-fix / refactor → **MAIN THREAD, INTERATIVA**

A skill roda inline na main thread igual `fullstack-spec-mermaid`. Pergunta ao usuário até as 7 seções fecharem. Não despacha subagent.

### hotfix → **SUBAGENT** `fix-triage-agent`

Urgência > rigor. Despacha `fix-triage-agent` que escreve stub sem Q&A (§1/§3/§4 obrigatórios, demais TODO). Backfill na Phase 4 obrigatório.

## Output location

`docs/fixes/<feature>-<slug>.md`

- `<feature>`: nome exato de §8 do mapa.
- `<slug>`: kebab-case curto descrevendo o defeito (ex.: `stale-cache`, `null-on-logout`).

## Estrutura obrigatória (7 seções)

```markdown
# Triage — <feature> · <slug>

> Branch: <simple-fix|refactor|hotfix>
> Criado: YYYY-MM-DD

## 1. Sintoma
<descrição reproduzível, com stacktrace literal se fornecido>

## 2. Repro
<passos numerados; refactor: "N/A — refactor não muda comportamento">

## 3. Root cause
<análise técnica baseada em evidência lida — arquivo, função, linha, invariante quebrada>

## 4. Scope de arquivos
<lista markdown de paths exatos a serem editados>

- server/src/<feature>/<file>.ts
- frontend/src/<feature>/<file>.vue

## 5. Behavior delta
<antes vs depois; refactor: "Nenhuma">

## 6. Risco / blast radius
<features adjacentes, dados em produção, migrations, endpoints públicos afetados>

## 7. Plano de teste
- REG-1: <descrição>     ← simple-fix
- CHAR-1: <descrição>    ← refactor
- "N/A — hotfix backfill" ← hotfix stub
```

## Workflow interativo (simple-fix / refactor)

1. **Coletar input inicial**: feature, sintoma (texto livre), stacktrace se houver.

2. **Identificar feature em §8 do mapa**. Se ausente → aborte.

3. **Leitura direcionada**:
   - `Read` `docs/specs/<feature>.md` (FRs/ACs vigentes).
   - `Read` `docs/implementation/<feature>.md` (comportamento real).
   - `Read` arquivos exatos do stacktrace (max 3).
   - `Read` arquivos do mapa §10 cujo símbolo é citado no sintoma.

4. **Q&A rodada 1 — Sintoma & repro** (use `AskUserQuestion`):
   - Confirmar passos de repro (ambiente, payload, role, env vars relevantes).
   - Esperado vs observado.
   - Ocorrência: sempre / às vezes / regressão recente.

5. **Q&A rodada 2 — Root cause** (após análise do código lido):
   - Apresentar hipótese de root cause baseada em evidência.
   - Pedir confirmação ou contraprova.
   - Se múltiplas hipóteses → listar e pedir usuário escolher / fornecer info para discriminar.

6. **Q&A rodada 3 — Scope & risco**:
   - Confirmar §4 (lista de arquivos editáveis).
   - Levantar §6 (features adjacentes, dados de prod, migrations).
   - Confirmar §5 (behavior delta) com o usuário.

7. **Compor §7 plano de teste**:
   - simple-fix: listar REG-1..N que provam o fix (1 por AC/cenário afetado).
   - refactor: listar CHAR-1..N que congelam comportamento atual.

8. **`Write`** `docs/fixes/<feature>-<slug>.md` com as 7 seções fechadas.

9. **`Write`** slug em `.claude/state/fix-current.txt`.

10. **Apresentar resumo** ao usuário:
    ```
    TRIAGE_DOC: docs/fixes/<feature>-<slug>.md
    ROOT_CAUSE: <1 frase>
    SCOPE: <N> arquivos
    BEHAVIOR_DELTA: <1 frase>
    RISCO: <baixo|médio|alto>
    ```
    Esperar aprovação se `autonomy=pause`.

## Workflow hotfix (subagent)

1. Validar pré-condição.
2. Invocar `fix-triage-agent` via Agent tool passando: branch=hotfix, feature, sintoma+stacktrace.
3. Agent escreve stub (§1, §3, §4 + banner ⚠ HOTFIX).
4. Apresentar e seguir para fix-implementation (Phase 2 é pulada).

## Doutrina de pushback

Triage interativa **não é interrogatório passivo**. Empurre de volta quando o input do usuário é vago, contraditório, ou esconde escopo. Pushback economiza tempo: um desafio direto vale 5 perguntas educadas.

**Pushback obrigatório quando:**

| Input do usuário | Pushback |
|---|---|
| "Corrige isso" / "está bugado" sem repro | "Sem passos de repro não há triage. Liste: ambiente, payload, role, último estado conhecido funcionando." |
| Stacktrace genérico ("erro 500") | "500 é sintoma, não causa. Logs do servidor? Request payload? Resposta do banco?" |
| "Refatora pra ficar mais limpo" | "Refactor exige objetivo mensurável. Qual símbolo, qual smell, qual métrica (acoplamento, duplicação)? Senão é gold-plating." |
| "Igual ao último fix" | "Pull o changelog. Reapliquei mecânica sem confirmar é como introduzir o mesmo bug em forma nova." |
| §4 cresce além de 5 arquivos | "Scope grande indica root cause mal isolado OU fix está virando refactor. Particionar em fixes menores." |
| Usuário sugere fix antes do root cause | "Fix proposto antes de §3 fechada. Risco: tratar sintoma sem causa. Voltemos para §3." |
| "Não precisa de REG, é simples" | "Sem REG não há gate de regressão. Se for trivial demais para teste, é trivial demais para fix dedicado." |
| Pede para mudar contrato público "rapidinho" | "Mudança em DTO/rota/prop/env não é fix — é breaking change. Re-route via fullstack-spec-mermaid ou versione." |

**Como pushback se manifesta no Q&A:**

- ❌ "Pode me dizer qual é o sintoma?" (passivo)
- ✅ "Sintoma descrito está em nível de UI. Quero a exceção crua ou o log de servidor. Cole aqui." (direto, pede artefato)

- ❌ "Você acha que pode ser X ou Y?"
- ✅ "Vejo duas causas plausíveis lendo `<arquivo>:42` e `<arquivo>:99`. (A) X porque <evidência>. (B) Y porque <evidência>. Qual reproduz no seu ambiente? Se nenhuma, falta info."

- ❌ "Você quer que eu inclua o arquivo Z?"
- ✅ "Z não está coberto pelo §3 atual. Incluir Z exige justificativa: qual sintoma só passa tocando Z?"

**Quando NÃO fazer pushback:**

- Usuário trouxe stacktrace completo + repro reproduzível → suficiente, prossiga.
- Pergunta é genuinamente ambígua só pra quem não conhece o domínio (ex.: "rate limit per-user ou per-IP?") — Q normal.
- Hotfix (subagent path): sem pushback, escreve stub.

**Pushback educado, não hostil.** Objetivo: forçar o usuário a entregar artefato concreto, não desafiar competência.

## Quando perguntar (regra prática)

| Sinal | Pergunte |
|---|---|
| Stacktrace sem linha exata | Versão / branch / commit em que reproduziu |
| Múltiplos arquivos plausíveis | Qual rota / fluxo gatilha o bug |
| Refactor de symbol usado em N lugares | Quais call sites estão no escopo desta rodada |
| Schema mudaria | Há dados em prod? Migration zero-downtime necessária? |
| Endpoint público afetaria contrato | Versionar a rota ou breaking change aceito? |

## Anti-patterns

- ❌ Pular Q&A em simple-fix/refactor "porque o sintoma parece claro" — usuário tem contexto que você não tem.
- ❌ Fazer 10 perguntas de uma vez (use rodadas de 1-3 perguntas focadas).
- ❌ Triage sem stacktrace E sem leitura de código — root cause vira chute.
- ❌ §4 listando "todo o módulo" — força scope-lock inútil.
- ❌ Despachar subagent em simple-fix/refactor (perde Q&A loop).
- ❌ Esquecer de gravar slug em `state/fix-current.txt` (gate F4 não funciona).

## Hand-off para fase 2

Triage doc deve conter §7 com IDs (REG-1, REG-2, … ou CHAR-1, CHAR-2, …) que `fix-regression-testing` vai materializar 1:1.
