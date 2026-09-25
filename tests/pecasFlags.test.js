const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../public/html/auth/js/painel.js"), "utf8");

function createPanel() {
  const rows = [];
  const tbody = {
    set innerHTML(value) { rows.length = 0; this.html = value; },
    appendChild(row) { rows.push(row.innerHTML); },
    insertAdjacentHTML() {},
  };
  const requests = [];
  const context = vm.createContext({
    URLSearchParams, AbortController, console,
    BASE_URL: "http://localhost",
    pecasLoading: false, pecasRequestController: null,
    pecasPage: 1, pecasPageSize: 20, pecasTotal: 0,
    pecasQ: "", pecasMarca: null, pecasModelo: null, pecasTipo: null,
    pecasMarcacao: "", pecasTemMais: false,
    formatarMoeda: String,
    document: {
      getElementById: (id) => id === "corpoTabela" ? tbody : null,
      querySelector: () => null,
      createElement: () => ({}),
    },
    fetch(url, options) {
      return new Promise((resolve) => requests.push({
        url, options,
        finish(data, total = data.length) {
          resolve({ ok: true, json: async () => ({ data, total }) });
        },
      }));
    },
  });
  vm.runInContext(source.slice(source.indexOf("function normalizarFlagPeca("),
    source.indexOf("function atualizarLinhaPecaEditada(")), context);
  const start = source.indexOf("async function carregarPecas(");
  vm.runInContext(source.slice(start, source.indexOf('ouOnLoad(', start)), context);
  return { context, requests, rows };
}

test("Tabela identifica nenhuma, cada flag e ambas; aceita espaços do banco", () => {
  const { context, rows } = createPanel();
  context.renderPecas([
    { procod: 1, prodes: "Nenhuma", prosemest: "N", proacabando: null },
    { procod: 2, prodes: "Sem estoque", prosemest: " S ", proacabando: "N" },
    { procod: 3, prodes: "Acabando", prosemest: "N", proacabando: "s " },
    { procod: 4, prodes: "Ambas", prosemest: "S", proacabando: "S" },
  ]);
  assert.match(rows[0], /Nenhuma marcada/);
  assert.doesNotMatch(rows[0], /peca-badge/);
  assert.match(rows[1], /peca-badge-sem/);
  assert.doesNotMatch(rows[1], /peca-badge-acab/);
  assert.match(rows[2], /peca-badge-acab/);
  assert.doesNotMatch(rows[2], /peca-badge-sem/);
  assert.match(rows[3], /peca-badge-sem/);
  assert.match(rows[3], /peca-badge-acab/);
});

test("Ao editar, as flags são comparadas com os filtros ativos", () => {
  const { context } = createPanel();
  context.pecasMarcacao = "prosemest";
  assert.equal(context.linhaPecaForaDosFiltrosStatus(" S ", "N"), false);
  assert.equal(context.linhaPecaForaDosFiltrosStatus("N", "S"), true);
  context.pecasMarcacao = "proacabando";
  assert.equal(context.linhaPecaForaDosFiltrosStatus("S", "N"), true);
  assert.equal(context.linhaPecaForaDosFiltrosStatus("N", "S"), false);
  assert.equal(context.linhaPecaForaDosFiltrosStatus("S", "S"), false);
});

test("Trocar o filtro durante carregamento ignora a resposta antiga", async () => {
  const { context, requests, rows } = createPanel();
  const first = context.carregarPecas(1);
  context.pecasMarcacao = "prosemest";
  const filtered = context.carregarPecas(1);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.signal.aborted, true);
  assert.equal(new URL(requests[1].url).searchParams.get("semest"), "S");
  requests[1].finish([{ procod: 2, prodes: "Marcada", prosemest: "S" }]);
  await filtered;
  requests[0].finish([{ procod: 1, prodes: "Antiga", prosemest: "N" }]);
  await first;
  assert.equal(rows.length, 1);
  assert.match(rows[0], /Marcada/);
  assert.equal(context.pecasTotal, 1);
});

test("Filtro seleciona uma flag por vez, acompanha paginação e limpa", async () => {
  const { context, requests } = createPanel();
  context.pecasMarcacao = "prosemest";
  const paginated = context.carregarPecas(2, true);
  const query = new URL(requests[0].url).searchParams;
  assert.equal(query.get("page"), "2");
  assert.equal(query.get("semest"), "S");
  assert.equal(query.has("acabando"), false);
  requests[0].finish([]);
  await paginated;
  context.pecasMarcacao = "proacabando";
  const changed = context.carregarPecas(1);
  assert.equal(new URL(requests[1].url).searchParams.has("semest"), false);
  assert.equal(new URL(requests[1].url).searchParams.get("acabando"), "S");
  requests[1].finish([]);
  await changed;
  context.pecasMarcacao = "";
  const cleared = context.carregarPecas(1);
  assert.equal(new URL(requests[2].url).searchParams.has("semest"), false);
  assert.equal(new URL(requests[2].url).searchParams.has("acabando"), false);
  requests[2].finish([]);
  await cleared;
});

const dbPath = require.resolve("../src/config/db");
const queries = [];
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
  async query(sql, params) {
    queries.push({ sql, params });
    return { rows: sql.includes("count(*)") ? [{ count: "0" }] : [] };
  },
} };

// Config de estoque controlavel pelos testes (empresa que controla estoque).
let estoqueConfigMock = { usaEstoque: true, empusaest: "S", estoqueMin: 5 };
const estoqueConfigPath = require.resolve("../src/utils/estoqueConfig");
require.cache[estoqueConfigPath] = {
  id: estoqueConfigPath,
  filename: estoqueConfigPath,
  loaded: true,
  exports: {
    async getEstoqueConfig() {
      return { ...estoqueConfigMock };
    },
    invalidateEstoqueConfigCache() {},
    normalizar: () => ({ ...estoqueConfigMock }),
    TTL_MS: 0,
  },
};

const controller = require("../src/controllers/proController");
const { buildFlagsEstoqueSql } = require("../src/utils/estoqueFlagsSql");
const response = () => ({ status() { return this; }, json(data) { this.data = data; } });

test("API aplica flags efetivas de estoque na listagem, filtros e painel", async () => {
  estoqueConfigMock = { usaEstoque: true, empusaest: "S", estoqueMin: 5 };
  const flagsSql = buildFlagsEstoqueSql(estoqueConfigMock);

  for (const flags of [{}, { semest: "S" }, { acabando: "S" }, { semest: "S", acabando: "S" }]) {
    queries.length = 0;
    await controller.listarProdutos({ query: { page: "1", ...flags } }, response());
    assert.equal(queries.length, 2);
    const [count, list] = queries;

    // Disponibilidade continua vindo da regra real (cor/grupo) e a flag de
    // "acabando" e calculada a partir do saldo efetivo x estoque minimo.
    assert.ok(list.sql.includes(`${flagsSql.disponibilidadeSql} as prosemest`));
    assert.ok(list.sql.includes(`${flagsSql.acabandoSql} as proacabando`));
    assert.ok(list.sql.includes("pg.stock_quantity"));
    assert.ok(list.sql.includes("<= 5"));

    const temFiltroSemest = list.sql.includes(`${flagsSql.disponibilidadeSql} = 'S'`);
    const temFiltroAcabando = list.sql.includes(`${flagsSql.acabandoSql} = 'S'`);
    assert.equal(temFiltroSemest, flags.semest === "S");
    assert.equal(temFiltroAcabando, flags.acabando === "S");

    assert.equal(count.sql.slice(count.sql.indexOf("from pro")),
      list.sql.slice(list.sql.lastIndexOf("from pro"), list.sql.indexOf("\n        order by")));
  }

  queries.length = 0;
  await controller.listarProdutosPainelId({ params: { id: "1" } }, response());
  assert.ok(queries[0].sql.includes(`${flagsSql.disponibilidadeSql} as prosemest`));
  assert.ok(queries[0].sql.includes(`${flagsSql.acabandoSql} as proacabando`));
  assert.ok(queries[0].sql.includes("pg.stock_quantity"));
  assert.ok(queries[0].sql.includes("<= 5"));
});

test("Empresa sem controle de estoque respeita as flags manuais", async () => {
  estoqueConfigMock = { usaEstoque: false, empusaest: "N", estoqueMin: 5 };

  // A gestão mostra as marcações manuais do cadastro, sem calcular estoque por
  // cor/grupo (senão o valor marcado na edição não aparece de volta).
  queries.length = 0;
  await controller.listarProdutos({ query: { page: "1" } }, response());
  const list = queries[1];
  assert.match(list.sql, /COALESCE\(UPPER\(TRIM\(pro\.prosemest\)\), 'N'\) as prosemest/);
  assert.match(list.sql, /COALESCE\(UPPER\(TRIM\(pro\.proacabando\)\), 'N'\) as proacabando/);
  assert.doesNotMatch(list.sql, /part_group_items/);

  queries.length = 0;
  await controller.listarProdutosPainelId({ params: { id: "1" } }, response());
  assert.match(queries[0].sql, /COALESCE\(UPPER\(TRIM\(pro\.prosemest\)\), 'N'\) as prosemest/);
  assert.match(queries[0].sql, /COALESCE\(UPPER\(TRIM\(pro\.proacabando\)\), 'N'\) as proacabando/);
  assert.doesNotMatch(queries[0].sql, /part_group_items/);

  queries.length = 0;
  await controller.totalProdutoAcabando({}, response());
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /pro\.proacabando/);

  queries.length = 0;
  await controller.totalProdutoEmFalta({}, response());
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /pro\.prosemest/);
});

test("Consulta sem paginação mantém os parâmetros dos outros filtros", async () => {
  queries.length = 0;
  await controller.listarProdutos({ query: { marca: "2", q: "tampa", semest: "S" } }, response());
  assert.deepEqual(queries[0].params, [2, "%tampa%"]);
});

// --- Vitrines: mesma regra de estoque (manual ignora validação de estoque) ---

const showcaseModelsPath = require.resolve("../src/models/showcaseModels");
const showcaseRows = [];
const destaqueShowcase = { id: 1, type: "featured", title: "Destaques", max_items: 5 };
require.cache[showcaseModelsPath] = {
  id: showcaseModelsPath,
  filename: showcaseModelsPath,
  loaded: true,
  exports: {
    MAX_MAX_ITEMS: 50,
    async listarShowcases() {
      return [destaqueShowcase];
    },
    async listarItensShowcase() {
      return showcaseRows.slice();
    },
  },
};

const showcaseController = require("../src/controllers/showcaseController");
const showcasesCache = require("../src/utils/showcasesCache");

function itemShowcase(overrides) {
  return {
    procod: 1,
    prodes: "Peça",
    provl: 10,
    protipocod: 1,
    tipodes: "Tipo",
    promarcascod: 1,
    marcasdes: "Marca",
    modcod: null,
    moddes: "",
    prosemest: "N",
    prosemest_auto: "N",
    proacabando: "N",
    proqtde: 10,
    ...overrides,
  };
}

async function lerVitrinePublica() {
  showcasesCache.invalidate();
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    set(chave, valor) {
      this.headers[String(chave).toLowerCase()] = valor;
      return this;
    },
    type() {
      return this;
    },
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    send(corpo) {
      this.body = corpo;
      return this;
    },
    json(objeto) {
      this.body = Buffer.from(JSON.stringify(objeto));
      return this;
    },
    end() {
      return this;
    },
  };
  await showcaseController.listarPublicas({ headers: {} }, res);
  return JSON.parse(res.body.toString());
}

test("Vitrine sem controle de estoque ignora validacao e usa flags manuais", async () => {
  estoqueConfigMock = { usaEstoque: false, empusaest: "N", estoqueMin: 5 };
  showcaseRows.length = 0;
  showcaseRows.push(
    itemShowcase({
      prosemest: "S",
      prosemest_auto: "N",
      proacabando: "S",
      proqtde: 10,
    })
  );

  const payload = await lerVitrinePublica();
  const item = payload.showcases[0].items[0];
  assert.equal(item.prosemest, "S");
  assert.equal(item.proacabando, "S");
});

test("Vitrine com controle de estoque usa as flags automaticas", async () => {
  estoqueConfigMock = { usaEstoque: true, empusaest: "S", estoqueMin: 5 };
  showcaseRows.length = 0;
  showcaseRows.push(
    itemShowcase({
      prosemest: "S",
      prosemest_auto: "N",
      proacabando: "N",
      proqtde: 20,
      estoque_menor_saldo: 5,
    })
  );

  const payload = await lerVitrinePublica();
  const item = payload.showcases[0].items[0];
  assert.equal(item.prosemest, "N");
  assert.equal(item.proacabando, "S");
});

test("Vitrine com cores deixa ultimas unidades para a selecao de cor", async () => {
  estoqueConfigMock = { usaEstoque: true, empusaest: "S", estoqueMin: 5 };
  showcaseRows.length = 0;
  showcaseRows.push(itemShowcase({ tem_cores: true, estoque_menor_saldo: 4, prosemest_auto: "N", proacabando: "S" }));
  const payload = await lerVitrinePublica();
  assert.equal(payload.showcases[0].items[0].proacabando, "N");
  assert.equal(payload.showcases[0].items[0].prosemest, "N");
});
