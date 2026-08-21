const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const dbModulePath = path.join(repoRoot, "src/config/db.js");
const controllerModulePath = path.join(
  repoRoot,
  "src/controllers/pedidosController.js",
);
const partGroupModulePath = path.join(repoRoot, "src/models/partGroupModels.js");

function createResponse(resolve) {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      resolve({ status: this.statusCode, body });
      return this;
    },
  };
}

async function callConfirmarPedido(queryHandler, body) {
  const originalDbCache = require.cache[dbModulePath];
  const originalControllerCache = require.cache[controllerModulePath];
  const originalPartGroupCache = require.cache[partGroupModulePath];
  const queries = [];
  const client = {
    async query(sql, params) {
      const normalizedSql = String(sql).replace(/\s+/g, " ").trim();
      queries.push({ sql: normalizedSql, params });
      return queryHandler(normalizedSql, params);
    },
    release() {
      queries.push({ sql: "RELEASE" });
    },
  };
  const mockPool = {
    async connect() {
      return client;
    },
    async query() {
      throw new Error("pool.query não deve ser usado na confirmação transacional");
    },
  };

  require.cache[dbModulePath] = {
    id: dbModulePath,
    filename: dbModulePath,
    loaded: true,
    exports: mockPool,
  };
  delete require.cache[partGroupModulePath];
  delete require.cache[controllerModulePath];

  try {
    const controller = require(controllerModulePath);
    const response = await new Promise((resolve) => {
      controller.confirmarPedido(
        { params: { pvcod: "123" }, body },
        createResponse(resolve),
      );
    });
    return { response, queries };
  } finally {
    delete require.cache[controllerModulePath];
    delete require.cache[partGroupModulePath];
    if (originalDbCache) require.cache[dbModulePath] = originalDbCache;
    else delete require.cache[dbModulePath];
    if (originalControllerCache) {
      require.cache[controllerModulePath] = originalControllerCache;
    }
    if (originalPartGroupCache) {
      require.cache[partGroupModulePath] = originalPartGroupCache;
    }
  }
}

function testTriggerUsesCurrentGroupRelationship() {
  const source = fs.readFileSync(
    path.join(repoRoot, "src/config/atualizardb.js"),
    "utf8",
  );

  assert.match(
    source,
    /JOIN part_group_items pgi ON pgi\.procorid = sold_pc\.procorid/,
    "A baixa deve localizar o grupo pela variação cadastrada em part_group_items",
  );
  assert.match(
    source,
    /GROUP BY pgi\.group_id[\s\S]*ORDER BY pgi\.group_id/,
    "Itens do mesmo grupo devem ser somados e bloqueados em ordem estável",
  );
  assert.match(
    source,
    /IF v_available < r\.total_qty THEN[\s\S]*RAISE EXCEPTION 'Estoque insuficiente no grupo/,
    "A confirmação deve ser recusada quando a quantidade supera o grupo",
  );
  assert.doesNotMatch(
    source,
    /GREATEST\(stock_quantity\s*-\s*v_qty/,
    "A baixa não pode mascarar estoque insuficiente zerando o grupo",
  );
  assert.match(
    source,
    /SET stock_quantity = v_new_stock[\s\S]*SET procorqtde = v_new_stock/,
    "O saldo do grupo e de todas as variações deve permanecer sincronizado",
  );
  assert.match(
    source,
    /pc\.procorcorescod IS NULL[\s\S]*SET proqtde = v_new_stock/,
    "Peças sem cor também devem refletir o estoque compartilhado",
  );
}

async function testConfirmationIsAtomic() {
  const { response, queries } = await callConfirmarPedido(
    async (sql) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }
      if (sql.startsWith("SELECT pvconfirmado")) {
        return { rows: [{ pvconfirmado: "N" }] };
      }
      if (sql.startsWith("UPDATE pvi")) {
        return { rows: [{ pviprocod: 10 }] };
      }
      if (sql.startsWith("UPDATE pv SET pvconfirmado")) {
        return { rows: [{ pvcod: 123, pvconfirmado: "S" }] };
      }
      throw new Error(`Consulta inesperada: ${sql}`);
    },
    {
      pvrcacod: 7,
      itens: [{ procod: 10, qtd: 6, pviprocorid: null }],
    },
  );

  assert.strictEqual(response.status, 200);
  const statements = queries.map(({ sql }) => sql);
  assert.strictEqual(statements[0], "BEGIN");
  assert.ok(statements.some((sql) => sql.startsWith("UPDATE pvi")));
  assert.ok(statements.some((sql) => sql.startsWith("UPDATE pv SET pvconfirmado")));
  assert.ok(statements.indexOf("COMMIT") > statements.findIndex((sql) => sql.startsWith("UPDATE pv SET pvconfirmado")));
  assert.strictEqual(statements.at(-1), "RELEASE");
}

async function testInsufficientStockRollsBackApproval() {
  const { response, queries } = await callConfirmarPedido(
    async (sql) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] };
      if (sql.startsWith("SELECT pvconfirmado")) {
        return { rows: [{ pvconfirmado: "N" }] };
      }
      if (sql.startsWith("UPDATE pvi")) {
        return { rows: [{ pviprocod: 10 }] };
      }
      if (sql.startsWith("UPDATE pv SET pvconfirmado")) {
        throw new Error(
          'Estoque insuficiente no grupo "Telas A01". Disponível: 8, Solicitado: 14',
        );
      }
      throw new Error(`Consulta inesperada: ${sql}`);
    },
    {
      pvrcacod: 7,
      itens: [{ procod: 10, qtd: 14, pviprocorid: null }],
    },
  );

  assert.strictEqual(response.status, 409);
  assert.strictEqual(response.body.tipo, "estoque_insuficiente");
  assert.match(response.body.error, /Disponível: 8, Solicitado: 14/);
  const statements = queries.map(({ sql }) => sql);
  assert.ok(statements.includes("ROLLBACK"));
  assert.ok(!statements.includes("COMMIT"));
  assert.strictEqual(statements.at(-1), "RELEASE");
}

async function run() {
  testTriggerUsesCurrentGroupRelationship();
  await testConfirmationIsAtomic();
  await testInsufficientStockRollsBackApproval();
  console.log("✅ aprovacaoEstoqueGrupo.test.js passou");
}

run().catch((error) => {
  console.error("❌ aprovacaoEstoqueGrupo.test.js falhou");
  console.error(error);
  process.exit(1);
});
