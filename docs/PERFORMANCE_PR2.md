# Performance PR2

Segunda etapa da auditoria (`docs/PERFORMANCE_AUDIT.md`), focada em PostgreSQL, API e escalabilidade. Nenhuma melhoria da PR1 foi revertida.

## Resumo

| Frente | Antes | Depois | Evidência |
| --- | --- | --- | --- |
| Dashboard (KPIs) | 12 requests / 12 queries / 412.932 bytes | 1 request / 4 queries em paralelo / 401 bytes | medição local + validação numérica |
| Latência do dashboard sob concorrência | p50 537 ms (10) / 700 ms (25) | p50 90 ms (10) / 113 ms (25) | benchmark local de fluxo |
| Busca da home | catálogo inteiro (549 linhas / 42.917 bytes) | filtro no banco + LIMIT (1 linha / 72 bytes no termo testado) | medição local + EXPLAIN |
| Filtros não-sargáveis | `TRIM(pvconfirmado)`, `LOWER(prodes) LIKE` | comparação direta em colunas `bpchar` + `ILIKE` | EXPLAIN com `enable_seqscan=off` |
| Índices | sem trigram em `pro.des`/`modelo.moddes` | GIN trigram (200 kB + 64 kB) | `pg_indexes` + EXPLAIN |
| Mais vendidos/devoluções | agregação com `TRIM` sobre histórico | mesma regra, predicados sargáveis | EXPLAIN |
| Validação de KPIs | — | 12/12 valores idênticos aos endpoints antigos | script de comparação |
| Testes | — | `npm test` 15/15, `test:pr1` 19/19, `test:pr2` 12/12 | execução local |

O que **não** foi alterado: regra de janela dos "mais vendidos" (não existe definição de negócio), paginação de pedidos, relatórios/PDF/XLS, pool, transações, cache de listas, assets do frontend e Service Worker. Tudo registrado em "Melhorias futuras".

## Ambiente e método

- **PostgreSQL 10.23** (Ubuntu), `shared_buffers=128MB`, `work_mem=4MB`, `effective_cache_size=4GB`, `max_connections=100`, `random_page_cost=4`, `maintenance_work_mem=64MB`, `max_worker_processes=8`.
- **Base de desenvolvimento** (não é produção):

| Tabela | Linhas | Tabela | Linhas |
| --- | ---: | --- | ---: |
| mun | 5.564 | pv | 412 |
| pro | 2.239 | cli_mov | 9 |
| promod | 2.201 | part_group_items | 6 |
| pvi | 738 | part_groups | 6 |
| procor | 602 | cli_cobranca | 6 |
| modelo | 549 | cli / par | 3 |
| cores | 76 | devolucoes / devolucao_itens | 0 |
| marcas | 55 | home_showcases | 3 |
| tipo | 21 | home_showcase_items | 0 |

- Hardware do servidor de banco: **NÃO MEDIDO**.
- Planos obtidos com `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` via pool `pg`, somente leitura. Latências de HTTP medidas com `curl` em servidor local (porta 3100) e token de admin, contra o banco de desenvolvimento. Benchmark de concorrência com `fetch` concorrente (sem `autocannon`/`k6` instalados).
- **Aviso:** os tempos refletem uma base pequena. Os ganhos de payload/requests são estruturais; os ganhos de tempo das queries só se materializam com volume. Nenhum resultado aqui deve ser lido como produção.

## Queries analisadas

| # | Query / fluxo | arquivo | Plano antes (dados dev) | Situação |
| --- | --- | --- | --- | --- |
| 1 | 5 counts de pedidos "hoje" (dashboard) | `pedidosController.js` | 5× Index Scan (`idx_pv_dtcad`/`idx_pv_canal`), 0,006–0,044 ms | otimizada (agregada) |
| 2 | `totalProdutoEmFalta` + `totalProdutoAcabando` | `proController.js` | 2× Seq Scan em `pro` (2,37 + 1,28 ms) | otimizada (1 scan) |
| 3 | `proComEstoque` / `proSemEstoque` (listas p/ KPI) | `proController.js` | joins com `marcas`/`tipo` desnecessários + `string_agg` correlacionado por linha; payload 34.607 + 375.681 bytes | otimizada (counts) |
| 4 | `proModels.listarTodosProdutos` | `proModels.js` | SubPlan `string_agg` 2.556 loops; 35,1 ms; buffers hit 15.259 | analisada, **não alterada** |
| 5 | `vw_modelos` (busca da home) | `modeloController.js` | Seq Scan + Sort 549 linhas, 2,99 ms; 42.917 bytes | otimizada (server-side) |
| 6 | `listarMaisVendidos` | `showcaseModels.js` | CTEs agregam histórico; `TRIM` nas colunas de status | predicados otimizados; janela mantida |
| 7 | `buscarItensVendidos` | `devolucoesController.js` | CTEs agregam todo `pvi`/`devolucoes` + `TRIM` | predicados otimizados; estrutura mantida |
| 8 | `cliController.list` | `cliController.js` | 2 subqueries correlacionadas por linha + `regexp_replace` | analisada, **não alterada** |
| 9 | `listarPvConfirmados`/`listarPvPendentes` | `pedidosController.js` | 61 linhas, 0,92 ms, sem LIMIT | analisada, **não alterada** (paginação) |
| 10 | `relatoriosModels.getPecasCadastradas` | `relatoriosModels.js` | Seq Scan + Sort 2.169 linhas, 9,2 ms; `LOWER(...) LIKE` | predicado otimizado (`ILIKE`) |
| 11 | `getTopPecas` | `relatoriosModels.js` | 27 linhas, 1,9 ms | analisada, sem gargalo na base dev |

## Queries otimizadas

### 1. Dashboard — counts de pedidos agregados
- **Arquivo/função:** `src/controllers/dashboardController.js` (`resumo`).
- **Antes:** 5 endpoints separados, cada um com `Index Scan` filtrando `pvconfirmado`/`pvsta`/`pvcanal` + `pvdtcad = CURRENT_DATE`.
- **Problema:** 5 idas ao banco por abertura de dashboard, além de 7 outras chamadas.
- **Solução:** 1 query com `COUNT(*) FILTER (WHERE ...)`.
- **Plano depois:** `Aggregate` sobre `Seq Scan on pv` (412 linhas).
- **Métricas:** Planning 0,395 ms; Execution 0,466 ms; Buffers hit=6; requests 5→1.

### 2. Dashboard — em falta + acabando
- **Arquivo/função:** `src/controllers/dashboardController.js` (`resumo`); flags em `src/utils/estoqueFlagsSql.js`.
- **Antes:** 2 queries com 2 Seq Scans (uma por flag, cada uma avaliando `CASE`/`TRIM` por linha).
- **Solução:** 1 Seq Scan com 2 `COUNT(*) FILTER`.
- **Métricas:** Antes 2,37 ms + 1,28 ms (2 scans); depois Planning 0,347 ms / Execution 3,112 ms / Buffers hit=60 (1 scan). Valores idênticos (1997 e 4).

### 3. Dashboard — contagens de estoque (com/sem)
- **Arquivo/função:** `src/controllers/dashboardController.js` (`resumo`).
- **Antes:** dashboard baixava as listas completas de `/proComEstoque` e `/proSemEstoque` (34.607 + 375.681 bytes) com `string_agg` correlacionado por linha, apenas para usar `.length`.
- **Solução:** contagem direta por `FILTER` sem os joins de `marcas`/`tipo` (que não filtravam nada) e sem `string_agg`; top 5 marcas via `json_agg` agregado.
- **Plano depois:** Hash Right Join `pro`/`procor` + Aggregate.
- **Métricas:** com joins extras 7,31 ms → sem joins **4,05 ms** (Execution; Buffers hit=70). Valores validados: com estoque 224, sem estoque 2332, top marcas idêntico.

### 4. Busca de modelos server-side
- **Arquivo/função:** `src/controllers/modeloController.js` (`listarTodosModelos`).
- **Antes:** `select * from vw_modelos` (549 linhas, 42.917 bytes) e filtro/case-insensitive no navegador.
- **Solução:** `?search=` (`moddes ILIKE $1`) + `LIMIT` parametrizado (padrão 50, teto 200), mantendo a mesma ordenação da view; sem parâmetros, o catálogo completo permanece (compatibilidade com o painel).
- **Métricas:** full: 549 linhas / 42.917 bytes / Execution 2,99 ms; busca `a25`: 1 linha / 72 bytes / Execution 0,489 ms / Buffers hit=10.

### 5. Mais vendidos e devoluções — predicados sargáveis
- **Arquivos:** `src/models/showcaseModels.js` (`listarMaisVendidos`), `src/controllers/devolucoesController.js` (`buscarItensVendidos`).
- **Antes:** `TRIM(pv.pvconfirmado) = 'S'` e `TRIM(pv.pvsta) = 'A'`.
- **Evidência:** com `enable_seqscan=off`, a versão com `TRIM` **não** encontra índice e cai em `Index Scan using pvcod_pkey on pv` (0,171 ms no trecho), enquanto a comparação direta usa `idx_pv_sta on pv` (0,028 ms). As colunas são `bpchar(2)` e a comparação `=` ignora espaços à direita — semântica idêntica.
- **Métricas (query de mais vendidos após remoção):** Execution 0,712 ms; Buffers hit=36; regra inalterada.
- **Importante:** a janela temporal de "mais vendidos" **não foi alterada** (não existe definição de negócio; preservado o comportamento atual).

### 6. Relatório de peças cadastradas
- **Arquivo/função:** `src/models/relatoriosModels.js` (`getPecasCadastradas`).
- **Antes:** `LOWER(pro.prodes) LIKE LOWER($1)`.
- **Solução:** `pro.prodes ILIKE $1` — compatível com o índice GIN trigram. Equivalência verificada na base dev (`%tela%`: 3 = 3; `%capinha%`: 1 = 1).
- **Métricas:** a query completa roda em ~9,2 ms na base dev (2.169 linhas); o predicado isolado não foi cronometrado separadamente — **NÃO MEDIDO**.

### 7. `buildFlagsGestao` compartilhado
- Movido de `proController.js` para `src/utils/estoqueFlagsSql.js` e reutilizado pelo dashboard, evitando duas implementações da mesma regra de flags (sem mudança de comportamento; validado pelos números idênticos).

## Índices

Criados via mecanismo existente (`src/config/atualizardb.js`, `CREATE INDEX IF NOT EXISTS`, `pg_trgm` já habilitado):

| Índice | Tabela/coluna | Tipo | Tamanho (dev) | Query que usa | Justificativa |
| --- | --- | --- | ---: | --- | --- |
| `idx_pro_des_trgm` | `pro (prodes gin_trgm_ops)` | GIN | 200 kB | `/pros?q=` (painel), `getPecasCadastradas` | `ILIKE '%termo%'` não pode usar btree; com o índice, o planner já usa `Bitmap Index Scan` mesmo com seq scan habilitado (0,118 ms) |
| `idx_modelo_des_trgm` | `modelo (moddes gin_trgm_ops)` | GIN | 64 kB | `/modelos?search=` (loja) | mesma razão; com `enable_seqscan=off` o planner usa `Bitmap Index Scan idx_modelo_des_trgm` (0,069 ms) |

Custo de escrita: GIN em colunas de descrição, que mudam raramente (cadastro de produto/modelo). Frequência de uso: alta na loja/painel. Não há duplicidade com índices existentes.

**Não criados (sem evidência suficiente ou com riscos):**
- Composto em `pv (pvsta, pvconfirmado, pvdtcad)`: base dev não demonstra ganho; custo de escrita em tabela de alto insert.
- Índice funcional para telefone (`regexp_replace(parfone)`): melhor resolver com coluna normalizada (PR3).
- `pro.prodtcad`, `part_groups.created_at`, colunas de ordenação: sem EXPLAIN que comprove gargalo.

## Dashboard

**Antes:** `loadDashboard()` chamava 12 endpoints (feito paralelo na PR1). No servidor: 12 queries, sendo 2 listagens completas de produto com `string_agg` correlacionado. Payload total medido: **412.932 bytes**; soma dos tempos `curl` (serial): ~0,404 s.

**Depois:** `GET /dashboard/resumo` (`autenticarToken`) executa 4 queries em paralelo (pedidos, flags de produto, contagens de estoque + top marcas, listas) e devolve 401 bytes. Os 4 endpoints dos gráficos de período seguem separados e inalterados.

**Medições:**

| Métrica | Antes | Depois |
| --- | ---: | ---: |
| Requests (KPIs) | 12 | 1 |
| Queries (KPIs) | 12 | 4 |
| Payload (KPIs) | 412.932 B | 401 B |
| Latência individual (quente) | ~0,404 s somado (serial) | ~29–30 ms (1 request) |
| Concorrência 10 — p50 / p95 | 537,4 / 584,1 ms | 90,5 / 101,3 ms |
| Concorrência 25 — p50 / p95 | 699,9 / 777,5 ms | 112,9 / 179,6 ms |

Validação funcional: script comparando os 12 endpoints antigos com o novo retornou **12/12 valores idênticos** (pendentes, confirmados, balcão, entrega, venda, em falta, acabando, clientes, vendedores, marcas, com estoque, sem estoque) e top de marcas idêntico (SAMSUNG 72, iPHONE 64, MOTOROLA 52, Teste 14, XIAOMI 10).

## Catálogo

- `proModels.listarTodosProdutos` foi medido: **35,1 ms**, buffers hit 15.259, `SubPlan string_agg` com 2.556 loops (uma vez por linha). A variante com `LEFT JOIN` + agregação única ficou em **29,5 ms** (~11% melhor na base dev). Como o endpoint é cacheado (`catalogoCache`, 30 s) e a mudança afetaria 9 consultas semelhantes, **não foi alterada** nesta PR — registrada para a PR3.
- `listarProdutosComEstoque/SemEstoque` (listas completas) não são mais usadas pelo dashboard; seguem disponíveis para as telas de estoque.
- Índice trigram em `pro.prodes` beneficia a busca de produtos do painel (`/pros?q=`).

## Busca

| Métrica | Antes | Depois |
| --- | ---: | ---: |
| Dados retornados (termo `a25`) | 549 linhas | 1 linha |
| Payload | 42.917 B | 72 B |
| Execution (EXPLAIN) | 2,99 ms (view completa) | 0,489 ms |
| Filtro | no navegador | PostgreSQL (`ILIKE` parametrizado) + LIMIT 50 |

Comportamento preservado: `/modelos` sem parâmetros continua devolvendo o catálogo completo (usado pelo painel); a busca passa `search` + `limit=50` e mantém a ordenação original (por prefixo e número do modelo).

## Clientes

Analisado com EXPLAIN: a listagem usa 2 subqueries correlacionadas por linha (`SUM(cli_cobranca)` e `COUNT(pv)`) e `regexp_replace(parfone)` no filtro. A variante com `LEFT JOIN LATERAL` teve plano/tempo equivalentes ou piores na base dev (0,167 ms vs 0,151 ms) — **não alterada**. Com apenas 3 clientes não há evidência de ganho; a paginação e o índice de telefone normalizado ficam para a PR3. Nenhum valor de saldo/cobrança/pedidos foi alterado.

## Mais vendidos

- **Regra:** confirmado `S`, ativo `A`, descontando devoluções ativas e exigindo disponibilidade — inalterada.
- **Janela temporal:** não existe definição de negócio; o comportamento atual (histórico completo) foi **preservado** e a decisão registrada para produto/PR3.
- **Melhoria aplicada:** remoção de `TRIM` (comprovadamente impedia uso de `idx_pv_sta`/`idx_pv_confirmado`). Na base dev, a query roda em 0,712 ms com buffers hit=36. O custo histórico completo não foi testado com volume real — **NÃO MEDIDO**.

## Paginação

- `/pedidos/confirmados` e `/pedidos/pendentes` continuam sem LIMIT (61 linhas / 0,92 ms na base dev). A paginação server-side exige mudança de UX (a tela renderiza a lista inteira) — **não implementada**; registrada com proposta (offset + total, depois keyset por `pvcod DESC`).
- `OFFSET` alto não foi alterado em `cli`/`pros` (cap 200 já existente). Keyset fica para a PR3.
- `/modelos` ganhou `LIMIT` com teto (200) e busca server-side.

## Cache

| Endpoint | Frequência de alteração | Decisão |
| --- | --- | --- |
| `/emp` | baixa | já cacheado em memória (PR1, TTL 60 s + invalidação no PUT) |
| `/marcas`, `/tipos`, `/cores`, `/modelos` | baixa | **não implementado** nesta PR: exigiria invalidação em vários controllers; avaliar cache em memória com TTL curto + ETag na PR3 |
| `/showcases`, `/v2/pros` | — | já possuem cache + ETag |
| `/dashboard/resumo` | por natureza volátil (hoje) | sem cache; 4 queries agregadas |

Nenhum Redis ou cache externo foi introduzido.

## Benchmark

Metodologia reproduzível (executada em ambiente local contra o banco de desenvolvimento):

1. Servidor: `PORT=3100 node src/app.js`; token JWT de admin gerado com o mesmo segredo do projeto (uso local).
2. Painel: `curl -b token ...` por endpoint, medindo `time_total` e `size_download`.
3. Concorrência: script Node com `fetch` concorrente; cada "fluxo antes" = 12 requests em paralelo, "depois" = 1 request. 20 iterações por nível.
4. Queries: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)`.

Resultados de concorrência (dev, base pequena):

| Concorrência | Fluxo | p50 | p95 | max | Requests |
| ---: | --- | ---: | ---: | ---: | ---: |
| 10 | antes (12 req) | 537,4 ms | 584,1 ms | 584,1 ms | 240 |
| 10 | depois (1 req) | 90,5 ms | 101,3 ms | 101,3 ms | 20 |
| 25 | antes (12 req) | 699,9 ms | 777,5 ms | 777,5 ms | 240 |
| 25 | depois (1 req) | 112,9 ms | 179,6 ms | 179,6 ms | 20 |

Limitações: sem `autocannon`/`k6` (não instalados); 1 e 50 concorrentes não foram executados (o benchmark completo foi abortado); hardware do banco não coletado; dados pequenos. **NÃO MEDIDO** para produção.

## Riscos

- **Criação dos índices no startup:** `CREATE INDEX` (não `CONCURRENTLY`) roda no boot via `atualizardb`. Em produção com tabelas grandes, pode demorar e bloquear escrita. Recomendação: aplicar em janela de manutenção (ou criar `CONCURRENTLY` manualmente antes do deploy); o código é idempotente.
- **Busca sem termo:** `/modelos` sem parâmetros continua devolvendo tudo (compatibilidade). O ganho só ocorre quando o cliente envia `search`.
- **`ILIKE` vs `LOWER(...) LIKE`:** equivalência verificada na base dev para os termos testados; ambos usam o mesmo mapeamento de caixa do PostgreSQL.
- **TRIM em `bpchar`:** a remoção é segura porque as colunas (`pvconfirmado`, `pvsta`) são `bpchar`, cujo `=` ignora espaços à direita. Não replicar para colunas `varchar` com espaços.
- **Dashboard agregado:** a ordem do top 5 de marcas em empates pode variar (SQL usa `marcasdes` como desempate; o JS usava a ordem de inserção). Valores conferem.
- **Sem paginação em pedidos/relatórios:** payloads grandes continuam possíveis.

## Testes

- `npm test` — grupos de compatibilidade: **15/15**.
- `npm run test:pr1` — regressões da PR1 (atualizado para o endpoint agregado): **19/19**.
- `npm run test:pr2` — nova suíte (stub de pool + guardas estáticas): **12/12**.
  - busca de modelos: ILIKE/LIMIT parametrizados, teto 200, padrão 50 e catálogo completo sem parâmetros;
  - dashboard: 4 queries agregadas + config, valores e `CURRENT_DATE`;
  - rota `/dashboard/resumo` com autenticação;
  - guardas: TRIM removido, `ILIKE` no relatório, índices trigram na migration, frontend usando busca server-side e resumo agregado.
- Validação real (servidor 3100): 12/12 KPIs idênticos aos endpoints antigos; `/modelos?search=a25` = 1 linha; `/modelos` completo = 549 linhas; `/dashboard/resumo` = 401 bytes.
- Regressão funcional não coberta por teste automatizado (pedidos, estoque, devolução, cobrança, vitrines) foi preservada por não alterar essas queries/rotas — **NÃO MEDIDO** (sem teste E2E no projeto).

## Arquivos alterados

- `src/controllers/dashboardController.js` (novo) — resumo agregado.
- `src/routes/dashboardRoutes.js` (novo) — rota autenticada.
- `src/app.js` — registro da rota do dashboard.
- `src/controllers/modeloController.js` — busca server-side com LIMIT.
- `public/js/index.js` — envia `search`/`limit` para `/modelos`.
- `public/html/auth/js/painel-dashboard.js` — consome `/dashboard/resumo`.
- `src/utils/estoqueFlagsSql.js` — `buildFlagsGestao` compartilhado.
- `src/controllers/proController.js` — usa o helper compartilhado.
- `src/models/showcaseModels.js` — remove `TRIM` nos predicados.
- `src/controllers/devolucoesController.js` — remove `TRIM` nos predicados.
- `src/models/relatoriosModels.js` — `ILIKE` no filtro de peça.
- `src/config/atualizardb.js` — índices trigram (migration existente).
- `tests/performancePR2.test.js` (novo), `tests/performancePR1.test.js` (ajuste), `package.json` (`test:pr2`).

## Migrations

- Usado o mecanismo existente (`atualizarDB` + `CREATE INDEX IF NOT EXISTS`), sem sistema novo.
- Dois índices GIN trigram adicionados (ver seção "Índices"). Nenhuma alteração de tabela, coluna, constraint, trigger ou dado.
- Aplicação: executada no boot do servidor de desenvolvimento durante a validação (sem erros).

## Melhorias futuras (PR3)

- **PostgreSQL:** janela temporal de "mais vendidos" (decisão de produto); empurrar filtros de data para dentro das CTEs de `buscarItensVendidos`; coluna normalizada/indexada de telefone; revisar `extract(year from pvdtcad)` e `procod::text = reference_id`; avaliar paginação keyset em clientes/produtos.
- **Backend:** refatorar as 9 variações de `proModels` (correlacionada → agregação única, medida em ~11%); N+1 de `confirmarPedido`/`editarItensPedidoConfirmado` (transação/lote); unificar endpoints de count remanescentes; exportação de relatórios em lote/assíncrona; paginação de pedidos com suporte de UI.
- **Frontend:** remover assets comprovadamente não usados (Font Awesome 4.5, jQuery/Popper em configurações), `defer`/`preconnect`; `innerHTML +=` em loops; filtros locais grandes; retomar o teste de concorrência 1/50.
- **Cache:** cache em memória com ETag para `/marcas`, `/tipos`, `/cores`, `/modelos` com invalidação nos CRUDs; reprocessar imagens antigas de `/uploads`.
- **Infraestrutura:** `.dockerignore`, Node LTS, healthcheck.
- **Observabilidade:** habilitar `REQUEST_LOGGING`/`LOG_SLOW_QUERIES_MS`, medir queries por request e p95/p99 por rota; `pg_stat_statements` não está instalado na base (verificado).
