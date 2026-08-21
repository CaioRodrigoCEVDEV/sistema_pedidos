const assert = require("assert");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });
const pool = require("../src/config/db");

async function createPart(client, description, stock) {
  const result = await client.query(
    `INSERT INTO pro (prodes, promarcascod, protipocod, provl, proqtde)
     SELECT $1, marcascod, tipocod, 10, $2
     FROM (SELECT marcascod FROM marcas ORDER BY marcascod LIMIT 1) marca
     CROSS JOIN (SELECT tipocod FROM tipo ORDER BY tipocod LIMIT 1) tipo
     RETURNING procod`,
    [description, stock],
  );
  return result.rows[0].procod;
}

async function createOrder(client, items) {
  const sequence = await client.query("SELECT nextval('pv_seq') AS pvcod");
  const pvcod = sequence.rows[0].pvcod;
  await client.query(
    `INSERT INTO pv (pvcod, pvvl, pvobs, pvcanal, pvsta, pvconfirmado)
     VALUES ($1, 10, 'Teste estoque compartilhado', 'BALCAO', 'A', 'N')`,
    [pvcod],
  );
  for (const item of items) {
    await client.query(
      `INSERT INTO pvi (pvipvcod, pviprocod, pviqtde, pvivl, pviprocorid)
       VALUES ($1, $2, $3, 10, $4)`,
      [pvcod, item.procod, item.quantity, item.colorId ?? null],
    );
  }
  return pvcod;
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const groupResult = await client.query(
      `INSERT INTO part_groups (name, stock_quantity)
       VALUES ('Teste aprovação estoque grupo', 8)
       RETURNING id`,
    );
    const groupId = groupResult.rows[0].id;

    const partA = await createPart(client, "Teste grupo sem cor A", 8);
    const procorAResult = await client.query(
      `INSERT INTO procor (procorprocod, procorcorescod, procorqtde)
       VALUES ($1, NULL, 8)
       RETURNING procorid`,
      [partA],
    );
    await client.query(
      "INSERT INTO part_group_items (group_id, procorid) VALUES ($1, $2)",
      [groupId, procorAResult.rows[0].procorid],
    );

    // Cenário reportado: grupo 8, pedido 14. A aprovação precisa falhar.
    const insufficientOrder = await createOrder(client, [
      { procod: partA, quantity: 14 },
    ]);
    await client.query("SAVEPOINT insufficient_stock");
    let insufficientError;
    try {
      await client.query(
        "UPDATE pv SET pvconfirmado = 'S' WHERE pvcod = $1",
        [insufficientOrder],
      );
    } catch (error) {
      insufficientError = error;
      await client.query("ROLLBACK TO SAVEPOINT insufficient_stock");
    }

    assert(insufficientError, "Pedido de 14 deve ser recusado");
    assert.match(insufficientError.message, /Disponível: 8, Solicitado: 14/);

    const rejectedState = await client.query(
      `SELECT TRIM(pv.pvconfirmado) AS status, pg.stock_quantity
       FROM pv
       CROSS JOIN part_groups pg
       WHERE pv.pvcod = $1 AND pg.id = $2`,
      [insufficientOrder, groupId],
    );
    assert.strictEqual(rejectedState.rows[0].status, "N");
    assert.strictEqual(Number(rejectedState.rows[0].stock_quantity), 8);

    // Venda válida: todas as representações do grupo devem terminar em 2.
    await client.query(
      "UPDATE pvi SET pviqtde = 6 WHERE pvipvcod = $1",
      [insufficientOrder],
    );
    await client.query(
      "UPDATE pv SET pvconfirmado = 'S' WHERE pvcod = $1",
      [insufficientOrder],
    );
    const approvedState = await client.query(
      `SELECT pg.stock_quantity, pc.procorqtde, p.proqtde
       FROM part_groups pg
       JOIN part_group_items pgi ON pgi.group_id = pg.id
       JOIN procor pc ON pc.procorid = pgi.procorid
       JOIN pro p ON p.procod = pc.procorprocod
       WHERE pg.id = $1 AND p.procod = $2`,
      [groupId, partA],
    );
    assert.strictEqual(Number(approvedState.rows[0].stock_quantity), 2);
    assert.strictEqual(Number(approvedState.rows[0].procorqtde), 2);
    assert.strictEqual(Number(approvedState.rows[0].proqtde), 2);

    // Cancelar devolve o estoque compartilhado integralmente.
    await client.query("UPDATE pv SET pvsta = 'X' WHERE pvcod = $1", [insufficientOrder]);
    const returnedStock = await client.query(
      "SELECT stock_quantity FROM part_groups WHERE id = $1",
      [groupId],
    );
    assert.strictEqual(Number(returnedStock.rows[0].stock_quantity), 8);

    // Dois itens do mesmo grupo precisam consumir a soma (5 + 4), não cada um isoladamente.
    const partB = await createPart(client, "Teste grupo sem cor B", 8);
    const procorBResult = await client.query(
      `INSERT INTO procor (procorprocod, procorcorescod, procorqtde)
       VALUES ($1, NULL, 8)
       RETURNING procorid`,
      [partB],
    );
    await client.query(
      "INSERT INTO part_group_items (group_id, procorid) VALUES ($1, $2)",
      [groupId, procorBResult.rows[0].procorid],
    );
    const aggregateOrder = await createOrder(client, [
      { procod: partA, quantity: 5 },
      { procod: partB, quantity: 4 },
    ]);
    await client.query("SAVEPOINT aggregate_stock");
    let aggregateError;
    try {
      await client.query("UPDATE pv SET pvconfirmado = 'S' WHERE pvcod = $1", [aggregateOrder]);
    } catch (error) {
      aggregateError = error;
      await client.query("ROLLBACK TO SAVEPOINT aggregate_stock");
    }
    assert(aggregateError, "A soma 9 deve ser recusada para um grupo com estoque 8");
    assert.match(aggregateError.message, /Disponível: 8, Solicitado: 9/);

    await client.query("ROLLBACK");
    console.log("✅ aprovacaoEstoqueGrupo.integration.test.js passou");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error("❌ aprovacaoEstoqueGrupo.integration.test.js falhou");
  console.error(error);
  process.exit(1);
});
