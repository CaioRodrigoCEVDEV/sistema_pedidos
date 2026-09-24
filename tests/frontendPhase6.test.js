const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../src/config/db");

const originalQuery = pool.query;
let allowScreen = false, server, origin;
pool.query = async (sql) => {
  if (String(sql).includes("FROM public.usu_telas")) return { rowCount: allowScreen ? 1 : 0, rows: allowScreen ? [{}] : [] };
  return { rowCount: 1, rows: [] };
};
const controllers = [require("../src/controllers/relatoriosController"), require("../src/controllers/usuarioController"), require("../src/controllers/telaController"), require("../src/controllers/empController")];
const originals = controllers.map((controller) => ({ ...controller }));
controllers.forEach((controller) => Object.keys(controller).forEach((name) => { controller[name] = (_req, res) => res.json({ ok: true }); }));

before(async () => {
  const app = express();
  app.use(require("cookie-parser")()); app.use(express.json());
  app.use(require("../src/routes/relatoriosRoutes"));
  app.use(require("../src/routes/usuarioRoute"));
  app.use(require("../src/routes/telaRoutes"));
  app.use(require("../src/routes/empRoutes"));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  pool.query = originalQuery;
  controllers.forEach((controller, index) => Object.assign(controller, originals[index]));
  await new Promise((resolve) => server.close(resolve));
});
function token(overrides = {}) { return jwt.sign({ usucod: 1, usuadm: "N", ...overrides }, "chave-secreta", { expiresIn: "5m" }); }
function request(path, auth, options = {}) { return fetch(origin + path, { ...options, headers: { Accept: "application/json", "Content-Type": "application/json", ...(auth ? { Cookie: `token=${auth}` } : {}), ...options.headers } }); }

test("relatórios exigem a permissão da tela", async () => {
  assert.equal((await request("/v2/relatorios/top-pecas")).status, 401);
  allowScreen = false;
  assert.equal((await request("/v2/relatorios/top-pecas", token())).status, 403);
  allowScreen = true;
  assert.equal((await request("/v2/relatorios/top-pecas", token())).status, 200);
});

test("usuários, catálogo de telas e configurações exigem administrador", async () => {
  const regular = token(), admin = token({ usuadm: "S" });
  for (const [path, options] of [["/usuario/listar/", {}], ["/telas", {}], ["/emp", { method: "PUT", body: "{}" }], ["/emp/estoque", { method: "PUT", body: "{}" }]]) {
    assert.equal((await request(path, regular, options)).status, 403, path);
    assert.equal((await request(path, admin, options)).status, 200, path);
  }
});

test("perfil não permite alterar outra conta", async () => {
  const controller = require("../src/controllers/loginController");
  let status = 200, body;
  const res = { status(code) { status = code; return this; }, json(value) { body = value; return this; } };
  await controller.atualizarCadastro({ params: { id: "99" }, token: { usucod: 1 }, body: { usunome: "Teste", ususenha: "nova" } }, res);
  assert.equal(status, 403);
  assert.match(body.error, /próprio perfil/i);
});
