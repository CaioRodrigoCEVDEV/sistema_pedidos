const pool = require("../config/db");
const catalogoCache = require("../utils/catalogoCache");
const showcasesCache = require("../utils/showcasesCache");
const { catalogoNavCache } = require("../utils/catalogListCaches");
const proModels = require("../models/proModels");

const inventoryLists = {
  todos: () => proModels.listarTodosProdutos(),
  estoque: () => proModels.listarProdutosComEstoque(),
  zerado: () => proModels.listarProdutosSemEstoque(),
  acabando: () => proModels.listarProdutosComEstoqueAcabando(),
  falta: () => proModels.listarProdutosEmFalta(),
};

exports.listarEstoque = async (req, res) => {
  const status = String(req.query.status || "todos");
  const load = inventoryLists[status];
  if (!load) return res.status(400).json({ error: "Filtro de estoque inválido" });
  try {
    res.status(200).json(await load());
  } catch (error) {
    console.error("Erro ao listar estoque:", error);
    res.status(500).json({ error: "Erro ao buscar estoque" });
  }
};

exports.ajustarEstoque = async (req, res) => {
  const procod = Number(req.params.id);
  const delta = Number(req.body.delta);
  const rawColor = req.body.cor;
  const cor = rawColor === null || rawColor === undefined || rawColor === "" || rawColor === 0 || rawColor === "0"
    ? null
    : Number(rawColor);
  const motivo = String(req.body.motivo || "Ajuste manual").trim().slice(0, 120);
  if (!Number.isInteger(procod) || procod <= 0 || !Number.isInteger(delta) || delta === 0) {
    return res.status(400).json({ error: "Peça e quantidade inteira diferente de zero são obrigatórias" });
  }
  if (cor !== null && (!Number.isInteger(cor) || cor <= 0)) {
    return res.status(400).json({ error: "Cor inválida" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const variation = await client.query(
      `SELECT pc.procorid
         FROM procor pc
        WHERE pc.procorprocod = $1
          AND (pc.procorcorescod IS NOT DISTINCT FROM $2::INTEGER
               OR ($2::INTEGER IS NULL AND pc.procorcorescod = 0))
        ORDER BY CASE WHEN pc.procorcorescod IS NOT DISTINCT FROM $2::INTEGER THEN 0 ELSE 1 END
        LIMIT 1`,
      [procod, cor],
    );
    const procorid = variation.rows[0]?.procorid || null;
    let result;
    if (procorid) {
      const groupResult = await client.query(
        `SELECT pg.id, pg.name, pg.stock_quantity
           FROM part_group_items pgi
           JOIN part_groups pg ON pg.id = pgi.group_id
          WHERE pgi.procorid = $1
          FOR UPDATE OF pg`,
        [procorid],
      );
      if (groupResult.rows.length) {
        const group = groupResult.rows[0];
        const quantity = Number(group.stock_quantity) + delta;
        if (quantity < 0) {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: `Estoque insuficiente no grupo ${group.name}. Disponível: ${group.stock_quantity}` });
        }
        await client.query("UPDATE part_groups SET stock_quantity = $1, updated_at = NOW() WHERE id = $2", [quantity, group.id]);
        await client.query(
          `UPDATE procor pc SET procorqtde = $1
             FROM part_group_items pgi
            WHERE pgi.group_id = $2 AND pgi.procorid = pc.procorid`,
          [quantity, group.id],
        );
        await client.query(
          `UPDATE pro p SET proqtde = $1
            WHERE EXISTS (
              SELECT 1 FROM part_group_items pgi
              JOIN procor pc ON pc.procorid = pgi.procorid
              WHERE pgi.group_id = $2 AND pc.procorprocod = p.procod
                AND COALESCE(pc.procorcorescod, 0) = 0
            )`,
          [quantity, group.id],
        );
        await client.query(
          `INSERT INTO part_group_audit (part_group_id, change, reason, reference_id)
           VALUES ($1, $2, $3, $4)`,
          [group.id, delta, motivo || "Ajuste manual", `Peça ${procod}`],
        );
        result = { procod, cor, quantity, groupId: group.id, groupName: group.name };
      } else {
        const updated = await client.query(
          `UPDATE procor SET procorqtde = COALESCE(procorqtde, 0) + $1
            WHERE procorid = $2 AND COALESCE(procorqtde, 0) + $1 >= 0
            RETURNING procorqtde AS quantity`,
          [delta, procorid],
        );
        if (!updated.rows.length) {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: "Estoque insuficiente para esta variação" });
        }
        result = { procod, cor, quantity: Number(updated.rows[0].quantity), groupId: null };
      }
    } else {
      const updated = await client.query(
        `UPDATE pro SET proqtde = COALESCE(proqtde, 0) + $1
          WHERE procod = $2 AND COALESCE(proqtde, 0) + $1 >= 0
          RETURNING proqtde AS quantity`,
        [delta, procod],
      );
      if (!updated.rows.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Peça não encontrada ou estoque insuficiente" });
      }
      result = { procod, cor: null, quantity: Number(updated.rows[0].quantity), groupId: null };
    }
    await client.query("COMMIT");
    catalogoCache.invalidate();
    catalogoNavCache.invalidateAll();
    showcasesCache.invalidate();
    res.status(200).json(result);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erro ao ajustar estoque:", error);
    res.status(500).json({ error: "Erro ao ajustar estoque" });
  } finally {
    client.release();
  }
};

exports.mostrarEstoqueItens = async (req, res) => {

  try {
    const result = await pool.query(
      `select  
        procod,
        marcasdes,
        prodes,
        tipodes,
        case when cornome is null then 'Nenhuma' else cornome end as cornome,
        proqtde 
        from pro 
        join marcas on marcascod = promarcascod  
        join tipo on tipocod = protipocod 
        left join cores on corcod =procor 
        where prosit = 'A'`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar estoque" });
  }
};


exports.mostrarEstoqueItem = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "select  procod,proqtde from pro  where procod = $1",[id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar estoque" });
  }
};

exports.atualizarEstoque = async (req, res) => {
  const { id } = req.params;
  const { proqtde } = req.body;

  try {
    const result = await pool.query(
      "update pro set proqtde = $1 where procod = $2 returning *",
      [proqtde, id]
    );
    catalogoCache.invalidate();
    showcasesCache.invalidate();
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar estoque" });
  }
};
