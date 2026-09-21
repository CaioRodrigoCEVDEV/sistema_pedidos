const assert = require("assert");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });
const pool = require("../src/config/db");
const {
  buscarPendentes,
  aplicarBaixas,
  resumirPendentes,
} = require("../scripts/reconciliarEstoqueGrupos");

async function createPart(client, description, stock) {
  const result = await client.query(
    `INSERT INTO pro (prodes, promarcascod, protipocod, provl, proqtde)
     SELECT $1, marcascod, tipocod, 10, $2
     FROM (SELECT marcascod FROM marcas ORDER BY marcascod LIMIT 1) marca
     CROSS JOIN (SELECT tipocod FROM tipo ORDER BY tipocod LIMIT 1) tipo
     RETURNING procod`,
    [description, stock]
  );
  return result.rows[0].procod;
}

async function run() {
  const client = await pool.connect();
  let orderId;
  let groupId;
  try {
    await client.query("BEGIN");

    // Simula uma empresa sem controle de estoque: a confirmacao nao movimenta
    // o saldo, deixando a baixa pendente para a reconciliacao.
    await client.query("UPDATE emp SET empusaest = 'N'");

    const groupResult = await client.query(
      `INSERT INTO part_groups (name, stock_quantity)
       VALUES ('Teste reconciliacao grupo', 8)
       RETURNING id`
    );
    groupId = groupResult.rows[0].id;

    const procod = await createPart(client, "Teste reconciliacao peca", 8);
    const procorResult = await client.query(
      `INSERT INTO procor (procorprocod, procorcorescod, procorqtde)
       VALUES ($1, NULL, 8)
       RETURNING procorid`,
      [procod]
    );
    await client.query("INSERT INTO part_group_items (group_id, procorid) VALUES ($1, $2)", [
      groupId,
      procorResult.rows[0].procorid,
    ]);

    const sequence = await client.query("SELECT nextval('pv_seq') AS pvcod");
    orderId = Number(sequence.rows[0].pvcod);
    await client.query(
      `INSERT INTO pv (pvcod, pvvl, pvobs, pvcanal, pvsta, pvconfirmado)
       VALUES ($1, 30, 'Teste reconciliacao', 'BALCAO', 'A', 'N')`,
      [orderId]
    );
    await client.query(
      `INSERT INTO pvi (pvipvcod, pviprocod, pviqtde, pvivl, pviprocorid)
       VALUES ($1, $2, 3, 10, NULL)`,
      [orderId, procod]
    );

    // Confirma com empusaest='N': o trigger pula a baixa de proposito.
    await client.query("UPDATE pv SET pvconfirmado = 'S' WHERE pvcod = $1", [orderId]);

    const naoBaixado = await client.query(
      "SELECT COALESCE(stock_quantity, 0) AS stock_quantity FROM part_groups WHERE id = $1",
      [groupId]
    );
    assert.strictEqual(Number(naoBaixado.rows[0].stock_quantity), 8);

    // A reconciliacao deve encontrar exatamente este pedido/grupo.
    const pendentes = await buscarPendentes(client);
    const alvo = pendentes.filter((row) => row.pvcod === orderId && row.group_id === groupId);
    assert.strictEqual(alvo.length, 1, "Baixa pendente deve ser encontrada");
    assert.strictEqual(Number(alvo[0].qty), 3);

    const resumo = resumirPendentes(alvo);
    assert.strictEqual(resumo.porGrupo.get(groupId).baixar, 3);

    // Aplica a baixa retroativa.
    const aplicados = await aplicarBaixas(client, alvo);
    assert.strictEqual(aplicados, 1);

    const apos = await client.query(
      "SELECT COALESCE(stock_quantity, 0) AS stock_quantity FROM part_groups WHERE id = $1",
      [groupId]
    );
    assert.strictEqual(Number(apos.rows[0].stock_quantity), 5);

    const audit = await client.query(
      `SELECT change, reason, reference_id FROM part_group_audit
        WHERE part_group_id = $1 AND reference_id = $2 AND reason = 'Venda'`,
      [groupId, String(orderId)]
    );
    assert.strictEqual(audit.rows.length, 1);
    assert.strictEqual(Number(audit.rows[0].change), -3);

    // Idempotencia: reexecutar nao encontra mais pendencia nem altera o saldo.
    const pendentesDepois = await buscarPendentes(client);
    assert.strictEqual(
      pendentesDepois.filter((row) => row.pvcod === orderId && row.group_id === groupId).length,
      0
    );
    const aplicadosDeNovo = await aplicarBaixas(client, alvo);
    assert.strictEqual(aplicadosDeNovo, 0);

    const apos2 = await client.query(
      "SELECT COALESCE(stock_quantity, 0) AS stock_quantity FROM part_groups WHERE id = $1",
      [groupId]
    );
    assert.strictEqual(Number(apos2.rows[0].stock_quantity), 5);

    await client.query("ROLLBACK");
    console.log("✅ reconciliacaoEstoqueGrupo.test.js passou");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error("❌ reconciliacaoEstoqueGrupo.test.js falhou");
  console.error(error);
  process.exit(1);
});
