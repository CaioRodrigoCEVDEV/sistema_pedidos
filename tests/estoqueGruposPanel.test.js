const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "../public/html/auth/js/painel-estoque-grupos.js"),
  "utf8"
);

// DOM mínimo para executar a tela sem acessar o navegador/banco.
class Element {
  constructor() {
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.listeners = {};
    this.attrs = {};
    this.value = "";
    this.textContent = "";
    this._html = null;
    this.classList = { add() {}, remove() {} };
  }
  set innerHTML(value) {
    this._html = String(value);
    this.children = [];
  }
  get innerHTML() {
    return this._html !== null ? this._html : this.textContent;
  }
  appendChild(child) {
    if (child && child.text !== undefined) this.textContent += child.text;
    this.children.push(child);
    return child;
  }
  addEventListener(event, callback) {
    (this.listeners[event] ||= []).push(callback);
  }
  setAttribute(name, value) {
    this.attrs[name] = String(value);
  }
  getAttribute(name) {
    return this.attrs[name];
  }
  querySelector() {
    return new Element();
  }
  querySelectorAll() {
    return [];
  }
}

function painel() {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const requests = [];
  let responseData = [];

  const document = {
    getElementById: get,
    createElement: () => new Element(),
    createTextNode: (text) => ({ text: String(text) }),
    querySelectorAll: () => [],
  };

  const context = vm.createContext({
    document,
    console: { error() {}, warn() {} },
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    ouOnLoad: () => {},
    fetch: async (url) => {
      requests.push(url);
      return { ok: true, json: async () => responseData };
    },
  });

  vm.runInContext(source, context);

  return {
    context,
    get,
    requests,
    setResponse: (data) => {
      responseData = data;
    },
    // Normaliza valores vindos de outro realm (vm) para comparação estrita.
    run: (code) => {
      const value = vm.runInContext(code, context);
      return value === undefined ? value : JSON.parse(JSON.stringify(value));
    },
  };
}

const grupos = () => [
  { id: 6, grupo: "11 PREMIUM", qtde_vendida: "3", estoque_atual: 0, qtde_ideal: null },
  { id: 2, grupo: "A06 4G S/A", qtde_vendida: "10", estoque_atual: 2, qtde_ideal: 5 },
  { id: 5, grupo: "G8 PLAY / ONE MACRO S/A", qtde_vendida: "1", estoque_atual: 4, qtde_ideal: 4 },
  {
    id: 1,
    grupo: "A02 / A12 / A32 5G / M12 S/A",
    qtde_vendida: "2",
    estoque_atual: 6,
    qtde_ideal: 8,
  },
  { id: 4, grupo: "11 ASUGAR", qtde_vendida: "20", estoque_atual: 1, qtde_ideal: 2 },
  { id: 3, grupo: "A10 S/A", qtde_vendida: "5", estoque_atual: 10, qtde_ideal: null },
];

test("Estado inicial usa Grupo crescente", () => {
  const p = painel();
  assert.equal(p.run("sortCol"), "grupo");
  assert.equal(p.run("sortDir"), "asc");
});

test("ordenarGrupos ordena Grupo A→Z com dígitos por último", () => {
  const p = painel();
  p.run(`__dados = ${JSON.stringify(grupos())}`);
  const ordem = p.run("ordenarGrupos(__dados, 'grupo', 'asc').map((r) => r.grupo)");
  assert.deepEqual(ordem, [
    "A02 / A12 / A32 5G / M12 S/A",
    "A06 4G S/A",
    "A10 S/A",
    "G8 PLAY / ONE MACRO S/A",
    "11 ASUGAR",
    "11 PREMIUM",
  ]);
});

test("Ordenação numérica de Estoque Atual não é lexicográfica", () => {
  const p = painel();
  p.run(`__dados = ${JSON.stringify(grupos())}`);
  const asc = p.run("ordenarGrupos(__dados, 'estoque_atual', 'asc').map((r) => r.estoque_atual)");
  assert.deepEqual(asc, [0, 1, 2, 4, 6, 10]);
  const desc = p.run("ordenarGrupos(__dados, 'estoque_atual', 'desc').map((r) => r.estoque_atual)");
  assert.deepEqual(desc, [10, 6, 4, 2, 1, 0]);
});

test("Valores nulos de Qtde Ideal ficam por último nas duas direções", () => {
  const p = painel();
  p.run(`__dados = ${JSON.stringify(grupos())}`);
  const asc = p.run("ordenarGrupos(__dados, 'qtde_ideal', 'asc').map((r) => r.qtde_ideal)");
  const desc = p.run("ordenarGrupos(__dados, 'qtde_ideal', 'desc').map((r) => r.qtde_ideal)");
  assert.deepEqual(asc, [2, 4, 5, 8, null, null]);
  assert.deepEqual(desc, [8, 5, 4, 2, null, null]);
});

test("Ordenação por Status usa a regra existente (Abaixo, Adequado, Sem ideal)", () => {
  const p = painel();
  p.run(`__dados = ${JSON.stringify(grupos())}`);
  const asc = p.run(
    "ordenarGrupos(__dados, 'status', 'asc').map((r) => calcularStatus(r.estoque_atual, r.qtde_ideal).label)"
  );
  assert.deepEqual(asc, [
    "Abaixo do ideal",
    "Abaixo do ideal",
    "Abaixo do ideal",
    "Adequado",
    "Sem ideal",
    "Sem ideal",
  ]);
});

test("Busca é parcial e case-insensitive", () => {
  const p = painel();
  p.run(`__dados = ${JSON.stringify(grupos())}`);
  const nomes = (termo) =>
    p.run(`filtrarGrupos(__dados, ${JSON.stringify(termo)}).map((r) => r.grupo)`);
  assert.deepEqual(nomes("iphone"), []);
  assert.deepEqual(nomes("A06"), ["A06 4G S/A"]);
  assert.deepEqual(nomes("s/a"), [
    "A06 4G S/A",
    "G8 PLAY / ONE MACRO S/A",
    "A02 / A12 / A32 5G / M12 S/A",
    "A10 S/A",
  ]);
  assert.deepEqual(nomes("11"), ["11 PREMIUM", "11 ASUGAR"]);
});

test("Cabeçalhos alternam crescente/decrescente e trocam de coluna", () => {
  const p = painel();
  p.get("buscaGrupo").value = "";
  p.context.currentData = grupos();
  p.run("selecionarOrdenacao('estoque_atual')");
  assert.equal(p.run("sortCol"), "estoque_atual");
  assert.equal(p.run("sortDir"), "asc");
  p.run("selecionarOrdenacao('estoque_atual')");
  assert.equal(p.run("sortDir"), "desc");
  p.run("selecionarOrdenacao('grupo')");
  assert.equal(p.run("sortCol"), "grupo");
  assert.equal(p.run("sortDir"), "asc");
});

test("Busca combinada com filtros (marca) usa os dados filtrados pelo backend", async () => {
  const p = painel();
  // O backend já devolveu apenas a marca selecionada.
  p.setResponse([
    { id: 1, grupo: "Tela Samsung A02", qtde_vendida: "1", estoque_atual: 1, qtde_ideal: null },
    { id: 2, grupo: "Bateria Samsung A02", qtde_vendida: "1", estoque_atual: 1, qtde_ideal: null },
  ]);
  p.run("currentFilters = { dataInicio: '', dataFim: '', marca: '5' }");
  p.get("buscaGrupo").value = "tela";
  await p.context.fetchData();

  assert.match(p.requests.at(-1), /marca=5/);
  assert.equal(p.get("gruposTableBody").children.length, 1);
  assert.match(p.get("gruposTableBody").children[0].innerHTML, /Tela Samsung A02/);
});

test("Busca sem resultados exibe o estado vazio", async () => {
  const p = painel();
  p.setResponse(grupos());
  p.get("buscaGrupo").value = "inexistente";
  await p.context.fetchData();
  assert.equal(p.get("gruposTableBody").children.length, 0);
  assert.equal(p.get("emptyState").style.display, "block");
  assert.equal(p.get("resultsInfo").textContent, "0 grupos");
});

test("Limpar zera todos os filtros, inclusive a busca, e esvazia a tabela", () => {
  const p = painel();
  p.get("dataInicio").value = "2026-09-01";
  p.get("dataFim").value = "2026-09-21";
  p.get("marcaSelect").value = "5";
  p.get("buscaGrupo").value = "tela";
  p.context.currentData = grupos();
  p.get("gruposTableBody").innerHTML = "<tr></tr>";

  p.get("btnLimpar").listeners.click[0]();

  assert.equal(p.get("dataInicio").value, "");
  assert.equal(p.get("dataFim").value, "");
  assert.equal(p.get("marcaSelect").value, "");
  assert.equal(p.get("buscaGrupo").value, "");
  assert.equal(p.run("currentData.length"), 0);
  assert.equal(p.get("gruposTableBody").children.length, 0);
  assert.equal(p.get("emptyState").style.display, "none");
  assert.equal(p.get("resultsInfo").textContent, "0 grupos");
});

test("As ações de adicionar, reduzir e salvar ideal continuam sendo renderizadas", async () => {
  const p = painel();
  p.setResponse([grupos()[0]]);
  await p.context.fetchData();
  const html = p.get("gruposTableBody").children[0].innerHTML;
  assert.match(html, /btn-adicionar/);
  assert.match(html, /btn-reduzir/);
  assert.match(html, /btn-salvar-ideal/);
  assert.match(html, /input-ideal/);
});
