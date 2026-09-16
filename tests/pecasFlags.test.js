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
  vm.runInContext(source.slice(start, source.indexOf('document.addEventListener("DOMContentLoaded"', start)), context);
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
const controller = require("../src/controllers/proController");
const response = () => ({ status() { return this; }, json(data) { this.data = data; } });

test("API usa flags salvas na listagem, edição, filtros e total", async () => {
  for (const flags of [{}, { semest: "S" }, { acabando: "S" }, { semest: "S", acabando: "S" }]) {
    queries.length = 0;
    await controller.listarProdutos({ query: { page: "1", ...flags } }, response());
    assert.equal(queries.length, 2);
    const [count, list] = queries;
    assert.doesNotMatch(list.sql, /stock_quantity|pc_disponivel/);
    for (const [queryFlag, column] of [["semest", "prosemest"], ["acabando", "proacabando"]]) {
      const expression = `COALESCE(UPPER(TRIM(pro.${column})), 'N')`;
      assert.ok(list.sql.includes(`${expression} as ${column}`));
      for (const query of queries) {
        assert.equal(query.sql.includes(`${expression} = 'S'`), flags[queryFlag] === "S");
      }
    }
    assert.equal(count.sql.slice(count.sql.indexOf("from pro")),
      list.sql.slice(list.sql.lastIndexOf("from pro"), list.sql.indexOf("\n        order by")));
  }
  queries.length = 0;
  await controller.listarProdutosPainelId({ params: { id: "1" } }, response());
  assert.ok(queries[0].sql.includes("COALESCE(UPPER(TRIM(pro.prosemest)), 'N') as prosemest"));
  assert.ok(queries[0].sql.includes("COALESCE(UPPER(TRIM(pro.proacabando)), 'N') as proacabando"));
});

test("Consulta sem paginação mantém os parâmetros dos outros filtros", async () => {
  queries.length = 0;
  await controller.listarProdutos({ query: { marca: "2", q: "tampa", semest: "S" } }, response());
  assert.deepEqual(queries[0].params, [2, "%tampa%"]);
});
