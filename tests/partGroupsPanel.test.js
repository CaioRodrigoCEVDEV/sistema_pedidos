const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../public/html/auth/js/painel-part-groups.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "../public/html/auth/admin/html/painel-part-groups.html"), "utf8");

// DOM mínimo para executar os fluxos do painel sem acessar o banco de produção.
class Element {
  constructor() {
    this.children = [];
    this.dataset = new Proxy({}, {
      set(target, key, value) { target[key] = String(value); return true; },
    });
    this.style = {};
    this.listeners = {};
    this.controls = {};
    this.value = "";
    this.textContent = "";
    this.scrollTop = 0;
    this.classList = { add() {}, remove() {} };
  }
  set innerHTML(value) {
    this.html = value;
    this.children.forEach((child) => { child.parentNode = null; });
    this.children = [];
    this.cells = Array.from(value.matchAll(/<td\b/g), () => new Element());
  }
  get innerHTML() { return this.html || this.textContent; }
  appendChild(child) { return this.insertBefore(child, null); }
  insertBefore(child, reference) {
    child.remove();
    const index = reference ? this.children.indexOf(reference) : this.children.length;
    this.children.splice(index, 0, child);
    child.parentNode = this;
    return child;
  }
  remove() {
    if (!this.parentNode) return;
    const siblings = this.parentNode.children;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentNode = null;
  }
  replaceWith(child) {
    const parent = this.parentNode;
    parent.insertBefore(child, this);
    this.remove();
  }
  querySelectorAll(selector) {
    if (selector === "tr[data-group-id]") return this.children.filter((row) => row.dataset.groupId != null);
    if (selector === "tr[data-procorid]") return this.children.filter((row) => row.dataset.procorid != null);
    return [];
  }
  querySelector(selector) {
    if (selector.includes("colspan")) return null;
    if (selector.startsWith(".btn-")) return this.controls[selector] ||= new Element();
    return null;
  }
  closest(selector) {
    if (selector === ".ou-table-sticky") return this.container;
    return null;
  }
  addEventListener(event, callback) { this.listeners[event] = callback; }
  setAttribute(name, value) {
    if (name === "data-peca-id") this.dataset.pecaId = value;
  }
  reset() { this.wasReset = true; }
}

function panel() {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const requests = [];
  const responses = [];
  const notices = [];
  let ready;
  const document = {
    getElementById: get,
    createElement: () => new Element(),
    querySelectorAll: (selector) => selector === "#tabela-pecas-grupo tr[data-procorid]"
      ? get("tabela-pecas-grupo").querySelectorAll("tr[data-procorid]") : [],
    querySelector(selector) {
      const button = selector.match(/^button\[form="(.+)"\]$/);
      if (button) return get(`button-${button[1]}`);
      const row = selector.match(/^#tabela-pecas-grupo tr\[data-procorid="(.+)"\]$/);
      if (row) return get("tabela-pecas-grupo").children.find((item) => String(item.dataset.procorid) === row[1]);
      const available = selector.match(/^tr\[data-peca-id="(.+)"\]$/);
      if (available) return get("tabela-pecas-disponiveis").children.find((item) => item.dataset.pecaId === available[1]);
      return null;
    },
    addEventListener(event, callback) { if (event === "DOMContentLoaded") ready = callback; },
  };
  const context = vm.createContext({
    document, console: { error() {}, warn() {} }, URL, setTimeout, clearTimeout,
    BASE_URL: "http://localhost", confirm: () => true,
    bootstrap: { Modal: { getInstance: (el) => ({ hide: () => { el.hidden = true; } }) } },
    fetch: async (url, options = {}) => {
      requests.push({ url, options });
      assert.ok(responses.length, `Requisição inesperada: ${url}`);
      return responses.shift();
    },
  });
  vm.runInContext(source.slice(0, source.indexOf("// Inicialização:")), context);
  context.showToast = (message, type) => notices.push({ message, type });
  ready();
  const run = (code) => vm.runInContext(code, context);
  const seed = (groups, selected = groups[0]?.id, parts = []) => {
    context.seed = { groups, selected, parts };
    run(`allGroups = seed.groups; currentGroupId = seed.selected;
      currentGroupData = { ...allGroups.find(g => g.id === currentGroupId), parts: seed.parts };
      renderGruposFiltradosOrdenados(); renderPecasGrupo(seed.parts);`);
    get("detalhesGrupo").style.display = "block";
  };
  return {
    context, get, requests, notices, run, seed,
    respond: (data, ok = true) => responses.push({ ok, json: async () => data }),
    defer() {
      let resolve;
      responses.push(new Promise((done) => { resolve = done; }));
      return (data, ok = true) => resolve({ ok, json: async () => data });
    },
  };
}

const groups = () => [
  { id: 1, name: "Tela A", stock_quantity: 5, parts_count: "1", color_id: null },
  { id: 2, name: "Tela B", stock_quantity: 8, parts_count: "0", color_id: null },
];
const part = { procorid: 10, procod: 100, prodes: "Peça", procorqtde: 5 };

test("Nova consulta ao reabrir ou pesquisar mantém a peça vinculada bloqueada", async () => {
  const p = panel();
  p.seed(groups(), 1, [part]);
  for (const search of ["", "Peça", ""]) {
    p.run(`searchTerm = ${JSON.stringify(search)}; availableParts = []`);
    p.respond({
      data: [{ procod: "100", prodes: "Peça", has_colors: false, colors: [] }],
      pagination: { page: 1, totalPages: 1, hasMore: false },
    });
    await p.context.carregarPecasDisponiveis();
    const button = p.get("tabela-pecas-disponiveis").children[0].querySelector(".btn-add-part");
    assert.equal(button.disabled, true);
    assert.match(button.innerHTML, /Já está no grupo/);
    button.listeners.click();
  }
  assert.equal(p.requests.length, 3);
  await p.context.adicionarPecaSemCor(100, null);
  assert.equal(p.requests.length, 3);
  assert.match(p.notices.at(-1).message, /já está no grupo/);
});

test("Cores já vinculadas ficam indisponíveis sem bloquear as cores restantes", async () => {
  const p = panel();
  p.seed(groups(), 1, [part]);
  p.run(`availableParts = [{ procod: 100, has_colors: true,
    colors: [{ procorid: "10", cornome: "Preto" }, { procorid: "11", cornome: "Branco" }] }];
    renderPecasDisponiveis(availableParts)`);
  const button = p.get("tabela-pecas-disponiveis").children[0].querySelector(".btn-add-part");
  assert.equal(button.disabled, false);
  assert.equal(p.run("estadoPecaNoGrupo(availableParts[0]).colors.length"), 1);
  assert.equal(p.run("estadoPecaNoGrupo(availableParts[0]).colors[0].procorid"), "11");
  p.respond({ procorid: 11, procorprocod: 100, prodes: "Peça", alreadyInGroup: false });
  await p.context.adicionarPecaAoGrupo(11);
  assert.equal(button.disabled, true);
  assert.match(button.innerHTML, /Já está no grupo/);
  p.run("renderPecasDisponiveis(availableParts)");
  assert.equal(p.get("tabela-pecas-disponiveis").children[0].querySelector(".btn-add-part").disabled, true);
  assert.equal(p.run("availableParts[0].colors.length"), 2);
});

test("Remover libera novamente a peça e trocar de grupo recalcula a disponibilidade", async () => {
  const p = panel();
  p.seed(groups(), 1, [part]);
  p.run("availableParts = [{ procod: 100, has_colors: false }]; renderPecasDisponiveis(availableParts)");
  const button = p.get("tabela-pecas-disponiveis").children[0].querySelector(".btn-add-part");
  assert.equal(button.disabled, true);
  p.respond({ procorid: 10 });
  await p.context.removerPecaGrupo(10);
  assert.equal(button.disabled, false);
  assert.match(button.innerHTML, /Adicionar/);
  p.seed(groups(), 1, [part]);
  p.run("atualizarDisponibilidadePecas()");
  assert.equal(button.disabled, true);
  p.seed(groups(), 2, []);
  p.run("atualizarDisponibilidadePecas()");
  assert.equal(button.disabled, false);
});

test("Editar mantém o grupo, suas peças, a busca, o scroll e as outras linhas", async () => {
  const p = panel();
  p.get("pesquisaGrupos").value = "Tela";
  p.get("tabela-grupos").container = { scrollTop: 160 };
  p.seed(groups(), 1, [part]);
  const otherRow = p.get("tabela-grupos").children[1];
  p.get("editarGrupoId").value = "1";
  p.get("editarNomeGrupo").value = "Tela atualizada";
  p.get("editarCorGrupo").value = "3";
  p.run('groupColors = [{ corcod: 3, cornome: "Azul", corhex: "#0000ff" }]');
  p.respond({ id: 1, name: "Tela atualizada", stock_quantity: 5, color_id: 3 });
  await p.context.salvarEdicaoGrupo();
  assert.equal(p.get("nomeGrupoDetalhe").textContent, "Tela atualizada");
  assert.equal(p.run("currentGroupId"), 1);
  assert.equal(p.run("currentGroupData.parts.length"), 1);
  assert.equal(p.get("tabela-grupos").children[1], otherRow);
  assert.match(p.get("tabela-grupos").children[0].innerHTML, /Azul/);
  assert.equal(p.get("tabela-grupos").container.scrollTop, 160);
  assert.equal(p.get("pesquisaGrupos").value, "Tela");
  assert.equal(p.requests.length, 1);
  assert.equal(p.notices.at(-1).type, "success");
});

test("Criar adiciona o grupo sem refazer a lista nem fechar o grupo em uso", async () => {
  const p = panel();
  p.seed(groups());
  const row = p.get("tabela-grupos").children[0];
  p.get("nomeGrupo").value = "Novo grupo";
  p.respond({ id: 3, name: "Novo grupo", stock_quantity: 0, color_id: null });
  await p.context.criarGrupo();
  assert.equal(p.run("allGroups.length"), 3);
  assert.equal(p.run("currentGroupId"), 1);
  assert.ok(p.get("tabela-grupos").children.includes(row));
  assert.equal(p.get("formCriarGrupo").wasReset, true);
  assert.equal(p.requests.length, 1);
});

for (const withColor of [true, false]) {
  test(`Adicionar peça ${withColor ? "com" : "sem"} cor atualiza detalhe e contador sem duplicar`, async () => {
    const p = panel();
    p.seed(groups(), 1, [part]);
    p.respond({ procorid: 11, procorprocod: 101, prodes: "Nova peça", procorqtde: 5, alreadyInGroup: false });
    if (withColor) await p.context.adicionarPecaAoGrupo(11);
    else await p.context.adicionarPecaSemCor(101, null);
    assert.equal(p.run("currentGroupData.parts.length"), 2);
    assert.equal(p.run("allGroups[0].parts_count"), 2);
    assert.equal(p.get("tabela-pecas-grupo").children.length, 2);
    assert.equal(p.run("currentGroupId"), 1);
    await p.context.adicionarPecaAoGrupo(11);
    assert.equal(p.run("allGroups[0].parts_count"), 2);
    assert.equal(p.get("tabela-pecas-grupo").children.length, 2);
    assert.equal(p.requests.length, 1);
    assert.match(p.notices.at(-1).message, /já está no grupo/);
  });
}

test("Remover a última peça mantém o grupo aberto e zera o contador", async () => {
  const p = panel();
  p.seed(groups(), 1, [part]);
  p.respond({ procorid: 10 });
  await p.context.removerPecaGrupo(10);
  assert.equal(p.run("currentGroupData.parts.length"), 0);
  assert.equal(p.run("allGroups[0].parts_count"), 0);
  assert.match(p.get("tabela-pecas-grupo").innerHTML, /Nenhuma peça/);
  assert.equal(p.get("detalhesGrupo").style.display, "block");
  assert.equal(p.requests.length, 1);
});

test("Estoque atualiza quantidade e custo mantendo as linhas e o grupo aberto", async () => {
  const p = panel();
  p.seed(groups(), 1, [{ ...part }]);
  const row = p.get("tabela-pecas-grupo").children[0];
  p.get("novoEstoque").value = "12";
  p.get("novoCusto").value = "9.50";
  p.respond({ id: 1, stock_quantity: 12, grpcusto: "9.50" });
  p.respond([]);
  await p.context.salvarEstoque();
  assert.equal(p.run("currentGroupData.grpcusto"), "9.50");
  assert.equal(p.run("currentGroupData.parts[0].procorqtde"), 12);
  assert.equal(p.get("estoqueGrupoDetalhe").textContent, 12);
  assert.equal(p.get("tabela-pecas-grupo").children[0], row);
  assert.equal(row.cells[3].textContent, 12);
  assert.equal(p.requests.length, 2);
  assert.match(p.requests[1].url, /\/1\/audit$/);
});

test("Excluir outro grupo preserva o selecionado; excluir o selecionado fecha seus detalhes", async () => {
  const p = panel();
  p.seed(groups());
  p.respond({});
  await p.context.excluirGrupo("2");
  assert.equal(p.run("currentGroupId"), 1);
  assert.equal(p.get("tabela-grupos").children.length, 1);
  p.respond({});
  await p.context.excluirGrupo("1");
  assert.equal(p.run("currentGroupId"), null);
  assert.equal(p.get("detalhesGrupo").style.display, "none");
});

test("Erro ao salvar preserva os dados e o formulário para tentar novamente", async () => {
  const p = panel();
  p.seed(groups());
  p.get("editarGrupoId").value = "1";
  p.get("editarNomeGrupo").value = "Novo nome";
  p.respond({ error: "Falha ao salvar" }, false);
  await p.context.salvarEdicaoGrupo();
  assert.equal(p.run("allGroups[0].name"), "Tela A");
  assert.equal(p.get("modalEditarGrupo").hidden, undefined);
  assert.equal(p.get("editarNomeGrupo").value, "Novo nome");
  assert.equal(p.notices.at(-1).message, "Falha ao salvar");
});

test("Resposta de inclusão atrasada não adiciona a peça ao grupo que foi aberto depois", async () => {
  const p = panel();
  p.seed(groups(), 1, [part]);
  const finish = p.defer();
  const saving = p.context.adicionarPecaAoGrupo(11);
  p.run("currentGroupId = 2; currentGroupData = { ...allGroups[1], parts: [] }; renderPecasGrupo([])");
  finish({ procorid: 11, procorprocod: 101, alreadyInGroup: false });
  await saving;
  assert.equal(p.run("currentGroupId"), 2);
  assert.equal(p.run("currentGroupData.parts.length"), 0);
  assert.equal(p.run("allGroups[0].parts_count"), 2);
});

test("Detalhes atrasados não substituem o grupo selecionado mais recentemente", async () => {
  const p = panel();
  p.seed(groups());
  const finish = p.defer();
  const first = p.context.abrirDetalhes(1);
  p.respond({ ...groups()[1], parts: [] });
  p.respond([]);
  await p.context.abrirDetalhes(2);
  finish({ ...groups()[0], parts: [part] });
  await first;
  assert.equal(p.get("nomeGrupoDetalhe").textContent, "Tela B");
  assert.equal(p.run("currentGroupData.id"), 2);
});

for (const formId of ["formCriarGrupo", "formEditarGrupo", "formEditarEstoque"]) {
  test(`${formId}: submit não navega e bloqueia envios simultâneos`, async () => {
    const p = panel();
    p.seed(groups(), 1, [part]);
    p.get("nomeGrupo").value = "Novo";
    p.get("editarGrupoId").value = "1";
    p.get("editarNomeGrupo").value = "Editado";
    p.get("novoEstoque").value = "9";
    const finish = p.defer();
    const form = p.get(formId);
    let prevented = 0;
    const event = { preventDefault: () => { prevented++; } };
    const saving = form.listeners.submit(event);
    await form.listeners.submit(event);
    assert.equal(prevented, 2);
    assert.equal(p.requests.length, 1);
    assert.equal(p.get(`button-${formId}`).disabled, true);
    finish({ error: "Falha simulada" }, false);
    await saving;
    assert.equal(p.get(`button-${formId}`).disabled, false);
    const button = html.match(new RegExp(`<button[^>]*form="${formId}"[^>]*>`))[0];
    assert.match(button, /type="submit"/);
    assert.doesNotMatch(button, /onclick/);
  });
}
