const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const dbPath = path.join(__dirname, "../src/config/db.js");
const controllerPath = path.join(__dirname, "../src/controllers/estoqueController.js");

async function callAdjustment(handler, body) {
  const oldDb = require.cache[dbPath], oldController = require.cache[controllerPath], queries = [];
  const client = { async query(sql, params) { const normalized = String(sql).replace(/\s+/g, " ").trim(); queries.push({ sql: normalized, params }); return handler(normalized, params); }, release() { queries.push({ sql: "RELEASE" }); } };
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { connect: async () => client, query: async () => { throw new Error("pool.query inesperado"); } } };
  delete require.cache[controllerPath];
  try {
    const controller = require(controllerPath);
    const response = await new Promise((resolve) => controller.ajustarEstoque({ params: { id: "10" }, body }, { code: 200, status(code) { this.code = code; return this; }, json(data) { resolve({ status: this.code, body: data }); } }));
    return { response, queries };
  } finally {
    delete require.cache[controllerPath]; if (oldDb) require.cache[dbPath] = oldDb; else delete require.cache[dbPath]; if (oldController) require.cache[controllerPath] = oldController;
  }
}

test("ajuste de variação agrupada altera o grupo e registra auditoria", async () => {
  const { response, queries } = await callAdjustment(async (sql) => {
    if (["BEGIN", "COMMIT"].includes(sql) || sql.startsWith("UPDATE part_groups") || sql.startsWith("UPDATE procor") || sql.startsWith("UPDATE pro p") || sql.startsWith("INSERT INTO part_group_audit")) return { rows: [] };
    if (sql.startsWith("SELECT pc.procorid")) return { rows: [{ procorid: 20 }] };
    if (sql.startsWith("SELECT pg.id")) return { rows: [{ id: 3, name: "Telas", stock_quantity: 5 }] };
    throw new Error(`Consulta inesperada: ${sql}`);
  }, { delta: 3, cor: 1, motivo: "Reposição" });
  assert.equal(response.status, 200); assert.equal(response.body.quantity, 8); assert.equal(response.body.groupId, 3);
  assert.ok(queries.some(({ sql }) => sql.startsWith("UPDATE procor"))); assert.ok(queries.some(({ sql }) => sql.startsWith("UPDATE pro p")));
  assert.ok(queries.some(({ sql }) => sql.startsWith("INSERT INTO part_group_audit"))); assert.equal(queries.at(-1).sql, "RELEASE");
});

test("saída acima do saldo do grupo desfaz a transação", async () => {
  const { response, queries } = await callAdjustment(async (sql) => {
    if (["BEGIN", "ROLLBACK"].includes(sql)) return { rows: [] };
    if (sql.startsWith("SELECT pc.procorid")) return { rows: [{ procorid: 20 }] };
    if (sql.startsWith("SELECT pg.id")) return { rows: [{ id: 3, name: "Telas", stock_quantity: 2 }] };
    throw new Error(`Consulta inesperada: ${sql}`);
  }, { delta: -3, cor: 1 });
  assert.equal(response.status, 409); assert.match(response.body.error, /Disponível: 2/); assert.ok(queries.some(({ sql }) => sql === "ROLLBACK"));
});

test("ajuste individual soma o delta ao saldo da variação", async () => {
  const { response } = await callAdjustment(async (sql) => {
    if (["BEGIN", "COMMIT"].includes(sql)) return { rows: [] };
    if (sql.startsWith("SELECT pc.procorid")) return { rows: [{ procorid: 20 }] };
    if (sql.startsWith("SELECT pg.id")) return { rows: [] };
    if (sql.startsWith("UPDATE procor")) return { rows: [{ quantity: 7 }] };
    throw new Error(`Consulta inesperada: ${sql}`);
  }, { delta: 2, cor: 1 });
  assert.equal(response.status, 200); assert.equal(response.body.quantity, 7); assert.equal(response.body.groupId, null);
});
