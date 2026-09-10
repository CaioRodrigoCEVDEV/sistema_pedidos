const assert = require("assert");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });
const pool = require("../src/config/db");
const controller = require("../src/controllers/devolucoesController");

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
  let pvcod;
  let procod;
  let groupId;
  try {
    const base = await pool.query(
      `SELECT
         (SELECT marcascod FROM marcas ORDER BY marcascod LIMIT 1) AS marca,
         (SELECT tipocod FROM tipo ORDER BY tipocod LIMIT 1) AS tipo,
         (SELECT corcod FROM cores WHERE corcod > 0 ORDER BY corcod LIMIT 1) AS cor,
         (SELECT usucod FROM usu ORDER BY usucod LIMIT 1) AS usuario`,
    );
    const { marca, tipo, cor, usuario } = base.rows[0];
    assert(marca && tipo && cor, "Cadastros basicos sao necessarios para o teste");

    const partResult = await pool.query(
      `INSERT INTO pro (prodes, promarcascod, protipocod, provl, proqtde, prosemest)
       VALUES ($1, $2, $3, 10, 0, 'S') RETURNING procod`,
      [`Teste devolucao ${Date.now()}`, marca, tipo],
    );
    procod = partResult.rows[0].procod;
    const groupResult = await pool.query(
      `INSERT INTO part_groups (name, stock_quantity)
       VALUES ($1, 0) RETURNING id`,
      [`Grupo devolucao ${Date.now()}`],
    );
    groupId = groupResult.rows[0].id;
    const procorResult = await pool.query(
      `INSERT INTO procor (procorprocod, procorcorescod, procorqtde, procorsemest)
       VALUES ($1, $2, 0, 'S') RETURNING procorid`,
      [procod, cor],
    );
    await pool.query(
      "INSERT INTO part_group_items (group_id, procorid) VALUES ($1, $2)",
      [groupId, procorResult.rows[0].procorid],
    );

    const orderResult = await pool.query("SELECT nextval('pv_seq') AS pvcod");
    pvcod = orderResult.rows[0].pvcod;
    await pool.query(
      `INSERT INTO pv (pvcod, pvvl, pvobs, pvcanal, pvsta, pvconfirmado, pvrcacod)
       VALUES ($1, 30, 'Teste devolucao', 'BALCAO', 'A', 'S', $2)`,
      [pvcod, usuario || null],
    );
    await pool.query(
      `INSERT INTO pvi (pvipvcod, pviprocod, pviqtde, pvivl, pviprocorid)
       VALUES ($1, $2, 3, 10, $3)`,
      [pvcod, procod, cor],
    );

    const searchBefore = await callController(controller.buscarItensVendidos, {
      query: { q: String(pvcod) },
    });
    assert.strictEqual(searchBefore.status, 200);
    const soldItem = searchBefore.body.find(
      (item) => Number(item.pvcod) === Number(pvcod) && Number(item.procod) === Number(procod),
    );
    assert(soldItem, "Item vendido deve aparecer na busca");
    assert.strictEqual(Number(soldItem.quantidade_disponivel), 3);

    const returned = await callController(controller.registrarDevolucao, {
      token: { usucod: usuario || null },
      body: {
        pvcod,
        procod,
        pviprocorid: cor,
        quantidade: 2,
        motivo: "Defeito",
        observacao: "Teste automatizado",
        reporEstoque: true,
      },
    });
    assert.strictEqual(returned.status, 201);
    assert.strictEqual(returned.body.estoque.tipo, "grupo");

    const stock = await pool.query(
      `SELECT pg.stock_quantity, pc.procorqtde,
              TRIM(pc.procorsemest) AS procorsemest,
              TRIM(p.prosemest) AS prosemest
       FROM part_groups pg
       JOIN part_group_items pgi ON pgi.group_id = pg.id
       JOIN procor pc ON pc.procorid = pgi.procorid
       JOIN pro p ON p.procod = pc.procorprocod
       WHERE pg.id = $1`,
      [groupId],
    );
    assert.strictEqual(Number(stock.rows[0].stock_quantity), 2);
    assert.strictEqual(Number(stock.rows[0].procorqtde), 2);
    assert.strictEqual(stock.rows[0].procorsemest, "N");
    assert.strictEqual(stock.rows[0].prosemest, "N");

    const excessive = await callController(controller.registrarDevolucao, {
      token: { usucod: usuario || null },
      body: {
        pvcod,
        procod,
        pviprocorid: cor,
        quantidade: 2,
        motivo: "Outra tentativa",
        reporEstoque: true,
      },
    });
    assert.strictEqual(excessive.status, 409);
    assert.strictEqual(excessive.body.tipo, "quantidade_devolucao_excedida");

    const finalReturn = await callController(controller.registrarDevolucao, {
      token: { usucod: usuario || null },
      body: {
        pvcod,
        procod,
        pviprocorid: cor,
        quantidade: 1,
        motivo: "Sem condicao de revenda",
        reporEstoque: false,
      },
    });
    assert.strictEqual(finalReturn.status, 201);
    assert.strictEqual(finalReturn.body.estoque.tipo, "nao_reposto");

    const stockAfterNoRestock = await pool.query(
      "SELECT stock_quantity FROM part_groups WHERE id = $1",
      [groupId],
    );
    assert.strictEqual(Number(stockAfterNoRestock.rows[0].stock_quantity), 2);

    const searchAfter = await callController(controller.buscarItensVendidos, {
      query: { q: String(pvcod) },
    });
    assert.strictEqual(searchAfter.status, 200);
    assert.strictEqual(
      searchAfter.body.some((item) => Number(item.procod) === Number(procod)),
      false,
      "Item totalmente devolvido nao deve continuar disponivel",
    );

    console.log("✅ devolucoes.integration.test.js passou");
  } finally {
    if (pvcod) {
      await pool.query(
        "DELETE FROM devolucoes WHERE devpvcod = $1",
        [pvcod],
      ).catch(() => {});
      await pool.query("DELETE FROM pvi WHERE pvipvcod = $1", [pvcod]).catch(() => {});
      await pool.query("DELETE FROM pv WHERE pvcod = $1", [pvcod]).catch(() => {});
    }
    if (groupId) {
      await pool.query("DELETE FROM part_group_audit WHERE part_group_id = $1", [groupId]).catch(() => {});
      await pool.query("DELETE FROM part_group_items WHERE group_id = $1", [groupId]).catch(() => {});
    }
    if (procod) {
      await pool.query("DELETE FROM procor WHERE procorprocod = $1", [procod]).catch(() => {});
      await pool.query("DELETE FROM pro WHERE procod = $1", [procod]).catch(() => {});
    }
    if (groupId) {
      await pool.query("DELETE FROM part_groups WHERE id = $1", [groupId]).catch(() => {});
    }
    await pool.end();
  }
}

run().catch((error) => {
  console.error("❌ devolucoes.integration.test.js falhou");
  console.error(error);
  process.exit(1);
});
