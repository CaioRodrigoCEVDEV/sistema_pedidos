const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const createFrontendRouter = require("../src/routes/frontendRoutes");
const autenticarToken = require("../src/middlewares/middlewares");

let tempDir;
let server;
let origin;

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "orderup-frontend-"));
  const dist = path.join(tempDir, "dist");
  await fs.mkdir(path.join(dist, "assets"), { recursive: true });
  await fs.writeFile(path.join(dist, "index.html"), '<div id="root">React entry</div>');
  await fs.writeFile(path.join(dist, "assets", "index-abc123.js"), "window.appLoaded = true;");
  const app = express();
  app.use(cookieParser());
  app.use("/app", createFrontendRouter(dist));
  app.use("/loja", createFrontendRouter(dist));
  app.use("/unbuilt", createFrontendRouter(path.join(tempDir, "missing")));
  app.get("/clientes", (_req, res) => res.send("Página antiga"));
  app.get("/cli", (_req, res) => res.json({ items: [] }));
  app.get("/session", autenticarToken, (req, res) => res.json({ name: req.token.usunome }));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
});

test("entrada e acesso direto a subrotas recebem HTML revalidável", async () => {
  for (const route of ["/app", "/app/", "/app/conexao", "/app/futura/tela?pagina=2", "/loja", "/loja/catalogo?marca=1", "/loja/carrinho"]) {
    const response = await fetch(origin + route);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(response.headers.get("cache-control"), /no-cache/);
    assert.match(await response.text(), /React entry/);
  }
});

test("arquivos com hash recebem cache longo e arquivos ausentes não viram HTML", async () => {
  const response = await fetch(origin + "/app/assets/index-abc123.js");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /max-age=31536000/);
  assert.match(response.headers.get("cache-control"), /immutable/);
  for (const route of ["/app/assets/missing.js", "/app/missing.css"]) {
    assert.equal((await fetch(origin + route)).status, 404);
  }
});

test("fallback não captura páginas antigas, APIs ou métodos de escrita", async () => {
  assert.equal(await (await fetch(origin + "/clientes")).text(), "Página antiga");
  assert.deepEqual(await (await fetch(origin + "/cli")).json(), { items: [] });
  assert.equal((await fetch(origin + "/api/inexistente")).status, 404);
  assert.equal((await fetch(origin + "/app/conexao", { method: "POST" })).status, 404);
});

test("sem compilação, retorna mensagem de indisponibilidade", async () => {
  const response = await fetch(origin + "/unbuilt/");
  assert.equal(response.status, 503);
  assert.match(await response.text(), /build:frontend/);
});

test("chamadas JSON sem sessão, com token inválido ou expirado recebem 401 sem redirect", async () => {
  const expired = jwt.sign({ usunome: "Teste" }, "chave-secreta", { expiresIn: -1 });
  for (const token of ["", "invalido", expired]) {
    const response = await fetch(origin + "/session", {
      headers: { Accept: "application/json", Cookie: token ? `token=${token}` : "" },
      redirect: "manual",
    });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("location"), null);
    assert.match((await response.json()).error, /Sessão/);
  }
});

test("navegação HTML sem sessão mantém redirecionamento legado", async () => {
  const response = await fetch(origin + "/session", {
    headers: { Accept: "text/html" },
    redirect: "manual",
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/login");
});

test("sessão válida continua autenticando e renovando cookie HttpOnly", async () => {
  const token = jwt.sign({ usunome: "Teste" }, "chave-secreta", { expiresIn: "5m" });
  const response = await fetch(origin + "/session", {
    headers: { Accept: "application/json", Cookie: `token=${token}` },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { name: "Teste" });
  assert.match(response.headers.get("set-cookie"), /token=.*HttpOnly/);
});

test("cookie renovado exige HTTPS somente quando HTTPS=true", async () => {
  const previous = process.env.HTTPS;
  const token = jwt.sign({ usunome: "Teste" }, "chave-secreta", { expiresIn: "5m" });
  try {
    for (const setting of ["false", "true"]) {
      process.env.HTTPS = setting;
      const response = await fetch(origin + "/session", {
        headers: { Accept: "application/json", Cookie: `token=${token}` },
      });
      assert.equal(/; Secure(?:;|$)/.test(response.headers.get("set-cookie")), setting === "true");
    }
  } finally {
    if (previous === undefined) delete process.env.HTTPS;
    else process.env.HTTPS = previous;
  }
});

