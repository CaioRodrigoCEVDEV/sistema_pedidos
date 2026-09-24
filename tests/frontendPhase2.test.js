const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../src/config/db");
const originalQuery = pool.query;
let allow = false,
  queries = [],
  invoked = [],
  server,
  origin;
pool.query = async (sql, params) => {
  queries.push({ sql, params });
  return { rowCount: allow ? 1 : 0, rows: allow ? [{}] : [] };
};
const controllers = [
  require("../src/controllers/cliController"),
  require("../src/controllers/dashboardController"),
  require("../src/controllers/pedidosControllerV2"),
];
const originals = controllers.map((controller) => ({ ...controller }));
controllers.forEach((controller) =>
  Object.keys(controller).forEach((name) => {
    controller[name] = (_req, res) => {
      invoked.push(name);
      res.json({ ok: true });
    };
  })
);
before(async () => {
  const app = express();
  app.use(require("cookie-parser")());
  app.use(express.json());
  app.use(require("../src/routes/cliRoutes"));
  app.use(require("../src/routes/dashboardRoutes"));
  app.use(require("../src/routes/pedidosRoutesV2"));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  pool.query = originalQuery;
  controllers.forEach((controller, i) => Object.assign(controller, originals[i]));
  await new Promise((resolve) => server.close(resolve));
});
function request(path, role = "N", method = "GET") {
  const token = jwt.sign({ usucod: 123, usuadm: role }, "chave-secreta");
  return fetch(origin + path, {
    method,
    headers: { Cookie: `token=${token}`, Accept: "application/json" },
  });
}
test("APIs migradas negam usuário sem permissão antes de consultar dados", async () => {
  allow = false;
  invoked = [];
  for (const [path, method] of [
    ["/cli", "GET"],
    ["/cli", "POST"],
    ["/cli/1", "PUT"],
    ["/cli/1", "DELETE"],
    ["/cli/1/pedidos/10/itens", "GET"],
    ["/cli/1/cobrancas/1/baixar", "PUT"],
    ["/cli/1/movimentacoes", "POST"],
    ["/dashboard/resumo", "GET"],
    ["/v2/top/produtos/mes", "GET"],
    ["/v2/top/marcas/mes", "GET"],
    ["/v2/pedidos/total/dia", "GET"],
    ["/v2/pedidos/total/anual", "GET"],
  ]) {
    const response = await request(path, "N", method);
    assert.equal(response.status, 403, path);
    assert.match((await response.json()).error, /permissão/);
  }
  assert.deepEqual(invoked, []);
});
test("permissão liberada e administrador acessam as APIs", async () => {
  allow = true;
  assert.equal((await request("/cli")).status, 200);
  assert.equal((await request("/dashboard/resumo")).status, 200);
  allow = false;
  queries = [];
  assert.equal((await request("/cli", "S")).status, 200);
  assert.deepEqual(queries, []);
});
test("sem sessão recebe 401 JSON mesmo sem header Accept", async () => {
  for (const path of ["/cli", "/dashboard/resumo", "/v2/top/produtos/mes"]) {
    const response = await fetch(origin + path, { redirect: "manual" });
    assert.equal(response.status, 401);
    assert.match(response.headers.get("content-type"), /application\/json/);
  }
});
test("detalhe de pedido recusa vínculo de outro cliente", async () => {
  allow = false;
  const response = {
    status(code) {
      this.code = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  await originals[0].listarItensPedidoCliente({ params: { id: "1", pvcod: "10" } }, response);
  assert.equal(response.code, 404);
  assert.match(response.body.error, /não vinculado/);
});
test("período todos remove padrões de hoje/30 dias/ano sem mudar chamadas antigas", async () => {
  const models = require("../src/models/pedidoModels");
  for (const name of ["topMarcasMes", "topProdutosMes", "totalVendasDia", "totalVendasAnual"]) {
    queries = [];
    await models[name](undefined, undefined, true);
    assert.doesNotMatch(queries[0].sql, /CURRENT_DATE|current_date/);
    queries = [];
    await models[name]();
    assert.match(queries[0].sql, /CURRENT_DATE|current_date/);
    queries = [];
    await models[name]("2026-09-01", "2026-09-21");
    assert.deepEqual(queries[0].params, ["2026-09-01", "2026-09-21"]);
  }
});
