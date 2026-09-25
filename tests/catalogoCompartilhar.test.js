const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("Compartilha a lista filtrada somente com sessao confirmada pelo servidor", async () => {
  const elements = new Map();
  const opened = [];
  let sessionOk = false;
  let networkError = false;
  const context = vm.createContext({ URLSearchParams, BASE_URL: "", console,
    fetch: async (url, options) => {
      assert.equal(url, "/me/usuario");
      assert.equal(options.credentials, "include");
      if (networkError) throw new Error("Falha de rede");
      return { ok: sessionOk, json: async () => ({ usunome: "Operador" }) };
    },
    window: { location: { search: "?id=1&modelo=2&marcascod=3" },
      OrderUpTipoIcon: () => "bi-phone", open: (url) => { opened.push(url); return {}; } },
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, { textContent: id === "marcaTitulo" ? "Samsung" : "", style: {}, addEventListener() {}, appendChild() {} });
        return elements.get(id);
      },
      createElement: () => ({ dataset: {} }),
    },
  });
  vm.runInContext(read("public/js/mensagem-pecas.js"), context);
  const source = read("public/js/lista-pecas.js");
  vm.runInContext(source.slice(source.indexOf("const params"), source.indexOf("// Feedback rápido")), context);
  await vm.runInContext("validarCompartilhamento()", context);
  assert.equal(elements.get("compartilharPecas").hidden, true);
  vm.runInContext(`
    todasAsPecas = [
      { procod: 1, prodes: 'Tela B', tipodes: 'Tela', provl: 70, provlpromo: 50, prosemest: 'N' },
      { procod: 2, prodes: 'Bateria', tipodes: 'Bateria', provl: 30, prosemest: 'N' },
      { procod: 3, prodes: 'Tela A', tipodes: 'Tela', provl: 60, prosemest: 'S' }
    ];
    dadosCarregados = true; modeloAtual = 'A01'; pesquisaAtual = 'Tela'; ordenacaoAtual = 'nome-asc';
    renderPecas(); compartilharPecas();
  `, context);
  assert.equal(opened.length, 0);
  sessionOk = true;
  await vm.runInContext("validarCompartilhamento()", context);
  assert.equal(elements.get("compartilharPecas").hidden, false);
  vm.runInContext("compartilharPecas()", context);
  const url = new URL(opened[0]);
  assert.equal(url.origin, "https://api.whatsapp.com");
  assert.equal(url.searchParams.has("phone"), false);
  const message = url.searchParams.get("text");
  assert.match(message, /📦 ORÇAMENTO DE PEÇAS:/);
  assert.match(message, /📱 TELA PARA A01/);
  assert.match(message, /\(1\) Tela B R\$50\.00/);
  assert.match(message, /\(1\) Tela A R\$60\.00/);
  assert.doesNotMatch(message, /Sem estoque/);
  assert.doesNotMatch(message, /Bateria|70\.00/);
  assert.ok(message.indexOf("Tela A") < message.indexOf("Tela B"));
  vm.runInContext(`pesquisaAtual = 'inexistente'; renderPecas(); compartilharPecas();`, context);
  assert.equal(opened.length, 1);
  assert.equal(elements.get("compartilharPecas").disabled, true);
  networkError = true;
  await vm.runInContext("validarCompartilhamento()", context);
  assert.equal(elements.get("compartilharPecas").hidden, true);
  vm.runInContext("pesquisaAtual = ''; renderPecas(); compartilharPecas();", context);
  assert.equal(opened.length, 1);
});

test("Mensagem de pedido mantém quantidade, observação e formato antigo", () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(read("public/js/mensagem-pecas.js"), context);
  const result = context.window.OrderUpMensagemPecas([
    { nome: "Tela (Preto)", qt: 2, preco: 50, tipo: "Tela", modelo: "A01" },
  ], "Retirada", "PEDIDO DE PEÇAS:", false);
  assert.equal(result, "📦 PEDIDO DE PEÇAS:\n\n(2) Tela (Preto) R$50.00\n\n📌 Observações: Retirada\n");
  assert.doesNotMatch(read("public/html/carrinho.html"), /botao-compartilhar-orcamento/);
});
