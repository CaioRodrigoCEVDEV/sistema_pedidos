// Reconcilia baixas de estoque de grupos que foram perdidas.
//
// Contexto: quando a empresa nao controla estoque (emp.empusaest <> 'S'), o
// trigger atualizar_saldo() nao valida nem movimenta o saldo ao confirmar um
// pedido. Pedidos confirmados nesse periodo continuam contando como venda nos
// relatorios, mas nao geraram part_group_audit nem reduziram o estoque. Este
// script localiza esses pedidos e aplica a baixa retroativa.
//
// Uso:
//   node scripts/reconciliarEstoqueGrupos.js                # dry-run (padrao)
//   node scripts/reconciliarEstoqueGrupos.js --apply        # aplica
//   node scripts/reconciliarEstoqueGrupos.js --apply --enable-stock
//   node scripts/reconciliarEstoqueGrupos.js --apply --force
//
// Flags:
//   --apply         executa as alteracoes (sem isso so mostra o que sera feito)
//   --enable-stock  antes de reconciliar, define emp.empusaest = 'S'
//   --force         permite rodar com empusaest <> 'S' sem --enable-stock
//
// Seguranca:
//   - Idempotente: pula pedido/grupo que ja tenha part_group_audit 'Venda'
//     com o mesmo reference_id (pvcod).
//   - Transacional: qualquer erro desfaz tudo.
//   - Aborta se algum grupo ficar com estoque negativo.
require("dotenv").config();

const pool = require("../src/config/db");

// Mesma resolucao peca/cor/grupo usada por atualizar_saldo() em
// src/config/atualizardb.js. Mantenha as duas em sincronia.
const PENDENTES_SQL = `
  WITH resolvidos AS (
    SELECT i.pvipvcod AS pvcod, pgi.group_id,
           SUM(COALESCE(i.pviqtde, 0)) AS qty
    FROM pvi i
    JOIN LATERAL (
      SELECT pc_resolvida.procorid
      FROM procor pc_resolvida
      WHERE pc_resolvida.procorprocod = i.pviprocod
        AND (
          pc_resolvida.procorcorescod IS NOT DISTINCT FROM i.pviprocorid
          OR (i.pviprocorid IS NULL AND pc_resolvida.procorcorescod = 0)
        )
      ORDER BY
        CASE WHEN pc_resolvida.procorcorescod IS NOT DISTINCT FROM i.pviprocorid
          THEN 0 ELSE 1 END,
        pc_resolvida.procorid
      LIMIT 1
    ) sold_pc ON TRUE
    JOIN part_group_items pgi ON pgi.procorid = sold_pc.procorid
    WHERE COALESCE(i.pviqtde, 0) > 0
    GROUP BY i.pvipvcod, pgi.group_id
  )
  SELECT r.pvcod, r.group_id, r.qty, pg.name AS group_name, pg.stock_quantity AS stock_atual
  FROM resolvidos r
  JOIN pv ON pv.pvcod = r.pvcod
  JOIN part_groups pg ON pg.id = r.group_id
  WHERE TRIM(pv.pvconfirmado) = 'S'
    AND TRIM(pv.pvsta) = 'A'
    AND NOT EXISTS (
      SELECT 1
      FROM part_group_audit a
      WHERE a.part_group_id = r.group_id
        AND a.reference_id = r.pvcod::text
        AND a.reason = 'Venda'
    )
  ORDER BY r.pvcod, r.group_id
`;

async function buscarPendentes(client) {
  const result = await client.query(PENDENTES_SQL);
  return result.rows;
}

// Resume as linhas (pedido, grupo, qty) por grupo.
function resumirPendentes(rows) {
  const porGrupo = new Map();
  const pedidos = new Set();
  for (const row of rows) {
    pedidos.add(row.pvcod);
    if (!porGrupo.has(row.group_id)) {
      porGrupo.set(row.group_id, {
        id: row.group_id,
        nome: row.group_name,
        stockAtual: Number(row.stock_atual),
        baixar: 0,
      });
    }
    porGrupo.get(row.group_id).baixar += Number(row.qty);
  }
  return { porGrupo, pedidos };
}

// Aplica as baixas pendentes usando o client recebido (nao controla a
// transacao: o chamador decide quando dar COMMIT/ROLLBACK). Retorna quantas
// baixas de grupo foram gravadas.
async function aplicarBaixas(client, rows) {
  let aplicados = 0;
  for (const row of rows) {
    const group = await client.query(
      "SELECT COALESCE(stock_quantity, 0) AS stock_quantity FROM part_groups WHERE id = $1 FOR UPDATE",
      [row.group_id]
    );
    if (group.rows.length === 0) {
      throw new Error(`Grupo ${row.group_id} nao encontrado.`);
    }

    const jaBaixado = await client.query(
      `SELECT 1 FROM part_group_audit
        WHERE part_group_id = $1 AND reference_id = $2 AND reason = 'Venda'`,
      [row.group_id, String(row.pvcod)]
    );
    if (jaBaixado.rows.length > 0) continue;

    const estoqueAtual = Number(group.rows[0].stock_quantity);
    const novoEstoque = estoqueAtual - Number(row.qty);
    if (novoEstoque < 0) {
      throw new Error(`Grupo ${row.group_id} ficaria com estoque negativo (${novoEstoque}).`);
    }

    // O trigger trg_sincronizar_estoque_grupo propaga para procor/pro.
    await client.query(
      "UPDATE part_groups SET stock_quantity = $1, updated_at = NOW() WHERE id = $2",
      [novoEstoque, row.group_id]
    );
    await client.query(
      `INSERT INTO part_group_audit (part_group_id, change, reason, reference_id)
       VALUES ($1, $2, 'Venda', $3)`,
      [row.group_id, -Number(row.qty), String(row.pvcod)]
    );
    aplicados++;
  }
  return aplicados;
}

async function getEmpresa(client) {
  const result = await client.query(
    "SELECT TRIM(COALESCE(empusaest, 'N')) AS empusaest FROM emp ORDER BY empcod LIMIT 1"
  );
  return result.rows[0] || null;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const enableStock = args.has("--enable-stock");
  const force = args.has("--force");

  const empresa = await getEmpresa(pool);
  const usaEstoque = empresa && empresa.empusaest === "S";

  console.log(`Controle de estoque (empusaest): ${usaEstoque ? "S" : "N"}`);
  if (apply && !usaEstoque && !enableStock && !force) {
    throw new Error(
      "empusaest <> 'S'. Rode com --enable-stock para ligar o controle ou " +
        "--force se tiver certeza."
    );
  }

  const pendentes = await buscarPendentes(pool);
  if (pendentes.length === 0) {
    console.log("Nenhuma baixa pendente. Banco ja esta consistente.");
    return;
  }

  const { porGrupo, pedidos } = resumirPendentes(pendentes);
  const negativos = [...porGrupo.values()].filter((g) => g.stockAtual - g.baixar < 0);

  console.log(
    `\nBaixas pendentes: ${pendentes.length} (pedido, grupo) em ` +
      `${pedidos.size} pedido(s) e ${porGrupo.size} grupo(s).\n`
  );
  for (const g of [...porGrupo.values()].sort((a, b) => a.id - b.id)) {
    console.log(
      `  grupo ${g.id} "${g.nome}": ${g.stockAtual} - ${g.baixar} = ` +
        `${g.stockAtual - g.baixar}${g.stockAtual - g.baixar < 0 ? "  <-- NEGATIVO" : ""}`
    );
  }

  if (negativos.length > 0) {
    throw new Error(
      "Reconciliacao abortada: haveria estoque negativo em " +
        negativos.map((g) => `"${g.nome}" (#${g.id})`).join(", ") +
        ". Revise os ajustes manuais antes de aplicar."
    );
  }

  if (!apply) {
    console.log("\nDry-run. Nada foi alterado. Rode com --apply para efetivar.");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (enableStock && !usaEstoque) {
      await client.query("UPDATE emp SET empusaest = 'S'");
      console.log("emp.empusaest definido como 'S'.");
    }

    const aplicados = await aplicarBaixas(client, pendentes);

    await client.query("COMMIT");
    console.log(
      `\nReconciliado: ${aplicados} baixa(s) de grupo aplicada(s) em ` +
        `${pedidos.size} pedido(s).`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  PENDENTES_SQL,
  buscarPendentes,
  resumirPendentes,
  aplicarBaixas,
};

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`\nFalha na reconciliacao: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
