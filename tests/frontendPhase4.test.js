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

before(async () => {
  const app = express();
  app.use(require("cookie-parser")());
  app.use(express.json());
  app.use(require("../src/routes/pedidosRoutes"));
  app.use(require("../src/routes/devolucoesRoutes"));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  pool.query = originalQuery;
  await new Promise((resolve) => server.close(resolve));
});

function token(overrides = {}) {
  return jwt.sign({ usucod: 1, usunome: "Teste", usuadm: "N", empusapv: "S", usupv: "S", ...overrides }, "chave-secreta", { expiresIn: "5m" });
}
function get(path, auth) {
  return fetch(origin + path, { headers: { Accept: "application/json", ...(auth ? { Cookie: `token=${auth}` } : {}) }, redirect: "manual" });
}

test("APIs da fase 4 respondem 401 sem sessão", async () => {
  for (const path of ["/pedidos/pendentes", "/devolucoes/itens"]) assert.equal((await get(path)).status, 401);
});

test("módulo de vendas desabilitado bloqueia pedidos e devoluções", async () => {
  const auth = token({ empusapv: "N", usuadm: "S" });
  for (const path of ["/pedidos/pendentes", "/devolucoes/itens"]) assert.equal((await get(path, auth)).status, 403);
});

test("usuário sem módulo de vendas é bloqueado antes da permissão de tela", async () => {
  allow = true;
  const auth = token({ usupv: "N" });
  for (const path of ["/pedidos/pendentes", "/devolucoes/itens"]) assert.equal((await get(path, auth)).status, 403);
});

test("usuário comum precisa da permissão de cada tela", async () => {
  allow = false;
  assert.equal((await get("/pedidos/pendentes", token())).status, 403);
  assert.equal((await get("/devolucoes/itens", token())).status, 403);
  allow = true;
  assert.equal((await get("/pedidos/pendentes", token())).status, 200);
  assert.equal((await get("/devolucoes/itens", token())).status, 200);
});
