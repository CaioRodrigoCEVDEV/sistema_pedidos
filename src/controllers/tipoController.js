const pool = require("../config/db");
const { parseIntegerParam } = require("../utils/parseIntegerParam");

exports.listarTipo = async (req, res) => {
  const modeloId = parseIntegerParam(req.params.id);

  if (modeloId === null) {
    return res.status(400).json({ error: "Modelo invalido ou nao informado" });
  }

  // ?comTotal=1 devolve, na mesma consulta, a quantidade de peças por tipo
  // (mesma relação usada na tela de peças: pro + promod pelo modelo/marca).
  // Mantido opcional para não pesar as chamadas do painel administrativo.
  const comTotal = String(req.query.comTotal || "") === "1";

  try {
    const query = comTotal
      ? `WITH contagens AS (
           SELECT p.protipocod AS tipocod,
                  p.promarcascod,
                  COUNT(DISTINCT p.procod)::int AS total
             FROM pro p
            WHERE p.promodcod = $1
               OR EXISTS (
                    SELECT 1 FROM promod pm
                     WHERE pm.promodprocod = p.procod
                       AND pm.promodmodcod = $1
                  )
            GROUP BY p.protipocod, p.promarcascod
         )
         SELECT v.tipocod, v.tipodes, v.promarcascod, v.promodcod,
                COALESCE(c.total, 0) AS total
           FROM vw_tipo_pecas v
           LEFT JOIN contagens c
             ON c.tipocod = v.tipocod
            AND c.promarcascod = v.promarcascod
          WHERE v.promodcod = $1
          ORDER BY v.tipoordem`
      : "select tipocod,tipodes, promarcascod,promodcod from vw_tipo_pecas where promodcod = $1 order by tipoordem";

    const result = await pool.query(query, [modeloId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar tipo" });
  }
};

exports.buscarTipo = async (req, res) => {
  const tipoId = parseIntegerParam(req.params.id);
  const modeloId = parseIntegerParam(req.query.modelo);

  if (tipoId === null) {
    return res.status(400).json({ error: "Tipo de peca invalido ou nao informado" });
  }

  if (modeloId === null) {
    return res.status(400).json({ error: "Modelo invalido ou nao informado" });
  }

  try {
    const result = await pool.query(
      "select  tipocod,tipodes, promarcascod,promodcod from vw_tipo_pecas  where promodcod = $1 AND tipocod = $2",
      [modeloId, tipoId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar tipo" });
  }
};

exports.listarTodosTipos = async (req, res) => {
  try {
    const result = await pool.query("select  tipocod,tipodes from tipo");
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar tipo" });
  }
};

exports.inserirTipo = async (req, res) => {
  const { tipodes } = req.body;

  try {
    const result = await pool.query(
      "insert into tipo (tipodes) values ($1) returning *",
      [tipodes]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar novo tipo" });
  }
};

exports.atualizarTipo = async (req, res) => {
  const { tipodes } = req.body;
  const tipoId = parseIntegerParam(req.params.id);

  if (tipoId === null) {
    return res.status(400).json({ error: "Tipo de peca invalido ou nao informado" });
  }

  try {
    const result = await pool.query(
      "update tipo set tipodes = $1 where tipocod = $2 returning *",
      [tipodes, tipoId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao alterar tipo" });
  }
};

exports.deleteTipo = async (req, res) => {
  const tipoId = parseIntegerParam(req.params.id);

  if (tipoId === null) {
    return res.status(400).json({ error: "Tipo de peca invalido ou nao informado" });
  }

  try {
    const result = await pool.query(
      "delete from tipo where tipocod = $1 returning *",
      [tipoId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    if (error.code === "23503") {
      return res
        .status(409)
        .json({
          error:
            "Não é possível excluir este tipo pois existem produtos vinculados a ele.",
        });
    }
    res.status(500).json({ error: "Erro ao excluir tipo" });
  }
};

exports.atualizarOrdemTipos = async (req, res) => {
  try {
    const { ordem } = req.body; // array: [{id, descricao}, ...]

    if (!Array.isArray(ordem)) {
      return res.status(400).json({ message: "Ordem inválida" });
    }

    const ids    = ordem.map((item) => item.id);
    const ordens = ordem.map((_, i) => i + 1);

    await pool.query(
      `UPDATE tipo SET tipoordem = v.ordem
       FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::int[]) AS ordem) AS v
       WHERE tipocod = v.id`,
      [ids, ordens]
    );

    return res.status(200).json({ message: "Ordem atualizada com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar ordem:", error);
    return res.status(500).json({ message: "Erro interno ao atualizar ordem" });
  }
};
