/**
 * Testes da PR1 de performance (correções seguras).
 *
 * Não exigem banco de dados: o módulo src/config/db é substituído por um stub
 * antes de carregar os módulos testados. Também faz checagens estáticas dos
 * arquivos de frontend alterados para servir de guarda de regressão.
 *
 * Executar: npm run test:pr1  (ou node tests/performancePR1.test.js)
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
// Stub do pool: qualquer query devolve o resultado configurado e registra o SQL.
// ---------------------------------------------------------------------------
const dbPath = require.resolve("../src/config/db");
const queries = [];
let queryResult = { rows: [], rowCount: 0 };

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (text, params) => {
      queries.push({ text, params });
      return typeof queryResult === "function" ? queryResult(text, params) : queryResult;
    },
    connect: async () => {
      throw new Error("connect não deve ser usado neste teste");
    },
    on: () => {},
  },
};

function resetQueries() {
  queries.length = 0;
}

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

const pedidosController = require("../src/controllers/pedidosController");
const pedidoModels = require("../src/models/pedidoModels");
const usuarioRoute2 = require("../src/routes/usuarioRoute2");

async function runTests() {
  console.log("\n🧪 Testes PR1 — Performance\n");
  console.log("=".repeat(50));

  // -------------------------------------------------------------------------
  // 1. Counts de pedidos não usam mais o literal inválido 'now()'
  // -------------------------------------------------------------------------
  const countHandlers = [
    ["listarPvPendentesCountNow", pedidosController.listarPvPendentesCountNow],
    ["listarPvBalcaoNow", pedidosController.listarPvBalcaoNow],
    ["listarPvEntregaNow", pedidosController.listarPvEntregaNow],
    ["listarTotalPvConfirmadosNow", pedidosController.listarTotalPvConfirmadosNow],
    ["listarPvVendaNow", pedidosController.listarPvVendaNow],
  ];

  for (const [name, handler] of countHandlers) {
    await test(`Count ${name} usa CURRENT_DATE (sem 'now()' e sem cast)`, async () => {
      resetQueries();
      queryResult = { rows: [{ count: "0" }], rowCount: 1 };
      const res = makeRes();
      await handler({}, res);
      assert(queries.length === 1, "deveria executar 1 query");
      const sql = queries[0].text;
      assert(sql.includes("CURRENT_DATE"), "SQL deve usar CURRENT_DATE");
      assert(!sql.includes("'now()'"), "SQL não deve conter o literal 'now()'");
      assert(!sql.includes("::date"), "SQL não deve aplicar cast ::date");
    });
  }

  await test("totalVendasDia usa pvdtcad = CURRENT_DATE sem cast", async () => {
    resetQueries();
    queryResult = { rows: [], rowCount: 0 };
    await pedidoModels.totalVendasDia();
    assert(queries.length === 1, "deveria executar 1 query");
    const sql = queries[0].text;
    assert(sql.includes("pvdtcad = CURRENT_DATE"), "SQL deve comparar direto com CURRENT_DATE");
    assert(!sql.includes("::date"), "SQL não deve aplicar cast ::date");
  });

  // -------------------------------------------------------------------------
  // 2. pedidoModels.listarPv envia o parâmetro $1
  // -------------------------------------------------------------------------
  await test("listarPv envia pvrcacod como parâmetro preparado", async () => {
    resetQueries();
    queryResult = { rows: [{ pvcod: 1 }], rowCount: 1 };
    const rows = await pedidoModels.listarPv(99);
    assert(queries.length === 1, "deveria executar 1 query");
    assert(queries[0].text.includes("pvrcacod = $1"), "SQL deve usar $1");
    assert(
      Array.isArray(queries[0].params) && queries[0].params[0] === 99,
      "parâmetro 99 deveria ser enviado"
    );
    assert(Array.isArray(rows) && rows.length === 1, "deveria retornar as linhas");
  });

  // -------------------------------------------------------------------------
  // 3. Rota de exclusão de usuário com caminho correto
  // -------------------------------------------------------------------------
  await test("usuarioRoute2 registra POST /api/v2/usuario/excluir/:id", () => {
    const layer = usuarioRoute2.stack.find(
      (item) =>
        item.route &&
        item.route.path === "/api/v2/usuario/excluir/:id" &&
        item.route.methods.post
    );
    assert(layer, "rota POST com barra inicial não encontrada");
  });

  // -------------------------------------------------------------------------
  // 4. Cache de empresa evita consultas repetidas
  // -------------------------------------------------------------------------
  await test("empresaCache reutiliza o resultado dentro do TTL", async () => {
    resetQueries();
    queryResult = { rows: [{ emprazao: "Empresa Teste" }], rowCount: 1 };
    delete require.cache[require.resolve("../src/utils/empresaCache")];
    const empresaCache = require("../src/utils/empresaCache");

    const first = await empresaCache.getEmpresa();
    const second = await empresaCache.getEmpresa();
    assert(first && first.emprazao === "Empresa Teste", "primeiro retorno inválido");
    assert(second && second.emprazao === "Empresa Teste", "segundo retorno inválido");
    assert(queries.length === 1, `deveria consultar 1x (consultou ${queries.length})`);

    empresaCache.invalidateEmpresaCache();
    await empresaCache.getEmpresa();
    assert(queries.length === 2, "após invalidar deveria consultar novamente");
  });

  // -------------------------------------------------------------------------
  // 5. Checagens estáticas das correções de frontend/back-end
  // -------------------------------------------------------------------------
  await test("painel-pedidos não chama atualizarTotaisPedidos dentro do forEach", () => {
    const src = read("public/html/auth/js/painel-pedidos.js");
    const dentroDoForEach = /corpoTabela\.appendChild\(tr\);\s*\n\s*atualizarTotaisPedidos\(\)/.test(src);
    assert(!dentroDoForEach, "atualizarTotaisPedidos ainda está dentro do forEach");
    assert(
      src.includes("corpoTabela.appendChild(tr);\n      });\n\n      // Totais atualizados uma única vez"),
      "chamada única após o loop não encontrada"
    );
  });

  await test("painel-dashboard carrega KPIs em Promise.all", () => {
    const src = read("public/html/auth/js/painel-dashboard.js");
    assert(
      src.includes("] = await Promise.all(["),
      "loadDashboard deveria usar Promise.all"
    );
    const sequenciais = src.match(/await jget\(/g) || [];
    assert(
      sequenciais.length === 0,
      `ainda existem ${sequenciais.length} awaits sequenciais de jget`
    );
  });

  await test("dashboard reutiliza o /me/usuario do shell", () => {
    const dashboard = read("public/html/auth/js/painel-dashboard.js");
    assert(
      dashboard.includes("window.ouObterUsuario"),
      "dashboard deveria reutilizar ouObterUsuario"
    );
    const componentes = read("public/html/auth/js/componentes.js");
    assert(
      componentes.includes("window.ouObterUsuario"),
      "componentes deveria expor ouObterUsuario"
    );
  });

  await test("busca da home usa debounce antes do fetch de modelos", () => {
    const src = read("public/js/index.js");
    assert(src.includes("executarBusca"), "função executarBusca não encontrada");
    assert(
      /buscaDebounceTimer = setTimeout\(\(\) => executarBusca\(pesquisa\), \d+\)/.test(src),
      "debounce com setTimeout não encontrado"
    );
  });

  await test("GET /emp é memoizado no frontend", () => {
    const nomeEmpresa = read("public/js/nomeEmpresa.js");
    assert(
      nomeEmpresa.includes("window.obterDadosEmpresa"),
      "helper obterDadosEmpresa não encontrado"
    );
    const carrinho = read("public/js/carrinho.js");
    assert(carrinho.includes("window.obterDadosEmpresa"), "carrinho deveria reutilizar /emp");
    const configEstoque = read("public/js/configEstoque.js");
    assert(
      configEstoque.includes("window.obterDadosEmpresa"),
      "configEstoque deveria reutilizar /emp"
    );
    const configWhatsapp = read("public/js/configWhatsapp.js");
    assert(
      configWhatsapp.includes("window.obterDadosEmpresa"),
      "configWhatsapp deveria reutilizar /emp"
    );
  });

  await test("manifest não faz mais fetch HTTP interno de /emp", () => {
    const src = read("src/app.js");
    assert(!src.includes("${base}/emp"), "fetch interno para /emp ainda existe");
    assert(src.includes("getEmpresa()"), "manifest deveria usar getEmpresa()");
  });

  await test("uploads tem Cache-Control explícito e curto", () => {
    const src = read("src/app.js");
    assert(
      src.includes("public, max-age=60, must-revalidate"),
      "Cache-Control conservador de /uploads não encontrado"
    );
  });

  await test("uploads de imagem redimensionam com sharp", () => {
    const src = read("src/app.js");
    assert(src.includes(".resize(512, 512"), "logo não é redimensionado para 512px");
    assert(src.includes(".resize(180, 180"), "apple-touch-icon não é redimensionado");
    assert(src.includes(".resize(256, 256"), "logo de marca não é redimensionado");
  });

  await test("painel-produto não acumula listeners ao abrir o modal", () => {
    const src = read("public/html/auth/js/painel-produto.js");
    assert(
      !src.includes('btnProduto.addEventListener("click", carregarCoresPainel)'),
      "listener duplicado de cores ainda existe"
    );
    assert(src.includes("promarcascod.onchange"), "change deveria ser idempotente (onchange)");
  });

  await test("painel-marca tem apenas um handler de submit", () => {
    const src = read("public/html/auth/js/painel-marca.js");
    const submits = src.match(/marcaForm\.addEventListener\("submit"/g) || [];
    assert(submits.length === 1, `esperado 1 handler de submit, encontrado ${submits.length}`);
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
