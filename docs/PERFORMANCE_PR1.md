# Performance PR1

Implementação da primeira etapa da auditoria (`docs/PERFORMANCE_AUDIT.md`): correções de alto impacto e baixo/médio risco, sem alterar regras de negócio, schema, migrations ou arquitetura.

## Problemas corrigidos

1. **`pvdtcad = 'now()'` (literal inválido) em 4 endpoints de KPI** — os counts "Now" nunca filtravam o dia atual (e tendiam a erro/zero) e não usavam `idx_pv_dtcad`. Trocado por `CURRENT_DATE`.
2. **`pvdtcad::date = CURRENT_DATE`** em `listarPvVendaNow` e `totalVendasDia` — cast na coluna impedia uso de índice; coluna é `date`, então o cast era desnecessário.
3. **`pedidoModels.listarPv()` usava `$1` sem parâmetros** — a rota `GET /v2/pedidos/listar` sempre falhava. Agora o controller envia `req.token.usucod` e a query segue parametrizada.
4. **Rota `usuarioRoute2.js` sem `/` inicial** — `router.post('api/v2/usuario/excluir/:id')` nunca era montada. Corrigido para `/api/v2/usuario/excluir/:id`.
5. **N+1 no painel de pedidos** — `atualizarTotaisPedidos()` era chamado dentro do `forEach` de pedidos (4 requests por pedido). Passou para uma única chamada após o loop.
6. **Dashboard com 12 `await` sequenciais** — todas as chamadas eram independentes. Agora em um único `Promise.all` (KPIs, clientes, vendedores, marcas, estoque e produtos).
7. **`/emp` duplicado no frontend** — nova função memoizada `window.obterDadosEmpresa()` em `nomeEmpresa.js`, reutilizada por `configWhatsapp.js`, `configEstoque.js`, `carrinho.js` e `painel.js`.
8. **`/me/usuario` duplicado no dashboard** — o shell agora expõe `window.ouObterUsuario()` (promise memoizada) e o dashboard reutiliza a mesma chamada.
9. **`/manifest.json` fazia chamada HTTP interna para `/emp`** — agora lê direto de `src/utils/empresaCache.js` (mesma fonte do `/emp`, com cache curto de 60 s e invalidação no PUT).
10. **Listener acumulado no modal de produto** — o `click` de `#dropdownProduto` registrava `change` e `click` extras a cada abertura (crescendo o número de fetches de cores). Trocado por `onchange` idempotente e removida a reinscrição; cores carregam 1x por abertura.
11. **Submit duplicado no cadastro de marca** — existiam dois handlers de `submit` no mesmo form, disparando `POST /marcas` e `POST /save-marca` de forma independente/paralela. Agora há um único handler que executa o cadastro e depois o envio da imagem, em sequência.
12. **Busca da home disparava `GET /modelos` a cada tecla** — adicionado debounce de 300 ms (respostas obsoletas continuam descartadas pelo `buscaToken`).
13. **POSTs de cores no cadastro de produto eram sequenciais** — viraram `Promise.all` (uma espera em vez de N).
14. **`/uploads` sem `Cache-Control` explícito** — arquivos estáveis (logo/marca) revalidavam com `max-age=0`; agora usam `public, max-age=60, must-revalidate` + ETag (cache curto, seguro para URLs que são sobrescritas).
15. **Imagens de upload sem redimensionamento** — `sharp` passou a limitar logo a 512 px (ícone 180 px) e logos de marca a 256 px, com auto-orientação EXIF, mantendo qualidade visual no uso real.

## Arquivos alterados

Backend:
- `src/app.js` (cache `/uploads`, manifest sem fetch interno, resize no upload de logo/marca)
- `src/controllers/empController.js` (usa `empresaCache`, invalida no PUT)
- `src/controllers/pedidosController.js` (CURRENT_DATE)
- `src/controllers/pedidosControllerV2.js` (envia `usucod` para `listarPv`)
- `src/models/pedidoModels.js` (parâmetro de `listarPv`; `totalVendasDia` sem cast)
- `src/routes/usuarioRoute2.js` (barra inicial)
- `src/utils/empresaCache.js` (novo)

Frontend:
- `public/js/nomeEmpresa.js`, `public/js/configWhatsapp.js`, `public/js/configEstoque.js`, `public/js/carrinho.js`, `public/js/index.js`
- `public/html/auth/js/componentes.js`, `painel-dashboard.js`, `painel-pedidos.js`, `painel-produto.js`, `painel-marca.js`, `painel.js`

Testes/documentação:
- `tests/performancePR1.test.js` (novo)
- `package.json` (script `test:pr1`)
- `docs/PERFORMANCE_PR1.md` (este arquivo)

## Antes

- KPIs "hoje" consultavam `pvdtcad = 'now()'` (nunca correspondiam ao dia) ou `pvdtcad::date`.
- `GET /v2/pedidos/listar` retornava 500 (`there is no parameter $1`).
- A rota `POST /api/v2/usuario/excluir/:id` não existia de fato (caminho sem `/`).
- Cancelar um pedido com N linhas disparava 4N requests de totais; o dashboard abria com 12 requisições em fila.
- `/emp` era buscado 3x em configurações, 2x no carrinho e novamente no checkout; `/manifest.json` chamava `/emp` por HTTP dentro do próprio servidor.
- A busca da home baixava a lista completa de modelos a cada tecla; o modal de produto acumulava listeners a cada abertura; o formulário de marca tinha 2 submits concorrentes.
- `/uploads` era servido com `Cache-Control: public, max-age=0`; logos de 2,6 MB/3,3 MB eram entregues como enviados.

## Depois

- KPIs usam `CURRENT_DATE` (sargável, mesmo resultado do dia).
- `listarPv` recebe `pvrcacod` por parâmetro preparado; rota V2 volta a responder.
- A rota de exclusão de usuário está montada corretamente.
- Totais de pedidos: 1 chamada por render (4 requests fixos, não 4N).
- Dashboard: 12 chamadas independentes em 1 lote paralelo (total de requests permanece 17 por tela).
- `/emp`: 1 request por página (promise compartilhada); manifest consulta a mesma fonte com cache de 60 s, sem HTTP interno.
- Busca da home: 1 request por pausa de digitação (300 ms).
- Modal de produto: 1 fetch de cores por abertura; `change` de marca idempotente.
- Marca: 1 fluxo de submissão, com erros/validações/estado de loading preservados.
- `/uploads`: `public, max-age=60, must-revalidate` + ETag.
- Novos uploads de imagem são redimensionados (512 px logo, 180 px ícone, 256 px marca).

## Impacto esperado

- **Latência do dashboard**: com 12 chamadas independentes em paralelo, o tempo total deixa de ser a soma das latências e passa a ser próximo da mais lenta (não medido em rede real).
- **Cancelamento/re-render de pedidos**: elimina 4×(N−1) requests e queries de count por render (com 100 pedidos cancelados, de ~400 para 4).
- **Loja pública**: elimina buscas por tecla (`GET /modelos` + varredura de catálogo completo) e reduz requests de `/emp`.
- **Servidor**: manifest deixa de fazer 1 request HTTP interno + 1 query por hit; `/emp` passa a ter cache de 60 s (mesma arquitetura dos demais caches em memória).
- **Rede de imagem**: logos novos ficam limitados a 512/180/256 px; uploads antigos permanecem como estão (ver Riscos).
- **Menu de produto/marca**: elimina crescimento de requests por reabertura de modal e submit duplicado.

## Métricas

Medições realizadas localmente com o servidor real (porta 3100, banco de desenvolvimento). Onde não houve medição, está declarado.

| Métrica | Antes | Depois |
| --- | ---: | ---: |
| Requests dashboard | 17 (12 em série) | 17 (12 em 1 lote paralelo) |
| Requests por pedido (cancelamento) | 4N | 4 |
| Tempo dashboard | Não medido | Não medido |
| Requests home (APIs do navegador) | 3 + self-fetch interno do manifest | 3 + 0 self-fetch interno |
| Tempo `/manifest.json` (cache quente, local) | Não medido | 1,747 ms / 1,364 ms / 1,351 ms (3 amostras) |
| HTTP 200 `/` (cache quente, local) | Não medido | ~4,6 ms |
| `GET /emp` em configurações | 3 | 1 |
| `GET /emp` no carrinho (load + checkout) | 2 + 1 | 1 + 0 (reutiliza a memo) |
| `GET /me/usuario` no dashboard | 2 | 1 |
| `GET /modelos` na busca (5 teclas) | 5 | 1 (após pausa) |
| POSTs de cores no cadastro (N cores) | N sequenciais | N paralelos |
| Fetch de cores ao reabrir modal (N aberturas) | N acumulado | 1 por abertura |
| Submits do formulário de marca | 2 handlers independentes | 1 fluxo controlado (2 chamadas sequenciais necessárias) |
| `Cache-Control` de `/uploads` | `public, max-age=0` | `public, max-age=60, must-revalidate` + ETag |
| `logo.jpg` (bytes) | 2.607.072 (arquivo atual) | Novos uploads ≤ 512 px (arquivo atual inalterado) |
| `apple-touch-icon.png` (bytes) | 3.294.245 (arquivo atual) | Novos uploads 180 px (arquivo atual inalterado) |
| Imagens de marca (bytes) | sem limite | Novos uploads ≤ 256 px |
| `npm test` | 15/15 | 15/15 |
| `npm run test:pr1` | — | 19/19 |

> Observação: tempo de dashboard, tempo de home e tamanho das respostas **não foram medidos** (não houve teste de carga nem rede real). Os números de requests são contagens de código, não capturas de rede.

## Riscos

- **Dashboard em paralelo (12 requisições)**: em picos de muitos dashboards simultâneos, as conexões do pool (`max: 10`) podem saturar. O ganho de latência é real, mas um endpoint agregado deve substituir esse padrão em PR2.
- **`max-age=60` em `/uploads`**: uma logo/marca atualizada pode levar até 60 s para aparecer (ou um hard reload). Escolha conservadora por causa das URLs estáveis.
- **Resize de imagem**: aplica-se apenas a novos uploads; imagens existentes continuam grandes. Se alguma tela exibir logo de marca acima de 256 px, pode haver perda de nitidez (verificado: uso atual é em cards pequenos).
- **`listarPv` (V2)**: passou a filtrar por `pvrcacod` do usuário autenticado, que era a intenção original da query (`pvrcacod = $1`). Não há consumidor no frontend atual; endpoint legado.
- **Fluxo de marca**: se o `POST /marcas` funcionar e o `/save-marca` falhar, a marca fica criada sem a imagem (antes os dois rodavam em paralelo, com o mesmo tipo de resultado parcial). O erro é exibido ao usuário.
- **Cache de empresa (60 s)**: renomear a empresa pode levar até 60 s para refletir em telas que já leram o cache; o PUT `/emp` invalida imediatamente.

## Testes realizados

- `npm test` — suíte existente de grupos de compatibilidade: **15/15**.
- `npm run test:pr1` — nova suíte (stub do pool, sem banco):
  - counts usam `CURRENT_DATE` (sem `'now()'`/`::date`);
  - `listarPv` envia `$1` corretamente;
  - rota `/api/v2/usuario/excluir/:id` registrada;
  - `empresaCache` reutiliza resultado e invalida;
  - guardas estáticas: N+1 de pedidos, `Promise.all` do dashboard, debounce da busca, memoização de `/emp` e `/me/usuario`, manifest sem fetch interno, cache e resize de uploads, listeners/submits duplicados.
- Verificação real com servidor local (porta 3100, banco de desenvolvimento):
  - boot e `GET /` → 200;
  - `GET /uploads/abs.jpg` → 200 com `Cache-Control: public, max-age=60, must-revalidate` e `ETag`;
  - `GET /manifest.json` → 200 com `name: "OrderUp - App"` (dados da empresa) em ~1,4 ms (cache quente).

## Melhorias para PR2

Registradas durante a implementação, fora do escopo desta PR:

- **Backend**
  - Unificar `POST /marcas` + `POST /save-marca` em um único request multipart.
  - Endpoint agregado para os KPIs do dashboard (1 query com `COUNT(*) FILTER`) em vez de 12 requests.
  - Cache de permissões do `requireTela` (query por request).
  - `GET /manifest.json`: revisar `no-store` no browser (hoje o cache é só no servidor).
- **PostgreSQL**
  - `listarMaisVendidos` sem janela temporal; CTEs de devoluções agregando histórico inteiro.
  - Filtros não-sargáveis restantes (`TRIM`, `LOWER LIKE`, `extract`, `procod::text`).
  - Índices ausentes (`pro.prodtcad`, colunas de ordenação) e paginação das listagens de pedidos.
- **Frontend**
  - Concluir a busca server-side paginada da home (hoje ainda baixa todo `/modelos` após o debounce).
  - Remover assets não usados (Font Awesome 4.5, jQuery/Popper em configurações) e adicionar `defer`/`preconnect`.
  - Rebuild completo de listas/tabelas e `innerHTML +=` em loops nos painéis.
  - Filtros locais sem debounce (part-groups, clientes, backups, lista-pecas).
- **Cache**
  - Reprocessar (one-time) as imagens antigas de `/uploads`.
  - Cache HTTP para `/marcas`, `/modelos`, `/tipos`, `/cores` e `/emp`.
  - Service Worker: hoje o handler `fetch` é vazio (não cacheia nada). Não alterado nesta PR por risco de conteúdo stale.
- **Infraestrutura**
  - `.dockerignore` (o build copia `node_modules`, `.git` e `.env`), Node LTS, healthcheck.
- **Observabilidade**
  - Habilitar `REQUEST_LOGGING`/`LOG_SLOW_QUERIES_MS` em homologação, expor queries por request e p95/p99 por rota; `pg_stat_statements`/`auto_explain`.

### Não alterado nesta PR (regra explícita)

- PostgreSQL estrutural, migrations, índices e queries profundas;
- Redis ou cache externo;
- arquitetura, sistema de permissões/login/JWT;
- regras de negócio de pedidos, estoque, grupos, clientes e vitrines;
- estratégia do Service Worker.
