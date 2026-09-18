/**
 * Testes da PR2 de performance (PostgreSQL/API/escalabilidade).
 *
 * Não exigem banco: o módulo src/config/db é substituído por um stub antes de
 * carregar os módulos testados. Também faz checagens estáticas dos arquivos
 * alterados para servir de guarda de regressão.
 *
 * Executar: node tests/performancePR2.test.js
 */

const fs = require("fs");
const path = require("path");

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertiva falhou");
  }
}

async function test(name, fn) {
  testsRun++;
  try {
    await fn();
    console.log(`✅ PASSOU: ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ FALHOU: ${name}`);
    console.log(`   Erro: ${error.message}`);
    testsFailed++;
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

// ---------------------------------------------------------------------------
// Stub do pool
// ---------------------------------------------------------------------------
const dbPath = require.resolve("../src/config/db");
const queries = [];
let responder = () => ({ rows: [], rowCount: 0 });

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (sql, params) => {
      queries.push({ sql, params });
      return responder(sql, params) || { rows: [], rowCount: 0 };
    },
    connect: async () => {
      throw new Error("connect não deve ser usado neste teste");
    },
    on: () => {},
  },
};

const modeloController = require("../src/controllers/modeloController");
const dashboardController = require("../src/controllers/dashboardController");
const estoqueConfig = require("../src/utils/estoqueConfig");
const dashboardRoutes = require("../src/routes/dashboardRoutes");

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function runTests() {
  console.log("\n🧪 Testes PR2 — PostgreSQL/API/escalabilidade\n");
  console.log("=".repeat(50));

  // -------------------------------------------------------------------------
  // Busca server-side de modelos
  // -------------------------------------------------------------------------
  await test("listarTodosModelos filtra no banco com ILIKE e LIMIT parametrizados", async () => {
    queries.length = 0;
    responder = () => ({ rows: [{ modcod: 77, moddes: "A25" }], rowCount: 1 });
    const res = makeRes();
    await modeloController.listarTodosModelos(
      { query: { search: "a25", limit: "50" } },
      res
    );
    assert(queries.length === 1, "deveria executar 1 query");
    const { sql, params } = queries[0];
    assert(sql.includes("WHERE moddes ILIKE $1"), "filtro ILIKE parametrizado ausente");
    assert(sql.includes("LIMIT $2"), "LIMIT parametrizado ausente");
    assert(params[0] === "%a25%" && params[1] === 50, "parâmetros incorretos");
    assert(Array.isArray(res.body) && res.body.length === 1, "resposta inválida");
  });

  await test("listarTodosModelos sem parâmetros mantém o catálogo completo", async () => {
    queries.length = 0;
    responder = () => ({ rows: [], rowCount: 0 });
    const res = makeRes();
    await modeloController.listarTodosModelos({ query: {} }, res);
    assert(queries.length === 1, "deveria executar 1 query");
    assert(
      queries[0].sql.includes("vw_modelos"),
      "sem parâmetros deveria usar a vw_modelos"
    );
    assert(!queries[0].sql.includes("ILIKE"), "não deveria filtrar sem termo");
  });

  await test("listarTodosModelos limita o teto a 200", async () => {
    queries.length = 0;
    responder = () => ({ rows: [], rowCount: 0 });
    await modeloController.listarTodosModelos(
      { query: { search: "a", limit: "9999" } },
      makeRes()
    );
    assert(queries[0].params[1] === 200, "limite deveria ser 200");
  });

  await test("listarTodosModelos aplica limite padrão de 50 na busca", async () => {
    queries.length = 0;
    responder = () => ({ rows: [], rowCount: 0 });
    await modeloController.listarTodosModelos(
      { query: { search: "a25" } },
      makeRes()
    );
    assert(queries[0].params[1] === 50, "limite padrão deveria ser 50");
  });

  // -------------------------------------------------------------------------
  // Dashboard agregado
  // -------------------------------------------------------------------------
  await test("resumo agrega os KPIs em 4 queries paralelas + config", async () => {
    queries.length = 0;
    estoqueConfig.invalidateEstoqueConfigCache();
    responder = (sql) => {
      if (/from emp/i.test(sql)) {
        return { rows: [{ empusaest: "N", empestoqmin: 5 }], rowCount: 1 };
      }
      if (/from pv/i.test(sql)) {
        return {
          rows: [
            {
              pendentes_hoje: "1",
              confirmados_hoje: "2",
              balcao_hoje: "3",
              entrega_hoje: "4",
              venda_hoje: "5",
            },
          ],
          rowCount: 1,
        };
      }
      if (/em_falta/i.test(sql)) {
        return { rows: [{ em_falta: "6", acabando: "7" }], rowCount: 1 };
      }
      if (/top_marcas/i.test(sql)) {
        return {
          rows: [
            {
              com_estoque: "8",
              sem_estoque: "9",
              top_marcas: [{ marcasdes: "SAMSUNG", total: 8 }],
            },
          ],
          rowCount: 1,
        };
      }
      if (/from cli/i.test(sql)) {
        return {
          rows: [{ clientes: "10", vendedores: "11", marcas: "12" }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    };

    const res = makeRes();
    await dashboardController.resumo({}, res);

    const kpiQueries = queries.filter((q) => !/from emp/i.test(q.sql));
    assert(kpiQueries.length === 4, `esperado 4 queries de KPI, obtido ${kpiQueries.length}`);
    assert(res.statusCode === 200, "status deveria ser 200");
    assert(res.body.pedidos.pendentes === 1, "pendentes incorreto");
    assert(res.body.pedidos.confirmados === 2, "confirmados incorreto");
    assert(res.body.pedidos.balcao === 3, "balcao incorreto");
    assert(res.body.pedidos.entrega === 4, "entrega incorreto");
    assert(res.body.pedidos.venda === 5, "venda incorreto");
    assert(res.body.produtos.emFalta === 6, "emFalta incorreto");
    assert(res.body.produtos.acabando === 7, "acabando incorreto");
    assert(res.body.estoque.comEstoque === 8, "comEstoque incorreto");
    assert(res.body.estoque.semEstoque === 9, "semEstoque incorreto");
    assert(res.body.estoque.topMarcas[0].marcasdes === "SAMSUNG", "topMarcas incorreto");
    assert(res.body.listas.clientes === 10, "clientes incorreto");
    assert(res.body.listas.vendedores === 11, "vendedores incorreto");
    assert(res.body.listas.marcas === 12, "marcas incorreto");
  });

  await test("resumo usa CURRENT_DATE (sargável) nos counts de hoje", async () => {
    queries.length = 0;
    estoqueConfig.invalidateEstoqueConfigCache();
    responder = (sql) => {
      if (/from emp/i.test(sql)) {
        return { rows: [{ empusaest: "N", estoqmin: 5 }], rowCount: 1 };
      }
      if (/from pv/i.test(sql)) {
        return { rows: [{}], rowCount: 1 };
      }
      if (/em_falta/i.test(sql) || /top_marcas/i.test(sql)) {
        return { rows: [{}], rowCount: 1 };
      }
      return { rows: [{}], rowCount: 1 };
    };
    await dashboardController.resumo({}, makeRes());
    const pvQuery = queries.find((q) => /from pv/i.test(q.sql));
    assert(pvQuery.sql.includes("CURRENT_DATE"), "counts deveriam usar CURRENT_DATE");
    assert(!pvQuery.sql.includes("'now()'"), "não deveria usar 'now()'");
    assert(!pvQuery.sql.includes("::date"), "não deveria aplicar cast ::date");
  });

  await test("rota /dashboard/resumo registrada com autenticação", () => {
    const layer = dashboardRoutes.stack.find(
      (item) =>
        item.route &&
        item.route.path === "/dashboard/resumo" &&
        item.route.methods.get
    );
    assert(layer, "rota GET /dashboard/resumo não encontrada");
    assert(layer.route.stack.length >= 2, "rota deveria ter middleware de autenticação");
  });

  // -------------------------------------------------------------------------
  // Guardas estáticas
  // -------------------------------------------------------------------------
  await test("mais vendidos/devoluções não usam mais TRIM em colunas bpchar", () => {
    const showcase = read("src/models/showcaseModels.js");
    assert(
      !showcase.includes("TRIM(pv.pvconfirmado)"),
      "showcaseModels ainda usa TRIM(pv.pvconfirmado)"
    );
    assert(!showcase.includes("TRIM(pv.pvsta)"), "showcaseModels ainda usa TRIM(pv.pvsta)");
    const devolucoes = read("src/controllers/devolucoesController.js");
    assert(
      !devolucoes.includes("TRIM(pv.pvconfirmado)"),
      "devolucoesController ainda usa TRIM"
    );
  });

  await test("relatório de peças usa ILIKE (compatível com índice trigram)", () => {
    const src = read("src/models/relatoriosModels.js");
    assert(
      src.includes("pro.prodes ILIKE $"),
      "relatoriosModels deveria usar pro.prodes ILIKE"
    );
    assert(
      !src.includes("LOWER(pro.prodes) LIKE"),
      "LOWER(...) LIKE ainda presente"
    );
  });

  await test("migration cria índices trigram para pro.des e modelo.moddes", () => {
    const src = read("src/config/atualizardb.js");
    assert(src.includes("idx_pro_des_trgm"), "idx_pro_des_trgm ausente");
    assert(src.includes("idx_modelo_des_trgm"), "idx_modelo_des_trgm ausente");
    assert(src.includes("USING gin (prodes gin_trgm_ops)"), "GIN prodes ausente");
    assert(src.includes("USING gin (moddes gin_trgm_ops)"), "GIN moddes ausente");
  });

  await test("busca da home usa o endpoint server-side com search e limit", () => {
    const src = read("public/js/index.js");
    assert(
      src.includes("/modelos?search="),
      "index.js deveria chamar /modelos?search="
    );
    assert(src.includes("&limit=50"), "index.js deveria limitar a busca");
  });

  await test("dashboard frontend consome o endpoint agregado", () => {
    const src = read("public/html/auth/js/painel-dashboard.js");
    assert(src.includes('jget("/dashboard/resumo"'), "deveria chamar /dashboard/resumo");
    assert(src.includes("topMarcas"), "deveria usar o top de marcas do resumo");
  });

  console.log("\n" + "=".repeat(50));
  console.log(`\n📊 Resultado dos Testes: ${testsPassed}/${testsRun} passaram`);
  if (testsFailed > 0) {
    console.log(`❌ ${testsFailed} teste(s) falharam`);
    process.exit(1);
  }
  console.log("✅ Todos os testes passaram!");
}

runTests().catch((error) => {
  console.error("Erro inesperado:", error);
  process.exit(1);
});
