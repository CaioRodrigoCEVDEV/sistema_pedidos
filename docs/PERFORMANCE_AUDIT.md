# PERFORMANCE AUDIT — SISTEMA PEDIDOS

**Repositório:** `sistema_pedidos` (raiz: `/home/caio/Documentos/Dev/orderup`)
**Data:** 2026-09-17
**Branch auditada:** `release` (commit `2fc0d6b`)
**Escopo:** Node.js + Express + PostgreSQL, frontend público e autenticado, Service Worker, uploads/imagens, Docker, startup, CI/deploy.
**Modo:** auditoria somente leitura. Nenhum arquivo de código, schema, banco ou regra de negócio foi alterado.

## Metodologia e limitações

- Toda a evidência deste relatório vem de **leitura de código e configuração** (arquivos `src/`, `public/`, `Dockerfile`, `.github/`, `.env` mascarado) e de **tamanhos reais de arquivos** medidos localmente (`ls`/`du`).
- **Nenhuma medição em runtime foi coletada**: não houve conexão ao PostgreSQL, não houve `EXPLAIN`, não houve benchmark, profiling ou teste de carga. Isso foi deliberado para não gerar carga no ambiente (DB_HOST aponta para host externo, não local).
- Portanto, **nenhum tempo de resposta, p50/p95/p99, tempo de query ou uso de CPU/memória é afirmado** neste documento. Onde há estimativa, ela é rotulada como estimativa de engenharia, não medição.
- Classificação usada em cada achado:
  - **CONFIRMADO** — o problema está comprovado pelo código/configuração (ex.: query sem `LIMIT`, fetch por tecla, asset de 3,3 MB).
  - **PROVÁVEL** — padrão claramente ineficiente, mas o impacto depende de volume de dados/uso.
  - **PRECISA DE MEDIÇÃO** — hipótese plausível que exige `EXPLAIN (ANALYZE, BUFFERS)`, benchmark ou profiling.

---

## 1. Resumo executivo

O sistema é funcional e já possui algumas defesas de performance importantes: `compression()`, pool configurável com `statement_timeout`, cache em memória com ETag para catálogo (`/v2/pros`) e vitrines (`/showcases`), cache de configuração de estoque, índices criados de forma idempotente no startup, insert em lote via `unnest` em `pvi`, e `Promise.all` em alguns pontos.

Os riscos concentram-se em cinco frentes:

1. **Startup com trabalho pesado e lock global.** `src/app.js:610-614` só chama `app.listen()` depois de `await atualizarDB()`. `src/config/atualizardb.js` executa ~70+ comandos DDL/DML sequenciais a cada boot, incluindo `ALTER TABLE`, `DROP/CREATE TRIGGER`, `CREATE OR REPLACE FUNCTION/VIEW` e **full scans de reconciliação** (`pro`, `pv/pvi`, `par`, `cli_mov`). Além disso, `BEGIN`/`COMMIT` e `pg_advisory_lock` são feitos via `pool.query`, sem fixar a mesma conexão — o lock pode vazar e o "transação" pode não englobar os comandos. **CONFIRMADO no código; impacto em tempo de boot/risco de lock precisa de medição.**
2. **Consultas de agregação sobre histórico inteiro e sem paginação.** `showcaseModels.listarMaisVendidos` agrega todo o `pvi`/`pv` e todas as devoluções sem janela temporal; `devolucoesController.buscarItensVendidos` agrega 100% de `pvi` e `devolucoes` antes de filtrar; relatórios (`top-pecas`, `pecas-cadastradas`, `estoque-grupos`) não têm `LIMIT` e são carregados integralmente em memória para PDF/Excel. **CONFIRMADO; custo cresce linearmente/historicamente com a base.**
3. **Filtros não-sargáveis que anulam índices existentes.** `pvdtcad = 'now()'` (literal inválido) em 4 endpoints, `pvdtcad::date`, `extract(year from pvdtcad)`, `TRIM(pvconfirmado)`, `LOWER(prodes) LIKE`, `procod::text = reference_id`, `regexp_replace(parfone...) LIKE`, além de `CASE ... END > 0` no `WHERE` do catálogo. **CONFIRMADO no código; magnitude do custo precisa de `EXPLAIN`.**
4. **N+1 e cadeias sequenciais no frontend.** O dashboard dispara 12 `await` em série; a tela de pedidos chama `atualizarTotaisPedidos()` **dentro do `forEach`** de pedidos (4 requests por item); a busca da home baixa o catálogo inteiro de modelos **a cada tecla** sem debounce. **CONFIRMADO no código.**
5. **Assets e rede.** `logo.jpg` com **2.607.072 bytes** e `apple-touch-icon.png` com **3.294.245 bytes** (medidos) usados como favicon/logo de 36 px; `/uploads` servido sem `maxAge`; Service Worker **inerte** (handler `fetch` vazio); Font Awesome 4.5 e bibliotecas não usadas carregadas em várias páginas; nenhum `preconnect`/`defer`. **CONFIRMADO.**

Em escala, o que deve degradar primeiro: dashboards/relatórios (agregações sem janela), vitrine "Mais vendidos" (varredura histórica), listagens sem paginação (`/pedidos/*`, catálogo `/proComEstoque` etc.) e o startup (full scans + locks a cada restart).

---

## 2. Gargalos confirmados

### 2.1 Backend

| # | Achado | Evidência |
|---|---|---|
| B1 | `atualizarDB()` antes do `listen`; ~70+ comandos sequenciais por boot | `src/app.js:610-614`; `src/config/atualizardb.js:6-1625` |
| B2 | `BEGIN`/`COMMIT`/advisory lock via `pool.query` (sem `pool.connect`), sem garantia de mesma sessão | `src/config/atualizardb.js:9`, `:11`, `:1614`, `:1621` |
| B3 | `requireTela` faz 1 query por request de usuário não-admin, sem cache de permissão | `src/middlewares/telaMiddleware.js:47-58` |
| B4 | 4 middlewares reimplementam `jwt.verify` + `jwt.sign` + cookies em **toda** request | `src/middlewares/middlewares.js:11-37`; `adminMiddleware.js:11-37`; `adminPagesMiddleware.js`; `adminPvMiddleware.js`; `adminEstMiddleware.js` |
| B5 | `morgan("dev")` sempre ativo em produção | `src/app.js:67` |
| B6 | `GET /manifest.json` faz **fetch HTTP interno** para `/emp` a cada hit, com `no-store` e `console.log` | `src/app.js:413-458` |
| B7 | `POST /pedidos/enviar` e `POST /save-marca` **sem autenticação** (save-marca ainda roda `sharp` 2x) | `src/routes/pedidosRoutes.js:8-12`; `src/app.js:523-603` |
| B8 | `POST /pedidos/enviar`: `INSERT pv` e `INSERT pvi` em chamadas separadas, sem transação | `src/controllers/pedidosController.js:90-159` |
| B9 | 8 endpoints de `count(*)` para pedidos, chamados em sequência pelo dashboard; 4 usam `pvdtcad = 'now()'` (literal inválido) e 1 usa `pvdtcad::date` | `src/controllers/pedidosController.js:202-309` |
| B10 | `PART_GROUP`/`venderItens`: código legado com N+1 e `FOR UPDATE` por item — **não está montado nas rotas atuais** (latente) | `src/models/partGroupModels.js:1175-1489`; `src/controllers/pedidosController.js:28-88`; rotas em `pedidosRoutes.js` só usam `inserirPv`/`inserirPvi` |
| B11 | `/uploads` servido sem `maxAge` (default `max-age=0`), diferente de `/public` (7d) | `src/app.js:31-41` |
| B12 | `listarPv` em `pedidoModels` usa `$1` sem passar parâmetros (rota `/v2/pedidos/listar` sempre falha) | `src/models/pedidoModels.js:148-178`; `src/routes/pedidosRoutesV2.js:11` |

### 2.2 PostgreSQL

| # | Achado | Evidência |
|---|---|---|
| S1 | `listarMaisVendidos` agrega **todo** o histórico de vendas e devoluções, sem data, com `TRIM()` nas colunas e `LIMIT` apenas no fim | `src/models/showcaseModels.js:125-162` |
| S2 | `buscarItensVendidos` agrega todo `pvi` e toda `devolucoes` em CTEs antes de aplicar filtro/data; `CAST(...) ILIKE` | `src/controllers/devolucoesController.js:52-96` |
| S3 | Relatórios sem `LIMIT`: `getTopPecas`, `getPecasCadastradas`, `getEstoqueGruposTopPecas` | `src/models/relatoriosModels.js:58-135`, `:184-202`, `:243-295` |
| S4 | PDF/XLS montados 100% em memória, percorrendo todas as linhas | `src/controllers/relatoriosController.js:42-193`, `:199-267`, `:312-413` |
| S5 | `cliController.list`: `COUNT(*)` e dados em série; 2 subqueries correlacionadas por linha; `regexp_replace` no `WHERE` | `src/controllers/cliController.js:138`, `:151-167` |
| S6 | `proController.listarProdutos`: `COUNT(*)` + dados em série; branch **sem paginação** quando `page/pageSize` ausentes | `src/controllers/proController.js:136-156` |
| S7 | 9 variações quase idênticas de catálogo, com `DISTINCT` + subquery `string_agg` por linha e `CASE` no `WHERE`; sem `LIMIT`; sem cache exceto `/v2/pros` | `src/models/proModels.js:21-367` |
| S8 | `listarProdutosComEstoque`/`SemEstoque` duplicados entre controller e model (mesmo SQL, dois planos/manutenção) | `src/controllers/proController.js:645-707`; `src/models/proModels.js:48-98` |
| S9 | `part-groups`: GROUP BY de 10 colunas sem paginação; `available-part` com `limit` sem teto; auditoria com `p.procod::text = a.reference_id` | `src/models/partGroupModels.js:22-42`, `:867-955`, `:963-982` |
| S10 | `usuario/listar` com `json_agg` correlacionado por usuário, sem paginação | `src/controllers/usuarioController.js:174-195` |
| S11 | `pedido/detalhe`, `devolucoes/historico` e `cli/:id/cobrancas` sem paginação por offset (limites fixos ou ausentes) | `src/controllers/cliController.js:552-570`; `src/controllers/devolucoesController.js:104-126` |
| S12 | Índice `idx_cli_mov_parcod (movparcod, movdtcad DESC)` não cobre `ORDER BY movcod DESC`; `idx_cli_cobranca_parcod` não cobre `ORDER BY (cobsta='A') DESC, cobcod DESC` | `src/controllers/cliController.js:500`, `:562`; `src/config/atualizardb.js:1412-1435` |
| S13 | Sem índice para `pro.prodtcad` (ordenação de Novidades), `pro.proordem`, `marcas.marcasordem`, `modelo.ordem`, `tipo.tipoordem`, `part_groups.created_at`, `pro.prodes` (ORDER BY), `pro.prodes` para `ILIKE` (sem trigram) | `src/models/showcaseModels.js:174`; `src/controllers/proController.js:53`; `src/controllers/marcasController.js:7`; `src/models/partGroupModels.js:39`, `:834` |
| S14 | View `vw_tipo_pecas` agrega `pro × promod × tipo` via `GROUP BY` e é recriada a cada startup | `src/config/atualizardb.js:311-327` |
| S15 | Reconciliações full-scan a cada startup (`pro`, `pv`+`pvi`, `par`, `cli_mov`) | `src/config/atualizardb.js:1181-1212`, `:1341-1355`, `:1441-1449` |

### 2.3 Frontend

| # | Achado | Evidência |
|---|---|---|
| F1 | Dashboard: 12 `await` sequenciais no load (`loadDashboard`) | `public/html/auth/js/painel-dashboard.js:766-798` |
| F2 | `/pedidos`: `atualizarTotaisPedidos()` chamado dentro do `forEach` de pedidos (4 requests por item) | `public/html/auth/js/painel-pedidos.js:591-608` + `:181-186` |
| F3 | Home busca `/modelos` **a cada tecla**, baixa catálogo completo, sem debounce e sem `AbortController` | `public/js/index.js:254-295`; `src/controllers/modeloController.js:128-136` (`select * from vw_modelos`) |
| F4 | `/emp` buscado 3x em configurações e 2x no load do carrinho (+1 no checkout +1 interno do manifest) | `public/js/configWhatsapp.js:29`; `public/js/nomeEmpresa.js:11`; `public/js/configEstoque.js:38`; `public/js/carrinho.js:652`, `:359` |
| F5 | Service Worker sem `fetch` handler: não cacheia nada | `public/sw.js:26-28` |
| F6 | `window.location.reload()` após salvar WhatsApp | `public/js/configWhatsapp.js:83` |
| F7 | Listener acumulado no botão de novo produto (1 fetch a mais por clique) | `public/html/auth/js/painel-produto.js:129` (e `:75`) |
| F8 | Submit duplo de marca (2 POSTs por salvamento) | `public/html/auth/js/painel-marca.js:16-60` e `:67-125` |
| F9 | `innerHTML +=` em loops (re-parse do container por iteração) | `public/html/auth/js/painel.js:88-89`, `:98-99`, `:124`, `:1304`, `:3114-3127`, `:3474` |
| F10 | Re-render completo de lista a cada tecla em várias telas (part-groups, clientes, backups, lista-pecas) | `public/html/auth/js/painel-part-groups.js:1210`, `:1235-1244`; `painel-clientes.js:436-443`, `:1026`; `painel-backups.js:169`; `public/js/lista-pecas.js:145-186`, `:269-273` |
| F11 | `renderCart()` executado 2x no primeiro load (DOMContentLoaded + pageshow) | `public/js/carrinho.js:627-628`, `:672-675` |
| F12 | Duplicação de lógica global (`atualizarIconeCarrinho`, `ouNotify`, `mostrarPopupAdicionado`) entre `index.js` e `storefront-shared.js` | `public/js/index.js:298-361`; `public/js/storefront-shared.js:93-158` |
| F13 | `syncCartParam` grava o carrinho inteiro em Base64 na URL a cada render, sem nenhum leitor | `public/js/carrinho.js:101-116` |
| F14 | Assets inúteis: Font Awesome 4.5 em 7+ páginas, jQuery/Popper em `configuracoes.html`, SortableJS sem uso em 3 páginas, Chart.js no `<head>` sem `defer` | `public/html/index.html:26`; `public/html/configuracoes.html:360-368`; `painel-estoque.html:173`, `painel-pedidos.html:302`, `painel-backups.html:96`; `painel-dashboard.html:26-27` |
| F15 | Sem `preconnect`/`dns-prefetch`/`defer`/`async` em nenhuma página | busca global em `public/html/**` |

### 2.4 Docker / Runtime

| # | Achado | Evidência |
|---|---|---|
| D1 | Sem `.dockerignore`: `COPY . .` copia `node_modules` (100 MB) por cima do `node_modules` de produção, além de `.git` (69 MB), `tests/`, `docs/` e `.env` | `Dockerfile:13-14`; ausência de `.dockerignore`; `du -sh node_modules .git` |
| D2 | Imagem base `node:18-alpine` (Node 18 já em EOL) | `Dockerfile:2,8` |
| D3 | Sem healthcheck e sem `--max-old-space-size`; runtime depende de defaults | `Dockerfile:20-21` |

### 2.5 Imagens / assets (tamanhos medidos)

| Arquivo | Bytes | Uso |
|---|---:|---|
| `src/uploads/logo.jpg` | 2.607.072 | favicon de `index.html:14` + logo 36×36 do header (`public/js/componentes.js:11`) |
| `src/uploads/apple-touch-icon.png` | 3.294.245 | `index.html:15` |
| `src/uploads/t1.png` | 5.947.564 | legado (não referenciado no storefront atual) |
| `src/uploads/t1.jpg` | 515.496 | legado |
| `public/images/hero-pecas.png` | 162.133 | novo asset (untracked) |

- Upload de logo não redimensiona: `sharp(jpegPath).png().toFile(pngPath)` gera PNG de tamanho original (`src/app.js:478-482`).
- Upload de marca gera **dois** formatos em sequência, sem resize/otimização (`src/app.js:579-580`).
- Cards não usam `srcset`/`sizes` nem `width`/`height` (risco de CLS); lazy loading existe.

---

## 3. Gargalos prováveis

### 3.1 Backend/DB

| # | Achado | Por que é provável | Como confirmar |
|---|---|---|---|
| P1 | Pool pode ficar sem conexões sob concorrência (máx. 10) combinado com transações longas de confirmação/edição/relatórios | `src/config/db.js:12`; transações com locks em `pedidosController.confirmarPedido:421-571` e `editarItensPedidoConfirmado:701-926`; PDF/Excel mantêm conexão durante processamento | `pg_stat_activity`, espera por `pool.connect`, teste k6 com 25/50 usuários |
| P2 | Trigger `t_atualizar_saldo`/`t_retornar_saldo` domina o custo de confirmar/cancelar pedidos | Triggers reexecutam loops de validação e UPDATE por item dentro do banco (`atualizardb.js:670-977`, `:1097-1118`) | `EXPLAIN (ANALYZE, BUFFERS)` do `UPDATE pv ...`, `auto_explain`, `pg_stat_statements` |
| P3 | Índices em colunas pouco seletivas (`idx_pv_sta`, `idx_pv_confirmado`, `idx_pro_sit`, `idx_pro_semest`) podem não ser usados | Baixa cardinalidade típica (2-3 valores) | `EXPLAIN (ANALYZE, BUFFERS)` com dados reais |
| P4 | `ORDER BY pvcod DESC` em listagens com join e `GROUP BY` pode exigir sort externo | `pedidosController.js:345-354`, `:400-409` | `EXPLAIN (ANALYZE, BUFFERS)` |
| P5 | `getAvailablePart` e `getGroupAuditHistory` com `ILIKE`/`::text` e sem trigram em `pro` | `partGroupModels.js:880-884`, `:974` | `EXPLAIN` antes/depois de `pg_trgm` |
| P6 | `COUNT(*)` + paginação por `OFFSET` fica lento em páginas altas de clientes/produtos | `cliController.js:151-167`; `proController.js:137-148` | `EXPLAIN` com `OFFSET` 1000/10000 |
| P7 | `/manifest.json` (fetch interno) e `requireTela` podem responder por parcela relevante do TTFB das páginas | `app.js:413-458`; `telaMiddleware.js:47-58` | `autocannon` no endpoint isolado; medir tempo do fetch interno |
| P8 | Cache do catálogo é invalidado em qualquer escrita e a query de reconstrução é pesada; sob operação contínua o cache pode ter pouca efetividade | `src/utils/catalogoCache.js`; invalidações em `proController`, `pedidosController:540`, `partGroupController`, `devolucoesController:301` | Medir hit ratio (instrumentar `catalogoCache.get()`); contar invalidações por hora |
| P9 | PDF gera tudo em memória e bloqueia o event loop durante `heightOfString` por célula | `relatoriosController.js:109-183`, `:375-404` | Profiling de CPU; teste com 5k/50k linhas em ambiente de teste |
| P10 | Upload `save-marca` sem auth é vetor de consumo de CPU (`sharp` 2x) e disco | `app.js:523-603` | Teste controlado de abuso (não destrutivo, ambiente de teste) |

### 3.2 Frontend

| # | Achado | Evidência |
|---|---|---|
| P11 | Home monta a lista com `innerHTML` por item e `querySelector` por item, além de fetch por tecla | `public/js/index.js:203-251`, `:254-295` |
| P12 | `lista-pecas.js` destrói e recria a lista inteira a cada tecla (com reordenação) | `public/js/lista-pecas.js:145-186`, `:269-273` |
| P13 | Modal de cores recriado com `<style>`/`<script>` inline a cada abertura | `public/js/index.js:423-520`; `public/js/lista-pecas.js:383-481` |
| P14 | Scroll handler de vitrines lê `scrollWidth`/`clientWidth`/`getComputedStyle` sem throttle (layout thrashing) | `public/js/showcases.js:214-237` |
| P15 | Badge do carrinho força leitura de layout (`getComputedStyle`) a cada atualização, executado 2x no load | `public/js/index.js:306`; `public/js/storefront-shared.js:132` |
| P16 | Painel `/painel` duplica `/marcas` (2x) e `/tipos` (3x) no load; relatórios duplica `/marcas` (2x) | `painel.js:805-808`, `:3011`, `:137/153`, `:3172`; `painel-relatorios.js:27`, `:230` |
| P17 | `painel.js` tem 128.540 bytes não minificado e 12 scripts carregados de uma vez | medição `ls`; `painel.html:1058-1073` |
| P18 | `painel-dashboard.js` e `componentes.js` buscam `/me/usuario` separadamente | `painel-dashboard.js:843`; `auth/js/componentes.js:452` |
| P19 | `setInterval(processCharges, 24h)` sem cleanup roda também no load (`GET /emp/pagamento` em todo `/painel`) | `painel.js:3750-3757`, `:3703` |
| P20 | Polling e reloads completos após mutações em pedidos/marca | `painel-pedidos.js:380`, `:439`, `:462`, `:504`, `:913`; `painel-marca.js:103` |

---

## 4. Hipóteses que precisam de medição

| # | Hipótese | Medição necessária |
|---|---|---|
| H1 | `listarMaisVendidos` escala mal com o histórico de vendas | `EXPLAIN (ANALYZE, BUFFERS)` da CTE `vendas` com o histórico atual; repetir simulando 12/24 meses |
| H2 | `devolucoesController.buscarItensVendidos` faz full scan de `pvi`/`devolucoes` | `EXPLAIN (ANALYZE, BUFFERS)` com e sem filtro de data |
| H3 | `proModels.*` têm custo dominado pela subquery `string_agg` + `DISTINCT` + `CASE` no `WHERE` | `EXPLAIN (ANALYZE, BUFFERS)` de `listarTodosProdutos`/`listarProdutosComEstoque` com catálogo real |
| H4 | `COUNT(*)` do catálogo é caro por reavaliar as flags de disponibilidade | Comparar `EXPLAIN` do `count(*)` com o do `SELECT` paginado |
| H5 | `requireTela` e `/manifest.json` somam overhead perceptível no TTFB | `autocannon` por endpoint; medir tempo por request com `REQUEST_LOGGING=true` |
| H6 | `atualizarDB` demora segundos e bloqueia escrita nas tabelas durante o boot | Cronometrar boot no ambiente de teste; `pg_locks` durante o startup |
| H7 | O advisory lock de startup pode vazar se `pool.query` usar conexões diferentes | Inspecionar `pg_locks` (`locktype='advisory'`) após restart; comparar `pg_backend_pid()` de cada query |
| H8 | Índice trigram em `pro.prodes` reduz o custo da busca de produtos do painel | `EXPLAIN` antes/depois em ambiente de teste (não aplicar nesta etapa) |
| H9 | `idx_pv_dtcad` não está sendo usado pelas consultas "Now" | `EXPLAIN (ANALYZE, BUFFERS)` com `CURRENT_DATE` vs `'now()'` |
| H10 | PDF/Excel bloqueiam o event loop sob volume alto | Benchmark com 5k/50k/100k linhas em ambiente isolado |

---

## 5. PostgreSQL — queries relevantes

> Nenhum `EXPLAIN` foi executado. As colunas "índice relacionado" listam os índices existentes no código; "EXPLAIN necessário" indica o comando sugerido para confirmar o plano.

### 5.1 Vitrine "Mais vendidos" — `showcaseModels.listarMaisVendidos`
- **Arquivo/função:** `src/models/showcaseModels.js:125-162`
- **Rota:** `GET /showcases` (público, cache 30s + ETag)
- **SQL resumido:** CTE `vendas` = `pvi JOIN pv` agrupando **todo** o histórico; CTE `devolvidas` = `devolucoes JOIN devolucao_itens JOIN pv`; join com `pro/tipo/marcas/modelo`; `LIMIT $1` no fim.
- **Problemas:** agregação sem janela temporal; `TRIM(pvconfirmado)='S'`, `TRIM(pvsta)='A'` não-sargáveis; subquery correlacionada `(SELECT MIN(...) FROM promod ...)` por linha (`showcaseModels.js:36-39`).
- **Índices relacionados:** `idx_pvi_procod`, `idx_pvi_pvcod`, `idx_pv_confirmado`, `idx_pv_sta`, `idx_devolucoes_data`, `idx_devolucao_itens_busca`.
- **EXPLAIN necessário:** CTE `vendas` isolada e o `EXPLAIN (ANALYZE, BUFFERS)` completo.
- **Otimização possível:** restringir janela (ex.: últimos 90 dias), materializar ranking periodicamente, remover `TRIM`.

### 5.2 Devoluções — `buscarItensVendidos`
- **Arquivo/função:** `src/controllers/devolucoesController.js:52-96`
- **Rota:** `GET /devolucoes/itens`
- **Problemas:** CTEs agregam 100% de `pvi` e `devolucoes` antes do `WHERE`; `CAST(v.pvipvcod AS TEXT) ILIKE`, `CAST(v.pviprocod AS TEXT) ILIKE`, `prodes ILIKE`, `TRIM(pvconfirmado)`; `LIMIT 100` fixo sem offset.
- **EXPLAIN necessário:** com `q` e sem `q`; com e sem datas.
- **Otimização possível:** empurrar filtros de `pv`/data para dentro das CTEs, trocar casts por comparação numérica/textual direta.

### 5.3 Relatórios — `getTopPecas` / `getPecasCadastradas` / `getEstoqueGruposTopPecas`
- **Arquivos:** `src/models/relatoriosModels.js:58-135`, `:184-202`, `:243-295`
- **Rotas:** `GET /v2/relatorios/top-pecas`, `/pecas-cadastradas`, `/estoque-grupos` (+ PDF/XLS)
- **Problemas:** sem `LIMIT`; `STRING_AGG(DISTINCT ...)`; CTEs agregando histórico inteiro; `LOWER(pro.prodes) LIKE`; joins com `procor` por cor; `ORDER BY qtde_vendida DESC` sem suporte de índice.
- **EXPLAIN necessário:** cada query com filtro de período realista e com período total.
- **Otimização possível:** paginação + limite, pré-agregação por período, índice de cobertura em `pvi(pvipvcod, pviprocod, pviqtde)` (avaliar).

### 5.4 Catálogo — `proModels.*` e `proController.listarProdutos`
- **Arquivos:** `src/models/proModels.js:21-367`; `src/controllers/proController.js:63-161`, `:645-707`
- **Problemas:** 9 variações do mesmo `SELECT DISTINCT` com `string_agg` correlacionado por linha, `CASE` de disponibilidade com `EXISTS` aninhados (`src/utils/disponibilidadeProdutoSql.js:5-51`) e `CASE ... END > 0` no `WHERE` (não-sargável); sem `LIMIT` em quase todas.
- **Índices relacionados:** `idx_pro_marcas`, `idx_pro_tipo`, `idx_pro_sit`, `idx_pro_semest`, `idx_promod_procod/modcod`, `idx_pro_part_group_id`.
- **EXPLAIN necessário:** `listarTodosProdutos`, `listarProdutosComEstoque`, `count(*)` do catálogo.
- **Otimização possível:** consolidar SQL repetido em uma função parametrizada, transformar flags em colunas materializadas/índices funcionais, paginar as listagens públicas.

### 5.5 Clientes — `cliController.list`
- **Arquivo/função:** `src/controllers/cliController.js:119-174`
- **Problemas:** `COUNT(*)` + dados em série; subqueries correlacionadas por linha (`SUM(cli_cobranca)`, `COUNT(pv)`); `regexp_replace(parfone)` no `WHERE`; `OFFSET` crescente.
- **Índices relacionados:** `idx_par_des_trgm`, `idx_par_fan_trgm`, `idx_pv_parcod`, `idx_cli_cobranca_parcod`.
- **EXPLAIN necessário:** com `q` textual, com telefone, com página alta.
- **Otimização possível:** paralelizar count+dados, transformar subqueries em `LEFT JOIN LATERAL`/agregações únicas, coluna normalizada de telefone indexada.

### 5.6 Pedidos — listagens e counts
- **Arquivos:** `src/controllers/pedidosController.js:161-419`
- **Problemas:** `LEFT JOIN pvi + GROUP BY` de 8-9 colunas sem paginação; `BETWEEN` com defaults `1900-01-01`/`2999-12-31`; `SUM` duplicado no SELECT; 8 endpoints de count; `pvdtcad = 'now()'` / `pvdtcad::date`.
- **Índices relacionados:** `idx_pv_sta`, `idx_pv_confirmado`, `idx_pv_dtcad`, `idx_pv_rcacod`, `idx_pvi_pvcod`.
- **EXPLAIN necessário:** `pendentescountNow` (para provar que `idx_pv_dtcad` não é usado e que o resultado é 0/erro), `confirmados` sem filtro de data.
- **Otimização possível:** unificar counts em 1 query com `COUNT(*) FILTER`, corrigir datas, paginar listagens.

### 5.7 Grupos de compatibilidade
- **Arquivo:** `src/models/partGroupModels.js`
- **Problemas:** `listGroups` GROUP BY grande sem paginação (`:22-42`); `available-part` com ILIKE e limit sem teto (`:867-955`); auditoria com `procod::text` (`:963-982`); `updateGroupStock` + `updateAllPartsStockInGroup` = 2 transações por request (`:992-1085`, `:1095-1158` via `src/controllers/partGroupController.js:130-144`).
- **EXPLAIN necessário:** `listGroups`, `getAvailablePart` com busca, auditoria.
- **Otimização possível:** `RETURNING` para evitar refetch, transação única por request, índice trigram em `pro.prodes`/`marcas.marcasdes`/`tipo.tipodes`.

### 5.8 Consultas "Now" com literal inválido (defeito confirmado)
```
src/controllers/pedidosController.js:217, :241, :266, :302
WHERE ... AND pvdtcad = 'now()'
```
- `'now()'` não é valor válido para `date` (o correto é `CURRENT_DATE` ou `now()::date`). Além de não filtrar "hoje", impede qualquer uso de `idx_pv_dtcad`.
- **EXPLAIN necessário:** `EXPLAIN (ANALYZE, BUFFERS) SELECT ... WHERE pvdtcad = 'now()'` e a variante com `CURRENT_DATE`.

### 5.9 Outros defeitos correlatos
- `src/controllers/estoqueController.js:19`: `LEFT JOIN cores ON corcod = procor` — referência ambígua/suspeita; validar no banco.
- `src/models/pedidoModels.js:148-176`: `$1` sem `params` (rota `/v2/pedidos/listar` quebrada).
- `src/routes/usuarioRoute2.js:8`: rota sem `/` inicial, nunca casa.

---

## 6. Backend

### 6.1 Middlewares e custo por request

Ordem atual (`src/app.js:65-83`): `compression` → `requestTimingMiddleware` (opt-in) → `morgan` → `body-parser` (json + urlencoded) → `cookie-parser` → `cors` → routers.

- **JWT**: `autenticarToken` verifica **e assina novo token** em toda request (`middlewares.js:11-37`), com custo HMAC + `Set-Cookie` + 6 `clearCookie`. O mesmo bloco está duplicado em 4 middlewares administrativos.
- **Autorização**: `requireTela` consulta `usu_telas JOIN telas` por request para não-admin (`telaMiddleware.js:47-58`), sem cache.
- **body-parser**: limite default de 100 kB; JSONs de pedido são pequenos (ok). Para `/save-marca` (multipart) não se aplica.
- **Routers montados todos em `/`** (`app.js:86-153`): cada request percorre a lista de routers até casar. Custo pequeno, mas cresce com o número de rotas.
- **CORS** com origem fixa em HTTP (4 domínios) — não afeta perf, mas há tráfego sem TLS.

### 6.2 Requests desnecessários / duplicados (backend)

- `GET /manifest.json` → fetch interno `GET /emp` (`app.js:420`).
- `loginController.validarLogin`: query `usu` + query `emp` sequenciais + eventualmente `resolverRotaInicial` (`loginController.js:56-91`).
- `cliController.resumoConta`: 4 queries sequenciais (`cliController.js:440-466`).
- `partGroupModels.getGroupById`: 2 queries sequenciais (`partGroupModels.js:49-102`).
- `empController.dadosPagamento` consulta a mesma linha de `emp` já lida por `listarEmpresa` (`empController.js:92-100`).

### 6.3 Processamento / memória

- Catálogo inteiro serializado em memória (`JSON.stringify`) no `catalogoCache.set` (`src/utils/catalogoCache.js:21-25`).
- Vitrines idem (`showcasesCache.js:28-32`).
- PDF/Excel com todo o dataset em memória e loops de medição de texto (`relatoriosController.js:109-183`, `:375-404`).
- `Math.min(...array.map(...))` em `venderItens` (`partGroupModels.js:1315-1317`) — latente (código não montado), risco de estouro de pilha com arrays grandes.

### 6.4 Pool

- `max: 10` (env `DB_POOL_MAX`), `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`, `statement_timeout: 30000` por conexão (`src/config/db.js:5-25`).
- Sem `application_name`, sem monitoramento de `waitingCount`, sem circuit breaker para pool esgotado.
- Transações longas (`confirmarPedido`, `editarItensPedidoConfirmado`, `updateGroupStock`) seguram conexão; 10 conexões é teto baixo se esses fluxos forem concorrentes.

### 6.5 Geração de arquivos

- PDFKit: `getTopPecasPDF` e `getPecasCadastradasPDF` (`relatoriosController.js:42-193`, `:312-413`).
- ExcelJS: `getTopPecasXLS` (`:199-267`).
- Ambos geram tudo em memória e respondem em streaming de saída, sem paginação/limite.

---

## 7. Frontend

### 7.1 Fluxo da home e contagem de requisições

Fluxo: `Browser → HTML → JS → API → PostgreSQL → resposta → renderização`.

Requisições para montar a home (contagem derivada do código):

| Tipo | Quantidade | Itens |
|---|---:|---|
| Documento/CSS | 12 | HTML + 8 CSS locais (`index.html:11-25`) + CDN Font Awesome 4.5 (`:26`) + Bootstrap Icons (`:27-28`) + Font Awesome 6.5 (`:29`) |
| Scripts | 11 | `theme-manager` no `<head>` (`:8`) + 8 locais (`:107-115`) + `/config.js` (`:109`) + `bootstrap.bundle` (`:116`) |
| API (fetch) | 3 em paralelo | `/emp` (`nomeEmpresa.js:11`), `/showcases` (`showcases.js:314`), `/marcas/` (`index.js:22`) |
| Metadados/PWA | 2 | `/manifest.json` (`index.html:10`, que internamente chama `/emp`) e `/sw.js` (`index.js:633`) |
| Imagens | 2+ | `/uploads/logo.jpg` (favicon + header), `/uploads/apple-touch-icon.png`; logos de marca (1 por card, com 2ª request em caso de 404 + fallback CDN) |
| Fontes | várias | woff2 de Font Awesome 4.5/6.5 e Bootstrap Icons |

Total aproximado: **~27-30 requisições** antes de qualquer interação (estimativa de contagem a partir do markup, não medição de rede). Oportunidades de consolidação: unificar `/emp` (3 chamadas em configurações, 3 no carrinho), remover FA4, carregar scripts com `defer`, cachear `/marcas/` e `/modelos` no cliente, e fazer busca com debounce + endpoint server-side.

### 7.2 Renderização/DOM

- `innerHTML` por item em loops: `index.js:203-251`, `showcases.js:125-205`, `lista-pecas.js:114-142`, `modelo.js:50-84`, `pecas.js:87-126`.
- Rebuild total de listas a cada interação: `lista-pecas.js:168-169`; painéis (`painel-clientes.js:277-278`, `painel-pedidos.js:720-721`, entre outros).
- `innerHTML +=` em loops O(n²) no painel: `painel.js:88-89`, `:98-99`, `:124`, `:1304`, `:3114-3127`, `:3474`.
- Listeners acumulados: `painel-produto.js:129`, `:75`.
- Render duplicado desktop+mobile por item em pedidos: `painel-pedidos.js:722-750`, `:790-819`.

### 7.3 Busca / filtros

- Home sem debounce e baixando dataset completo (`index.js:254-295`; `modeloController.js:128-136`).
- Painéis com filtro local sem debounce: `painel-part-groups.js:1210`, `:1235-1244`; `painel-clientes.js:436-443`, `:1026`; `painel-backups.js:169`.
- `painel-estoque.js:93-120` baixa `/v2/pros/` inteiro e filtra no cliente, embora exista `/pros` paginado.

### 7.4 Estado local

- `syncCartParam` grava Base64 do carrinho na URL sem leitor (`carrinho.js:101-116`).
- Releitura de `localStorage` do carrinho a cada render/operacão (múltiplos pontos listados no levantamento).

---

## 8. Cache

| Oportunidade | O que cachear | TTL sugerido | Invalidação | Risco de stale | Onde |
|---|---|---|---|---|---|
| HTTP `/marcas`, `/modelos`, `/tipos`, `/cores` | Listas de catálogo | 60-300 s + ETag | Curto TTL; invalidar por versão em escrita | Baixo (dados mudam raramente) | Resposta Express |
| HTTP `/emp` | Dados da empresa | 60 s + ETag | Invalidar no `PUT /emp` | Baixo | Resposta Express |
| Memória `/proComEstoque`, `/proSemEstoque`, `/v2/proEstoque*` | Resultados de catálogo | 30 s (mesmo padrão do `catalogoCache`) | Invalidação já existente nos writes | Médio (vitrines podem mostrar item vendido) | Reusar `catalogoCache` ou cache dedicado |
| Permissões `requireTela` | `(usucod, telachave)` | 30-60 s | Invalidar ao salvar `usu_telas` | Baixo-médio (revogação demora até TTL) | Memória no processo |
| Service Worker | Shell estático + imagens + uploads | `stale-while-revalidate` 7 d | `OU_SW_VERSION` a cada release | Baixo para estáticos | `public/sw.js` |
| HTTP `/uploads/*` | Logos/imagens | 7-30 d + ETag | Nome do arquivo muda no upload (slug/timestamp) | Baixo | `src/app.js:41` |
| `/manifest.json` | Manifest | Cachear em memória (ex.: 5 min) e remover fetch interno | Invalidar no `PUT /emp` | Baixo | `src/app.js:413-458` |
| Catálogo (`/v2/pros`) | Já cacheado 30 s + ETag | — | Já invalidado nos writes | — | `src/utils/catalogoCache.js` |
| Vitrines (`/showcases`) | Já cacheado 30 s + ETag | — | Já invalidado nos writes | — | `src/utils/showcasesCache.js` |
| Config de estoque | Já cacheado 30 s | — | `invalidateEstoqueConfigCache` | — | `src/utils/estoqueConfig.js` |

> Nada deve ser implementado nesta etapa. A tabela serve de base para a segunda tarefa.

---

## 9. Imagens

1. **Redimensionamento no upload**: `POST /upload-logo` (`app.js:478-482`) e `save-marca` (`app.js:579-580`) não fazem `.resize()`; geram JPG/PNG no tamanho original. Sugestão: gerar variantes (ex.: 512 px para manifest, 96 px para header, 64 px para favicon) e usar `sharp().resize().webp()`.
2. **Assets de 2,6 MB/3,3 MB** no caminho crítico da home. Mitigação imediata possível: `.resize()` + cache HTTP longo.
3. **Sem `srcset`/`sizes`/`width`/`height`** nos cards; incluir dimensões reduz CLS e permite `lazy` eficaz.
4. **Fallback com 2 requisições**: `/uploads/<slug>.jpg` 404 → CDN (`index.js:114-117`, `brand-logo.js:62`). Pré-validar existência no backend evita a 2ª request.
5. **Formatos legados** (`t1.png` 5,9 MB) não usados no storefront atual — candidatos a remoção/compactação.
6. **Lazy loading presente** nos cards e logos — manter.

---

## 10. Startup

### STARTUP PERFORMANCE (o que roda antes de `app.listen`)

1. **~70+ comandos sequenciais** em `atualizardb.js`, sem paralelismo (a ordem pode ser necessária, mas nada é condicional por versão).
2. **DDL com lock forte a cada boot**: `ALTER TABLE` em `emp`, `pro`, `pv`, `procor`, `par`, `cor`; `DROP TRIGGER` + `CREATE TRIGGER` em `pv`, `pro`, `procor`, `part_groups`; `CREATE OR REPLACE VIEW`; `CREATE OR REPLACE FUNCTION` (8 funções). Mesmo idempotentes, exigem locks e catálogo.
3. **Full scans de reconciliação em todo restart**:
   - `UPDATE pro ... prosemest` (`:1181-1192`)
   - `UPDATE pv ... pvvl` com `LEFT JOIN pvi` + `GROUP BY` (`:1200-1212`)
   - `UPDATE par ... regexp_replace` telefone e CEP (`:1341-1355`)
   - `UPDATE cli_conta ... SUM(cli_mov)` (`:1441-1449`)
   - `UPDATE usu ... usupv/usuest` com `EXISTS` (`:1585-1608`)
   - `UPDATE procor/pro ...` de reconciliação de grupos (`:1159-1175`)
4. **Loop `for (const tela of TELAS)`** com um `INSERT ... ON CONFLICT` por tela (`:1506-1526`).
5. **Advisory lock + "transação" via `pool.query`** (`:9-11`, `:1614`, `:1621`): sem `client` fixo, o `COMMIT`/`UNLOCK` pode cair em conexão diferente. Se o `UNLOCK` falhar/não executar, o lock permanece na sessão original e um segundo processo/restart pode bloquear no `pg_advisory_lock`.
6. **Sem migrations versionadas**: não há controle de "já apliquei"; tudo roda sempre (o `app_migrations` existe apenas para duas migrações específicas de telas).

### RUNTIME PERFORMANCE

- Servidor single-process (sem cluster/PM2/`node --max-old-space-size`), atrás de systemd (`deploy-ssh.yml` chama scripts remotos).
- `morgan` ativo sempre; log de performance e slow query desligados (`REQUEST_LOGGING` comentado no `.env`; `LOG_SLOW_QUERIES_MS` ausente).
- Docker sem `NODE_OPTIONS`, sem healthcheck, sem limite de memória explícito.

---

## 11. Performance por rota (estimativa por leitura de código)

| Rota | Método | Objetivo | Queries estimadas | Gargalos | Payload potencial | Cache possível | Paginação | Risco |
|---|---|---|---|---|---|---|---|---|
| `/` | GET | Home HTML | 0 | HTML no-cache; assets pesados | Baixo | HTTP para assets | — | Médio |
| `/emp` | GET | Dados da empresa | 1 | 3x na mesma página (front) | Baixo | Sim (60 s) | — | Baixo |
| `/showcases` | GET | Vitrines | 4-6 na miss | Loop sequencial; `listarMaisVendidos` histórico completo | Médio | Já tem (30 s+ETag) | — | Alto |
| `/modelos` | GET | Lista modelos | 1 | `select * from vw_modelos`; sem paginação; chamado por tecla | Médio-alto | Sim | Não | Alto |
| `/pro/:id` | GET | Peças por marca/modelo/tipo | 1 | `DISTINCT` + `OR` + flags; `ORDER BY proordem` sem índice | Médio | Sim | Não | Médio |
| `/pros` | GET | Catálogo paginado do painel | 1-2 | `ILIKE` sem trigram; flags no `COUNT`; branch sem paginação | Alto | Não | Sim (cap 200) | Médio |
| `/v2/pros` | GET | Catálogo completo | 1 (miss) | Query pesada; cache invalidado por qualquer escrita | Alto | Sim (30 s+ETag) | Não | Médio |
| `/proComEstoque`, `/proSemEstoque` | GET | KPIs/estoque | 1 cada | Sem paginação; `CASE` no WHERE | Alto | Sim | Não | Médio |
| `/pro/painel/:id` | GET | Peça individual | 1 | Flags caras | Baixo | Não | — | Baixo |
| `/pedidos/pendentescount*` | GET | KPIs dashboard | 1 cada | 8 endpoints; 4 com `'now()'` inválido | Baixo | Sim (10-30 s) | — | Alto (corretude + série) |
| `/pedidos/confirmados` | GET | Lista confirmados | 1 | Sem paginação; `BETWEEN` 1900-2999; GROUP BY | Alto | Não | Não | Alto |
| `/pedidos/pendentes` | GET | Lista pendentes | 1 | idem | Alto | Não | Não | Alto |
| `/pedidos/listar` | GET | Lista simples | 1 | Sem paginação/data | Médio | Não | Não | Médio |
| `/pedido/detalhe/:pvcod` | GET | Detalhe | 1 | ok | Baixo | Não | — | Baixo |
| `PUT /pedidos/confirmar/:pvcod` | PUT | Confirma + baixa estoque | 1 + N updates + trigger | Transação longa, locks, trigger por item | Baixo | Não | — | Alto |
| `PUT /pedidos/confirmados/:pvcod/itens` | PUT | Edita itens | até ~7 por item | N+1 + `FOR UPDATE` + transação longa | Baixo | Não | — | Alto |
| `POST /pedidos/enviar` | POST | Cria pedido | 2 | Sem auth; sem transação | Baixo | Não | — | Alto (segurança) |
| `/cli` | GET | Clientes paginado | 2 (count+dados) | Correlated subqueries; telefone não-sargável | Médio | Sim | Sim (cap 200) | Médio |
| `/cli/:id/conta` | GET | Resumo financeiro | 4 | Sequenciais | Baixo | Curto TTL | — | Baixo |
| `/cli/:id/pedidos` | GET | Pedidos do cliente | 1 | Sem LIMIT | Alto | Não | Não | Médio |
| `/cli/:id/movimentacoes` | GET | Extrato | 1 | Cap 500; índice parcialmente inútil p/ ORDER | Médio | Não | Cap | Baixo |
| `/devolucoes/itens` | GET | Busca itens vendidos | 1 | CTEs full-scan; casts ILIKE | Alto | Não | LIMIT 100 | Alto |
| `/get/estoqueItens` | GET | Estoque | 1 | Sem paginação; join suspeito | Alto | Sim | Não | Médio |
| `/part-groups` | GET | Grupos | 1 + permissão | GROUP BY grande, sem paginação | Médio | Curto TTL | Não | Médio |
| `/part-groups/available-part` | GET | Busca peças p/ grupo | 2 (`Promise.all`) | ILIKE sem índice; limit sem teto | Alto | Não | Offset livre | Médio |
| `/v2/relatorios/top-pecas` | GET | Relatório | 1 | Sem LIMIT; CTEs históricas | Alto | Não | Não | Alto |
| `/v2/relatorios/top-pecas/pdf` | GET | PDF | 1 + CPU | Tudo em memória; event loop bloqueado | Alto | Não | Não | Alto |
| `/v2/relatorios/top-pecas/xls` | GET | Excel | 1 + CPU | idem | Alto | Não | Não | Alto |
| `/v2/relatorios/pecas-cadastradas` | GET | Relatório | 1 | Sem LIMIT; `LOWER LIKE` | Alto | Não | Não | Alto |
| `/dash` | GET | Dashboard | 17 requests (12 série) | KPIs em série; dados completos p/ contagem | Médio | Sim (KPIs 30 s) | — | Alto |
| `/auth/login` | POST | Login | 2-3 | Sequenciais; MD5 | Baixo | Cache `emp` | — | Baixo |
| `PUT /emp` | PUT | Config empresa | 1 | invalida caches; reload completo no front | Baixo | — | — | Baixo |

---

## 12. N+1 — investigação específica

| # | Arquivo / função | Trecho | Queries por item | Solução estrutural possível |
|---|---|---|---|---|
| N1 | `public/html/auth/js/painel-pedidos.js:591-608` | `dados.forEach(...) { ...; atualizarTotaisPedidos(); }` e `atualizarTotaisPedidos` faz 4 `jget` (`:181-186`) | 4N (ex.: 100 pedidos = 400 requests) | Chamar 1x após o loop; ou 1 endpoint agregado |
| N2 | `src/controllers/pedidosController.js:736-895` (`editarItensPedidoConfirmado`) | `for (const item of itens)` com SELECT item + SELECT grupo `FOR UPDATE` + 3-4 UPDATEs + INSERT audit + UPDATE pvi | até ~7 por item | Processar em lote (`UPDATE ... FROM unnest`), reduzir `FOR UPDATE`, encurtar transação |
| N3 | `src/controllers/pedidosController.js:457-511` (`confirmarPedido`) | `for (const item of itens)` com 1 UPDATE por item | 1 por item | `UPDATE ... FROM unnest($1::int[], ...)` |
| N4 | `src/models/partGroupModels.js:1197-1273` (`venderItens`) | `for (const item of itens)` com `SELECT ... FOR UPDATE` | 1 + updates por item | **Código legado não montado**; se reativado, refatorar para lote |
| N5 | `src/models/partGroupModels.js:1361-1380`, `:1415-1458` | INSERT de auditoria e UPDATE por peça em loops | N por grupo | `INSERT ... SELECT unnest`, `UPDATE ... FROM (VALUES ...)` |
| N6 | `src/controllers/showcaseController.js:61-81` | `for (const showcase of showcases) await listarMaisVendidos/listarNovidades` | 1 por vitrine (mín. 2) | `Promise.all` por vitrine (independentes) |
| N7 | `src/controllers/showcaseController.js:131-151` (admin) | idem em loop | 1-2 por vitrine | idem |
| N8 | `src/models/partGroupModels.js:604-607` | SELECT `prodes` extra logo após INSERT | 1 extra | `INSERT ... RETURNING` + join |
| N9 | `public/html/auth/js/painel-produto.js:224-235` | `for (const corcod of corIds) await fetch(POST ...)` | N POSTs | Endpoint em lote ou `Promise.all` |
| N10 | `public/html/auth/js/painel-clientes.js` (várias linhas) | recargas encadeadas (`carregarConta` → `carregarMovimentacoes` → `carregarClientes`) | 3 em série | `Promise.all` |

---

## 13. Request chains (cadeias)

### Frontend

1. **Checkout do carrinho** (`public/js/carrinho.js:400-441`):
   `GET /pedidos/sequencia` → (dentro do POST) `GET /usuario/viuversao` → `POST /pedidos/enviar` → `GET /emp` → WhatsApp.
   4 RTTs em série; `/emp` não depende do POST e poderia ser buscado antes/em paralelo; `/usuario/viuversao` poderia ser resolvido antes do clique.
2. **Registrar pedido** (`carrinho.js:583-607`): mesma cadeia `:595 → :596`.
3. **Load do carrinho** (`carrinho.js:652-665`): `/emp` → `/me/usuario` (dependente por encadeamento de promessa, mas independentes entre si).
4. **Dashboard** (`painel-dashboard.js:766-798`): 12 GETs em série; depois `loadPeriodCharts` dispara 4 em paralelo.
5. **Configurações**: `/emp` (3x) + `/me/usuario` + `/me/permissoes` + `/usuario/viuversao` + `/usuario/viutourmenu/`.

### Backend

1. `POST /pedidos/enviar` → `inserirPv` → `next()` → `inserirPvi` (2 round-trips, sem transação).
2. `GET /manifest.json` → `fetch /emp` interno.
3. `PUT /part-groups/:id/stock` → `updateGroupStock` (transação 1) → `updateAllPartsStockInGroup` (transação 2, nova conexão).
4. `GET /showcases` (miss) → `listarShowcases` → `getEstoqueConfig` → `listarItensShowcase` → loop por vitrine (`listarMaisVendidos`/`listarNovidades`).
5. Login não-admin → `usu` → `emp` → `resolverRotaInicial` (`usu_telas`).

---

## 14. Duplicidade

| Tipo | Ocorrência |
|---|---|
| Mesmo SQL em arquivos diferentes | `listarProdutosComEstoque/SemEstoque` em `proController.js:645-707` e `proModels.js:48-98`; `listarPv` em `pedidosController.js:161-200` e `pedidoModels.js:148-178` |
| Regra "vendas − devoluções" reimplementada | `showcaseModels.js:128-147`; `relatoriosModels.js:58-105`, `:243-278`; `devolucoesController.js:53-66` |
| Login duplicado | `loginController.validarLogin` e `usuarioController.validarLogin` |
| Listagem de usuários | `usuarioController.js:174-195`, `usuarioModels.js:7-10`, `usuarioController2.js:3-11` |
| Contagens de pedidos | 8 endpoints em `pedidosController.js:202-309` |
| View agregada recomputada | `vw_tipo_pecas` usada em `tipoController` e `modeloController` |
| Frontend | `/emp` 3x; `/marcas` 2x (painel/relatórios); `/tipos` 3x (painel); badge/toast/`adicionarAoCarrinho` redefinidos em 4 arquivos |
| Código morto/legado que ainda pesa no boot | `venderItens`/`validarEDecrementarEstoque` (não montados), `decrementGroupStock`/`incrementGroupStock` |

---

## 15. Medição e instrumentação

### O que já existe e está bom

- `requestTimingMiddleware` (`src/middlewares/performanceMiddleware.js`) — métrica simples de duração por request, ativável por env.
- Log de queries lentas no pool (`src/config/db.js:27-48`) via `LOG_SLOW_QUERIES_MS`, medindo apenas `pool.query` (não cobre `client.query` de transações).
- `compression()`, ETag nos caches, TTL configurável (`CATALOGO_CACHE_TTL_MS`, `SHOWCASES_CACHE_TTL_MS`), `statement_timeout` configurável.

### O que falta

- `REQUEST_LOGGING` está **comentado** no `.env` e `LOG_SLOW_QUERIES_MS` não está definido → na prática, nenhuma métrica é coletada hoje.
- Log de slow query não cobre queries feitas via `client.query` (transações e triggers são invisíveis).
- Não há contador de queries por request, tamanho de resposta, nem percentis.
- Não há `pg_stat_statements` citado no projeto, nem `auto_explain`.

### Como transformar a instrumentação em ferramenta real de profiling

1. Habilitar em ambiente de teste/homologação: `REQUEST_LOGGING=true`, `LOG_SLOW_QUERIES_MS=200`.
2. Envolver `pg.Pool.prototype.query` **e** `client.query` com medição e contador por request (via `AsyncLocalStorage`), emitindo: rota, método, status, `app_ms`, `sql_ms`, `sql_count`, `bytes` da resposta.
3. Habilitar `pg_stat_statements` no PostgreSQL (extensão) e `auto_explain` com `log_min_duration_statement` para capturar queries de triggers/transações.
4. Expor/coletar p50/p95/p99 por rota com `autocannon --latency` ou k6 (`http_req_duration`), guardando histórico por release.
5. Criar baseline por release e alertar em regressão (ex.: p95 da home e de `/pedidos/confirmados`).

---

## 16. Teste de carga — cenários propostos

> Não executar carga destrutiva. Todos os cenários abaixo usam dados de teste e ambiente isolado; escrita (`/pedidos/enviar`, confirmar/cancelar) só em base descartável.

Ferramentas sugeridas: `autocannon` (rápido, CLI), `k6` (cenários e thresholds), `wrk` (saturação).

| Cenário | Alvo | Perfil | Duração | O que observar |
|---|---|---|---|---|
| C1 | `GET /` + assets | 10/25/50/100 usuários | 2 min cada | TTFB da home, transferência, cache hit de assets |
| C2 | `GET /showcases` | 25/50 | 2 min | Hit do `showcasesCache`, latência no miss, queries/req |
| C3 | `GET /modelos` (busca) | 10 usuários simulando digitação | 2 min | Nº de requests, latência, CPU do servidor |
| C4 | `GET /pros?page=N` e `/v2/pros` | 25/50 | 2 min | p95, uso de pool, hit do catálogo |
| C5 | `GET /pedidos/confirmados` e `/pendentes` | 25 | 2 min | Buffer/sort, payload, tempo de query |
| C6 | `GET /cli?page=N` | 25 | 2 min | count + subqueries, latência em páginas altas |
| C7 | `GET /v2/relatorios/top-pecas` (+PDF/XLS 1x) | 5 | 1 min | Memória, event loop lag, tempo de geração |
| C8 | `GET /dash` (17 requests) | 10/25 | 2 min | Tempo até o dashboard "pronto", saturação de pool |
| C9 | `PUT /pedidos/confirmar/:pvcod` | 5 usuários, base descartável | 1 min | Locks, tempo da transação, pool em uso |
| C10 | Startup | 1 restart | — | Tempo de boot, locks (`pg_locks`), queries do `atualizardb` |

Thresholds iniciais sugeridos (a validar com o time): p95 < 500 ms para leitura, p95 < 1.5 s para dashboard completo, 0 erros 5xx, pool `waitingCount` ~0.

---

## 17. Escalabilidade — o que provavelmente acontece

### Quando o número de produtos crescer
- `/pros` (sem paginação no branch default), `/proComEstoque`, `/proSemEstoque` e `proModels.*` **retornam cada vez mais linhas** e recalculam `DISTINCT` + `string_agg` + flags por linha. Payload e CPU crescem linearmente.
- O `COUNT(*)` do catálogo reavalia as flags (`EXISTS` aninhados) por linha.
- A reconstrução do `catalogoCache` (25 MB de JSON no cache a cada invalidação, se o catálogo crescer) aumenta pressão de memória e CPU.
- `pro.prodes ILIKE` sem trigram piora a busca do painel.

### Quando o número de clientes crescer
- `/cli` fica mais caro por causa das 2 subqueries correlacionadas por linha e do `COUNT(*)` + dados em série; OFFSET alto degrada.
- `/devolucoes/itens` já faz full scan de `pvi`/`devolucoes` antes de filtrar.

### Quando o número de pedidos crescer
- `listarMaisVendidos` (vitrines) agrega **todo** o histórico a cada cache miss — o item de maior risco de degradação progressiva.
- `/pedidos/confirmados` e `/pendentes` com `BETWEEN 1900-01-01 AND 2999-12-31` varrem todo o histórico e devolvem tudo sem paginação.
- `GET /dash` que já faz 12 chamadas em série passa a somar queries de count sobre tabelas maiores.
- Triggers de confirmação/cancelamento percorrem itens; pedidos maiores (mais itens) alongam a transação e o tempo com locks.

### Quando os usuários simultâneos crescerem
- Pool `max: 10` com transações longas pode esgotar; `connectionTimeoutMillis: 5000` fará requests falharem sob pico.
- Cada request autenticada custa 2 operações JWT (verify+sign) e cada rota de tela custa 1 query extra (`requireTela`), ampliando CPU e I/O por usuário.
- Dashboard multiplica por 17 o custo de abertura de uma única tela.
- Node single-process: PDF/Excel e serializações grandes bloqueiam o event loop e afetam todos os usuários.

---

## 18. Plano de otimização

> Nenhuma alteração foi feita. Itens marcados "migration" e "API" referem-se à eventual segunda tarefa.

### P0 — crítico

| # | Problema | Evidência | Impacto estimado | Risco | Solução sugerida | Arquivos | Migration | API | Frontend |
|---|---|---|---|---|---|---|---|---|---|
| P0-1 | Startup refém de `atualizardb` com full scans, DDL e lock sem conexão fixa | `app.js:610-614`; `atualizardb.js:9-11`, `:1181-1212`, `:1341-1355`, `:1441-1449`, `:1614`, `:1621` | Alto (boot + bloqueio de escrita a cada restart) | Alto se lock vazar | Separar migrations do boot; usar `client = pool.connect()` para lock/BEGIN/COMMIT; controlar versão em `app_migrations`; rodar reconciliações fora do caminho de boot | `src/config/atualizardb.js`, `src/app.js` | Sim (controle de versão) | Não | Não |
| P0-2 | Vitrine "Mais vendidos" agrega histórico completo | `showcaseModels.js:125-162` | Alto e crescente | Médio (stale se janela) | Janela temporal + agregação periódica/materializada; remover `TRIM` | `src/models/showcaseModels.js` | Talvez (tabela de ranking) | Não | Não |
| P0-3 | Relatórios/PDF/XLS sem limite, em memória, bloqueando event loop | `relatoriosModels.js:58-295`; `relatoriosController.js:42-413` | Alto sob volume | Médio | `LIMIT` + paginação; geração assíncrona/job; streaming real | models/controllers de relatórios | Não | Possível (query params) | Sim (download assíncrono) |
| P0-4 | N+1 no frontend de pedidos (4N requests) | `painel-pedidos.js:591-608`, `:181-186` | Alto por tela | Baixo | Chamar totais 1x fora do loop; consolidar endpoint | `painel-pedidos.js` (+ backend se consolidar) | Não | Talvez | Sim |
| P0-5 | Dashboard com 12 chamadas sequenciais + counts defeituosos | `painel-dashboard.js:766-798`; `pedidosController.js:217`, `:241`, `:266`, `:302` | Alto (TTFB do dashboard) | Baixo | `Promise.all` + 1 endpoint agregado com `COUNT(*) FILTER`; corrigir `'now()'` para `CURRENT_DATE` | `painel-dashboard.js`, `pedidosController.js`, `pedidosRoutes.js` | Não | Sim (novo agregado) | Sim |
| P0-6 | Rotas de escrita sem autenticação (`/pedidos/enviar`, `/save-marca`) | `pedidosRoutes.js:8-12`; `app.js:523-603` | Alto (abuso/DoS de CPU e dados) | Alto de segurança | Aplicar `autenticarToken`/`requireAdmin` | rotas/app | Não | Não | Sim (enviar cookie) |
| P0-7 | Assets de 2,6 MB/3,3 MB no caminho crítico e `/uploads` sem cache | medição `ls`; `app.js:41`; `app.js:478-482` | Alto na home (rede) | Baixo | Redimensionar no upload; gerar variantes; `maxAge` em `/uploads`; favicon próprio | `src/app.js` | Não | Não | Não |

### P1 — alto impacto

| # | Problema | Evidência | Impacto estimado | Risco | Solução sugerida | Arquivos | Migration | API | Frontend |
|---|---|---|---|---|---|---|---|---|---|
| P1-1 | Buscas não-sargáveis anulando índices (`'now()'`, `::date`, `extract`, `TRIM`, `LOWER LIKE`, `procod::text`) | `pedidosController.js:217/241/254/266/302`; `pedidoModels.js:110/136`; `showcaseModels.js:133/143`; `devolucoesController.js:33-34/89`; `relatoriosModels.js:168`; `partGroupModels.js:974` | Alto (índices existentes ignorados) | Baixo | Reescrever predicates; criar índices funcionais quando necessário | controllers/models citados | Talvez (índices) | Não | Não |
| P1-2 | Listagens de pedidos sem paginação e com full range de datas | `pedidosController.js:311-419` | Alto e crescente | Médio (contrato) | Paginação por cursor/offset + filtro default | `pedidosController.js` | Não | Sim | Sim |
| P1-3 | Busca da home baixa catálogo inteiro por tecla | `index.js:254-295`; `modeloController.js:128-136` | Alto (rede+CPU+DB) | Baixo | Debounce 250-300 ms + `AbortController` + busca server-side paginada | `public/js/index.js`, `modeloController.js` | Não | Sim (query `q`) | Sim |
| P1-4 | Catálogo duplicado/pesado (`proModels` + `proController`) sem paginação | `proModels.js:21-367`; `proController.js:645-707` | Alto | Médio | Unificar em 1 model; paginar; cachear | models/controllers | Não | Sim | Sim |
| P1-5 | `/devolucoes/itens` agrega todo `pvi`/`devolucoes` | `devolucoesController.js:52-96` | Alto | Médio | Empurrar filtros para dentro das CTEs; janela de data | `devolucoesController.js` | Talvez (índices) | Não | Não |
| P1-6 | `requireTela` 1 query/request e JWT verify+sign em toda request | `telaMiddleware.js:47-58`; `middlewares.js:11-37`; 4 admin middlewares | Médio-alto por request | Baixo | Cache de permissões (30-60 s); centralizar/renovar token só quando necessário | middlewares | Não | Não | Não |
| P1-7 | `/emp` buscado até 3x por página; `/manifest.json` com fetch interno | `nomeEmpresa.js:11`; `configWhatsapp.js:29`; `configEstoque.js:38`; `carrinho.js:652/359`; `app.js:420` | Médio | Baixo | Memoizar no cliente; cachear `/emp` no servidor; manifest sem fetch interno | public js; `app.js` | Não | Não | Sim |
| P1-8 | Docker copia `node_modules`/`.git`/`.env` (sem `.dockerignore`), Node 18 EOL | `Dockerfile:13-14`; ausência de `.dockerignore` | Médio-alto (build/imagem) | Baixo | Criar `.dockerignore`, remover cópia de `.env`, atualizar Node para LTS | `Dockerfile`, `.dockerignore` | Não | Não | Não |
| P1-9 | Counts + dados sequenciais em `proController`/`cliController`/`resumoConta`/`getGroupById` | `proController.js:137-148`; `cliController.js:151-167`, `:440-466`; `partGroupModels.js:49-102` | Médio | Baixo | `Promise.all` ou 1 query com `FILTER`/`json_agg` | controllers/models | Não | Não | Não |

### P2 — médio impacto

| # | Problema | Evidência | Solução sugerida |
|---|---|---|---|
| P2-1 | Service Worker inerte | `public/sw.js:26-28` | Implementar cache de shell/imagens com `stale-while-revalidate` e versionamento por release |
| P2-2 | Assets não usados (FA4, jQuery/Popper, Sortable em páginas sem uso) e sem `defer`/`preconnect` | HTMLs citados | Remover por página; adicionar `defer` e `preconnect` para CDNs |
| P2-3 | `innerHTML +=` em loops no painel | `painel.js:88-99`, `:1304`, `:3114-3127`, `:3474` | Acumular string/fragmento e inserir 1x |
| P2-4 | Listeners acumulados e submit duplo | `painel-produto.js:75/129`; `painel-marca.js:16-60/67-125` | `addEventListener` uma vez; unificar handler |
| P2-5 | `painel-estoque` baixa `/v2/pros` inteiro e filtra local | `painel-estoque.js:93-120` | Usar `/pros` paginado com `q` |
| P2-6 | Filtros locais sem debounce | part-groups, clientes, backups, lista-pecas | Debounce + cache de normalização (municípios) |
| P2-7 | Reloads completos e `setInterval` sem cleanup | `painel-pedidos.js` etc.; `painel.js:3752-3757` | Atualização parcial de DOM; limpar intervalos |
| P2-8 | `syncCartParam` na URL sem leitor | `carrinho.js:101-116` | Remover ou implementar leitura |
| P2-9 | `morgan` sempre ativo; profiling desligado | `app.js:67`; `.env` | Desligar/condicionar `morgan`; habilitar profiling em homologação |
| P2-10 | Sem `.resize()`/WebP em uploads de marca | `app.js:579-580` | Resize + WebP + variantes |

### P3 — melhoria futura

| # | Problema | Evidência | Solução sugerida |
|---|---|---|---|
| P3-1 | Queries duplicadas entre model/controller e regra de vendas reimplementada 4x | itens da seção 14 | Extrair para um único model/repositório |
| P3-2 | `getAvailablePart`/auditoria com limits sem teto | `partGroupModels.js:867-982` | Validar cap no controller (já existe padrão em outras rotas) |
| P3-3 | Índices em colunas de ordenação ausentes | seção 5 (S13) | Avaliar índices com `EXPLAIN` antes de criar |
| P3-4 | Processo único sem limite de memória/healthcheck | `Dockerfile` | `NODE_OPTIONS`, healthcheck, observar RSS |
| P3-5 | `COUNT`/`OFFSET` em páginas altas | cli/pro | Keyset pagination |
| P3-6 | Código legado de grupos (`venderItens` etc.) mantido | `partGroupModels.js:1175-1489` | Remover ou isolamento explícito se obsoleto |

---

## Apêndice A — Consultas para a etapa de medição

Executar em ambiente de teste/homologação, nunca em produção sob carga:

```sql
-- 1) Queries mais custosas por tempo total (requer pg_stat_statements)
SELECT calls, total_exec_time, mean_exec_time, rows, query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 30;

-- 2) Tabelas com mais full scans
SELECT relname, seq_scan, seq_tup_read, idx_scan, n_live_tup
FROM pg_stat_user_tables
ORDER BY seq_tup_read DESC
LIMIT 30;

-- 3) Índices não utilizados
SELECT relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY relname;

-- 4) Locks de startup
SELECT locktype, mode, granted, pid, objid
FROM pg_locks
WHERE locktype IN ('advisory','relation')
ORDER BY granted;
```

`EXPLAIN` prioritários (um por vez, ambiente de teste):

1. `listarMaisVendidos` — `src/models/showcaseModels.js:125-162`
2. `buscarItensVendidos` — `src/controllers/devolucoesController.js:52-96`
3. `getTopPecas` (peca e grupo) — `src/models/relatoriosModels.js:58-135`
4. `proModels.listarTodosProdutos` — `src/models/proModels.js:21-46`
5. `proModels.listarProdutosComEstoque` — `:48-72`
6. `count(*)` do catálogo — `src/controllers/proController.js:137-140`
7. `cliController.list` (com `q` e com telefone) — `src/controllers/cliController.js:151-167`
8. `listarPvPendentesCountNow` (provar literal inválido) — `src/controllers/pedidosController.js:216-218`
9. `listarPvConfirmados` sem filtro de data — `:320-357`
10. `partGroupModels.listGroups` — `src/models/partGroupModels.js:22-42`
11. `getAvailablePart` com busca — `:867-955`
12. Trigger de confirmação — `EXPLAIN (ANALYZE, BUFFERS) UPDATE pv SET pvconfirmado='S' WHERE pvcod = <teste>` em base descartável

Formato: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)`; registrar plano, tempo e buffers por release.

---

## Apêndice B — Inventário de índices existentes (código)

- `pv`: `idx_pv_sta`, `idx_pv_confirmado`, `idx_pv_dtcad`, `idx_pv_rcacod`, `idx_pv_canal`, `idx_pv_parcod`
- `pvi`: `idx_pvi_pvcod`, `idx_pvi_procod`
- `pro`: `idx_pro_marcas`, `idx_pro_tipo`, `idx_pro_sit`, `idx_pro_semest`, `idx_pro_acabando`, `idx_pro_part_group_id`
- `promod`: `idx_promod_procod`, `idx_promod_modcod`
- `procor`: `uq_procor_procod_corcod`, `uq_procor_procod_sem_cor`
- `par`: `idx_par_des_trgm`, `idx_par_fan_trgm` (GIN trigram)
- `devolucoes`: `idx_devolucoes_pedido`, `idx_devolucoes_data`
- `devolucao_itens`: `idx_devolucao_itens_busca`, `idx_devolucao_itens_devolucao`
- `part_group_audit`: `idx_part_group_audit_group_id`
- `part_group_items`: `idx_part_group_items_group_id`, `idx_part_group_items_procorid`
- `cli_mov`: `idx_cli_mov_parcod (movparcod, movdtcad DESC)`
- `cli_cobranca`: `idx_cli_cobranca_parcod (cobparcod, cobsta)`, `idx_cli_cobranca_pvcod`
- `usu_telas`: `idx_usu_telas_usucod`
- `home_showcases`: `idx_home_showcases_active_position`; `home_showcase_items`: `idx_home_showcase_items_showcase`, `idx_home_showcase_items_procod`
- `system_releases`: índice em `published_at`

Referências: `src/config/atualizardb.js:1231-1261`, `:1313-1323`, `:1378`, `:1412-1435`, `:1492`; `src/config/showcasesSchema.js:41-49`; `src/config/releasesSchema.js:33-38`.

---

**Fim do relatório.** Nenhum arquivo de código foi alterado. Este documento é o único artefato criado.
