import { test } from "node:test";
import assert from "node:assert/strict";
import { apiRequest, ApiError } from "../src/api/client.js";

test("usa cookie da mesma origem, JSON explícito e preserva cancelamento", async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async (path, options) => {
    assert.equal(path, "/cli?page=2");
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers.get("Accept"), "application/json");
    assert.equal(options.signal, controller.signal);
    return Response.json({ items: [] });
  });
  assert.deepEqual(await apiRequest("/cli?page=2", { signal: controller.signal }), { items: [] });
});

test("envia JSON e mantém headers adicionais", async (t) => {
  t.mock.method(globalThis, "fetch", async (_path, options) => {
    assert.equal(options.method, "POST");
    assert.equal(options.headers.get("Content-Type"), "application/json");
    assert.equal(options.headers.get("X-Test"), "ok");
    assert.deepEqual(JSON.parse(options.body), { nome: "Cliente" });
    return Response.json({ id: 1 }, { status: 201 });
  });
  assert.deepEqual(
    await apiRequest("/cli", {
      method: "POST",
      json: { nome: "Cliente" },
      headers: { "X-Test": "ok" },
    }),
    { id: 1 }
  );
});

test("preserva 401, 403 e mensagem do backend", async (t) => {
  for (const status of [401, 403]) {
    const mock = t.mock.method(globalThis, "fetch", async () =>
      Response.json({ error: "Acesso negado" }, { status })
    );
    await assert.rejects(
      apiRequest("/me/permissoes"),
      (error) =>
        error instanceof ApiError && error.status === status && error.message === "Acesso negado"
    );
    mock.mock.restore();
  }
});

test("identifica redirecionamento legado ao login", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({
    redirected: true,
    url: "http://localhost/login",
  }));
  await assert.rejects(apiRequest("/me/usuario"), (error) => error.status === 401);
});

test("rejeita HTML inesperado em vez de tratá-lo como dados", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response("<html>login</html>", {
        headers: { "Content-Type": "text/html" },
      })
  );
  await assert.rejects(apiRequest("/cli"), (error) => error.status === 502);
});

test("aceita resposta vazia 204", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(null, {
        status: 204,
        headers: { "Content-Type": "application/json" },
      })
  );
  assert.equal(await apiRequest("/cli/1", { method: "DELETE" }), null);
});

test("rejeita URLs externas antes de enviar a requisição", async () => {
  for (const path of [
    "https://example.com/cli",
    "//example.com/cli",
    "/\\example.com/cli",
    "cli",
  ]) {
    await assert.rejects(apiRequest(path), /caminho de API relativo/);
  }
});

test("propaga cancelamento sem convertê-lo em falha de sessão", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new DOMException("Cancelado", "AbortError");
  });
  await assert.rejects(apiRequest("/cli"), (error) => error.name === "AbortError");
});
