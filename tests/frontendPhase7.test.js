const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const controllers = [require("../src/controllers/proController"), require("../src/controllers/showcaseController"), require("../src/controllers/promocaoController"), require("../src/controllers/pedidosController")];
const originals = controllers.map((controller) => ({ ...controller }));
controllers.forEach((controller) => Object.keys(controller).forEach((name) => { controller[name] = (_req, res) => res.json({ ok: true }); }));
let server, origin;
before(async () => {
  const app = express(); app.use(express.json());
  app.use(require("../src/routes/proRoutes"));
  app.use(require("../src/routes/showcaseRoutes"));
  app.use(require("../src/routes/promocaoRoutes"));
  app.use(require("../src/routes/pedidosRoutes"));
  server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve)); origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { controllers.forEach((controller, index) => Object.assign(controller, originals[index])); await new Promise((resolve) => server.close(resolve)); });

test("APIs necessárias para a loja continuam públicas", async () => {
  for (const [path, options] of [["/pros?page=1&pageSize=24", {}], ["/proCoresDisponiveis/1", {}], ["/showcases", {}], ["/carrinho/precos", { method: "POST", body: JSON.stringify({ itens: [{ id: 1, qt: 1 }] }), headers: { "Content-Type": "application/json" } }], ["/pedidos/sequencia", {}], ["/pedidos/enviar", { method: "POST", body: JSON.stringify({ pvcod: 1, cart: [{ id: 1, qt: 1 }] }), headers: { "Content-Type": "application/json" } }]]) {
    const response = await fetch(origin + path, options);
    assert.equal(response.status, 200, path);
  }
});
