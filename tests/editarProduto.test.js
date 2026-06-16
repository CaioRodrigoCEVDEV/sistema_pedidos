const dbPath = require.resolve("../src/config/db");
const controllerPath = require.resolve("../src/controllers/proController");

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertiva falhou");
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message || "assertEqual falhou"}: esperado ${expected}, obtido ${actual}`,
    );
  }
}

function createRes() {
  return {
    _status: 200,
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };
}

function loadControllerWithMock(mockPool) {
  delete require.cache[controllerPath];
  delete require.cache[dbPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: mockPool,
  };
  return require("../src/controllers/proController");
}

async function test(name, fn) {
  testsRun++;
  try {
    await fn();
    console.log(`✅ PASSOU: ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ FALHOU: ${name}`);
    console.log(`   Erro: ${error.message}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log("\n🧪 Testes do editarProduto\n");

  await test("Permite editar sem promodcod no payload", async () => {
    const queries = [];
    const client = {
      async query(sql, params) {
        queries.push({ sql, params });
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
          return {};
        }
        if (sql.includes("UPDATE pro")) {
          return { rows: [{ procod: 1 }], rowCount: 1 };
        }
        throw new Error(`Query inesperada: ${sql}`);
      },
      release() {},
    };

    const controller = loadControllerWithMock({
      connect: async () => client,
    });

    const req = {
      params: { id: "1" },
      body: { prodes: "Teste", provl: "25", prosemest: "N", proacabando: "N" },
    };
    const res = createRes();

    await controller.editarProduto(req, res);

    assertEqual(res._status, 200, "Status deve ser 200");
    assert(
      queries.some(
        (q) => q.sql.includes("UPDATE pro") && !q.sql.includes("promodcod ="),
      ),
      "UPDATE não deve alterar promodcod quando ele não foi informado",
    );
    assert(
      !queries.some((q) => q.sql.includes("DELETE FROM promod")),
      "Não deve atualizar tabela promod sem mudança de modelo",
    );
  });

  await test("Retorna 400 quando promodcod informado é inválido", async () => {
    let connectChamado = false;
    const controller = loadControllerWithMock({
      connect: async () => {
        connectChamado = true;
      },
    });

    const req = {
      params: { id: "1" },
      body: {
        prodes: "Teste",
        provl: "25",
        prosemest: "N",
        proacabando: "N",
        promodcod: "abc",
      },
    };
    const res = createRes();

    await controller.editarProduto(req, res);

    assertEqual(res._status, 400, "Status deve ser 400");
    assertEqual(
      res._body.error,
      "Modelo invalido ou nao informado",
      "Mensagem de erro inválida",
    );
    assert(!connectChamado, "Não deve abrir conexão quando validação falhar");
  });

  await test("Atualiza promod quando promodcod muda", async () => {
    const queries = [];
    const client = {
      async query(sql, params) {
        queries.push({ sql, params });
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
          return {};
        }
        if (sql.includes("SELECT promodcod")) {
          return { rows: [{ promodcod: 10 }] };
        }
        if (sql.includes("UPDATE pro")) {
          return { rows: [{ procod: 1 }], rowCount: 1 };
        }
        if (sql.includes("DELETE FROM promod") || sql.includes("INSERT INTO promod")) {
          return { rows: [], rowCount: 1 };
        }
        throw new Error(`Query inesperada: ${sql}`);
      },
      release() {},
    };

    const controller = loadControllerWithMock({
      connect: async () => client,
    });

    const req = {
      params: { id: "1" },
      body: {
        prodes: "Teste",
        provl: "25",
        prosemest: "N",
        proacabando: "N",
        promodcod: "20",
      },
    };
    const res = createRes();

    await controller.editarProduto(req, res);

    assertEqual(res._status, 200, "Status deve ser 200");
    assert(
      queries.some((q) => q.sql.includes("UPDATE pro") && q.sql.includes("promodcod =")),
      "UPDATE deve incluir promodcod quando informado",
    );
    assert(
      queries.some((q) => q.sql.includes("DELETE FROM promod")),
      "Deve remover vínculos antigos de promod quando modelo muda",
    );
    assert(
      queries.some((q) => q.sql.includes("INSERT INTO promod")),
      "Deve inserir novo vínculo em promod quando modelo muda",
    );
  });

  await test("Não sincroniza promod quando promodcod informado é igual ao atual", async () => {
    const queries = [];
    const client = {
      async query(sql, params) {
        queries.push({ sql, params });
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
          return {};
        }
        if (sql.includes("SELECT promodcod")) {
          return { rows: [{ promodcod: 10 }] };
        }
        if (sql.includes("UPDATE pro")) {
          return { rows: [{ procod: 1 }], rowCount: 1 };
        }
        throw new Error(`Query inesperada: ${sql}`);
      },
      release() {},
    };

    const controller = loadControllerWithMock({
      connect: async () => client,
    });

    const req = {
      params: { id: "1" },
      body: {
        prodes: "Teste",
        provl: "25",
        prosemest: "N",
        proacabando: "N",
        promodcod: "10",
      },
    };
    const res = createRes();

    await controller.editarProduto(req, res);

    assertEqual(res._status, 200, "Status deve ser 200");
    assert(
      !queries.some((q) => q.sql.includes("DELETE FROM promod")),
      "Não deve sincronizar promod quando modelo não mudar",
    );
    assert(
      !queries.some((q) => q.sql.includes("INSERT INTO promod")),
      "Não deve reinserir promod quando modelo não mudar",
    );
  });

  delete require.cache[controllerPath];
  delete require.cache[dbPath];

  console.log(`\n📊 Resultado: ${testsPassed}/${testsRun} passaram`);
  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error("Erro ao executar testes:", error);
  process.exit(1);
});
