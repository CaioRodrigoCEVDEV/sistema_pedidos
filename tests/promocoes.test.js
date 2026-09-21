/**
 * Testes da funcionalidade de Promoções por produto.
 *
 * Valida o cálculo de preço no servidor (percentual e valor fixo), o efeito do
 * status ativo/inativo e as validações do controller.
 *
 * PRÉ-REQUISITOS:
 * - PostgreSQL rodando e .env configurado (os testes usam o banco configurado).
 *
 * COMO EXECUTAR:
 * node tests/promocoes.test.js
 *
 * NOTA: testes de integração. Criam e removem a promoção do produto usado,
 * sem deixar resíduos.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const pool = require("../src/config/db");
const { ensurePromocoesSchema } = require("../src/config/promocoesSchema");
const promocaoModels = require("../src/models/promocaoModels");
const promocaoController = require("../src/controllers/promocaoController");

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertiva falhou");
}

function assertEqual(actual, expected, message) {
  assert(
    actual === expected,
    `${message || "assertEqual falhou"}: esperado ${expected}, obtido ${actual}`
  );
}

async function testar(nome, fn) {
  testsRun++;
  try {
    await fn();
    testsPassed++;
    console.log(`  ok  ${nome}`);
  } catch (error) {
    testsFailed++;
    console.error(`  FAIL ${nome}`);
    console.error(`       ${error.message}`);
  }
}

function callController(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
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
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

async function run() {
  await ensurePromocoesSchema(pool);

  const produtoResult = await pool.query(
    `SELECT procod, provl
       FROM pro
      WHERE provl IS NOT NULL AND provl > 10
      ORDER BY procod
      LIMIT 1`
  );
  assert(produtoResult.rows.length === 1, "Nenhum produto com preço para testar");

  const procod = Number(produtoResult.rows[0].procod);
  const provl = Number(produtoResult.rows[0].provl);

  try {
    await testar("promoção percentual aplica desconto sobre pro.provl", async () => {
      await promocaoModels.salvar({
        procod,
        tipo: "P",
        valor: 10,
        ativo: true,
        dtinicio: null,
        dtfim: null,
      });

      const precos = await promocaoModels.calcularPrecosItens([
        { id: procod, qt: 2 },
      ]);
      assertEqual(precos.length, 1, "deveria retornar 1 item");
      assertEqual(precos[0].provl, provl, "preço original");
      assert(
        Math.abs(precos[0].preco - provl * 0.9) < 0.0001,
        `preço promocional esperado ${provl * 0.9}, obtido ${precos[0].preco}`
      );
    });

    await testar("promoção de valor fixo subtrai do preço", async () => {
      await promocaoModels.salvar({
        procod,
        tipo: "V",
        valor: 5,
        ativo: true,
        dtinicio: null,
        dtfim: null,
      });

      const precos = await promocaoModels.calcularPrecosItens([
        { id: `${procod}-preto`, qt: 1 },
      ]);
      assert(
        Math.abs(precos[0].preco - (provl - 5)) < 0.0001,
        `preço esperado ${provl - 5}, obtido ${precos[0].preco}`
      );
    });

    await testar("promoção inativa não altera o preço", async () => {
      await promocaoModels.atualizar(procod, { ativo: false });

      const precos = await promocaoModels.calcularPrecosItens([
        { id: procod, qt: 1 },
      ]);
      assertEqual(precos[0].preco, provl, "preço com promoção inativa");
      assertEqual(precos[0].provlpromo, null, "sem preço promocional");
    });

    await testar("controller rejeita percentual acima de 100", async () => {
      await promocaoModels.remover(procod);
      const resp = await callController(promocaoController.criar, {
        body: { procod, tipo: "P", valor: 150, ativo: true },
      });
      assertEqual(resp.status, 400, "status esperado 400");
    });

    await testar("controller rejeita valor fixo >= preço do produto", async () => {
      const resp = await callController(promocaoController.criar, {
        body: { procod, tipo: "V", valor: provl, ativo: true },
      });
      assertEqual(resp.status, 400, "status esperado 400");
    });

    await testar("controller cria promoção válida", async () => {
      const resp = await callController(promocaoController.criar, {
        body: { procod, tipo: "V", valor: 5, ativo: true },
      });
      assertEqual(resp.status, 201, "status esperado 201");
      assert(resp.body && resp.body.procod === procod, "procod retornado");
    });
  } finally {
    await promocaoModels.remover(procod).catch(() => {});
  }

  console.log(
    `\n${testsPassed}/${testsRun} testes passaram` +
      (testsFailed ? ` (${testsFailed} falharam)` : "")
  );
  await pool.end();
  process.exit(testsFailed ? 1 : 0);
}

run().catch(async (error) => {
  console.error("Erro ao executar testes:", error);
  await pool.end().catch(() => {});
  process.exit(1);
});
