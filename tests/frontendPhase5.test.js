const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../src/config/db");

const originalQuery = pool.query;
let allow = false, server, origin;
pool.query = async (sql) => {
  if (String(sql).includes("FROM public.usu_telas")) return { rowCount: allow ? 1 : 0, rows: allow ? [{}] : [] };
  return { rowCount: 1, rows: [] };
};
const controllers = [require("../src/controllers/estoqueController"), require("../src/controllers/relatoriosController"), require("../src/controllers/partGroupController"), require("../src/controllers/proController"), require("../src/controllers/proControllerV2")];
const originals = controllers.map((controller) => ({ ...controller }));
controllers.forEach((controller) => Object.keys(controller).forEach((name) => { controller[name] = (_req, res) => res.json({ ok: true }); }));

before(async () => {
  const app = express(); app.use(require("cookie-parser")()); app.use(express.json()); app.use(require("../src/routes/estoqueRoutes")); app.use(require("../src/routes/proRoutes")); app.use(require("../src/routes/relatoriosRoutes"));
  server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve)); origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { pool.query = originalQuery; controllers.forEach((controller, index) => Object.assign(controller, originals[index])); await new Promise((resolve) => server.close(resolve)); });
function token(overrides = {}) { return jwt.sign({ usucod: 1, usuadm: "N", empusaest: "S", usuest: "S", ...overrides }, "chave-secreta", { expiresIn: "5m" }); }
function get(path, auth) { return fetch(origin + path, { headers: { Accept: "application/json", ...(auth ? { Cookie: `token=${auth}` } : {}) }, redirect: "manual" }); }

test("APIs de estoque exigem sessão", async () => {
  for (const path of ["/api/estoque/itens", "/api/estoque-grupos"]) assert.equal((await get(path)).status, 401);
});
test("permissão de tela protege as APIs da fase 5", async () => {
  allow = false;
  assert.equal((await get("/api/estoque/itens", token())).status, 403);
  assert.equal((await get("/api/estoque-grupos", token())).status, 403);
  allow = true;
  assert.equal((await get("/api/estoque/itens", token())).status, 200);
  assert.equal((await get("/api/estoque-grupos", token())).status, 200);
});
test("rotas legadas de estoque também recusam acesso sem permissão", async () => {
  allow = false;
  for (const path of ["/v2/proComEstoque", "/v2/relatorios/estoque-grupos"]) assert.equal((await get(path, token())).status, 403);
  const response = await fetch(origin + "/pro/estoque/1", { method: "PUT", headers: { Accept: "application/json", "Content-Type": "application/json", Cookie: `token=${token()}` }, body: JSON.stringify({ quantidade: 2 }) });
  assert.equal(response.status, 403);
});
