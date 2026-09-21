const pool = require("../config/db");
const { parseIntegerParam } = require("../utils/parseIntegerParam");
const {
  modelosCache,
  catalogoNavCache,
  sendCached,
} = require("../utils/catalogListCaches");

exports.listarModelo = async (req, res) => {
  const marcaId = parseIntegerParam(req.params.id);

  if (marcaId === null) {
    return res.status(400).json({ error: "Marca invalida ou nao informada" });
  }

  // ?comTotal=1 devolve, na mesma consulta, a quantidade de tipos de peça
  // por modelo (mesma fonte da tela de tipos: vw_tipo_pecas).
  // Mantido opcional para não pesar as chamadas do painel administrativo.
  const comTotal = String(req.query.comTotal || "") === "1";

  try {
    const query = comTotal
      ? `SELECT m.*, COALESCE(t.total, 0) AS total_tipos
           FROM vw_modelos m
           LEFT JOIN (
             SELECT v.promodcod, COUNT(*)::int AS total
               FROM vw_tipo_pecas v
               JOIN vw_modelos vm ON vm.modcod = v.promodcod
              WHERE vm.modmarcascod = $1
              GROUP BY v.promodcod
           ) t ON t.promodcod = m.modcod
          WHERE m.modmarcascod = $1
          ORDER BY m.ordem`
      : `select * from vw_modelos where modmarcascod = $1 order by ordem`;

    const cacheKey = `modelo:${marcaId}:${comTotal ? 1 : 0}`;
    let entry = catalogoNavCache.get(cacheKey);

    if (!entry) {
      const result = await pool.query(query, [marcaId]);
      entry = catalogoNavCache.set(cacheKey, result.rows);
    }

    return sendCached(req, res, entry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar modelos" });
  }
};

exports.buscarModelo = async (req, res) => {
  const modeloId = parseIntegerParam(req.params.id);

  if (modeloId === null) {
    return res.status(400).json({ error: "Modelo invalido ou nao informado" });
  }

  try {
    const cacheKey = `mod:${modeloId}`;
    let entry = catalogoNavCache.get(cacheKey);

    if (!entry) {
      const result = await pool.query(
        `select * from vw_modelos WHERE modcod = $1;`,
        [modeloId]
      );
      entry = catalogoNavCache.set(cacheKey, result.rows);
    }

    return sendCached(req, res, entry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar modelo" });
  }
};

exports.inserirModelo = async (req, res) => {
  const { moddes, modmarcascod } = req.body;
  const marcaId = parseIntegerParam(modmarcascod);

  if (marcaId === null) {
    return res.status(400).json({ error: "Marca invalida ou nao informada" });
  }

  try {
    const result = await pool.query(
      `insert into modelo (moddes,modmarcascod) values ($1,$2) returning *`,
      [moddes, marcaId]
    );
    modelosCache.invalidate();
    catalogoNavCache.invalidateAll();
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar modelo" });
  }
};

exports.atualizarModelo = async (req, res) => {
  const { moddes, modmarcascod } = req.body;
  const modeloId = parseIntegerParam(req.params.id);
  const marcaId = parseIntegerParam(modmarcascod);

  if (modeloId === null) {
    return res.status(400).json({ error: "Modelo invalido ou nao informado" });
  }

  if (marcaId === null) {
    return res.status(400).json({ error: "Marca invalida ou nao informada" });
  }

  try {
    const result = await pool.query(
      `update modelo set moddes = $1, modmarcascod = $2 where modcod = $3 returning *`,
      [moddes, marcaId, modeloId]
    );
    modelosCache.invalidate();
    catalogoNavCache.invalidateAll();
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao alterar modelo" });
  }
};

exports.deletarModelo = async (req, res) => {
  const modeloId = parseIntegerParam(req.params.id);

  if (modeloId === null) {
    return res.status(400).json({ error: "Modelo invalido ou nao informado" });
  }

  try {
    const result = await pool.query(
      `delete from modelo where modcod = $1 returning *`,
      [modeloId]
    );
    modelosCache.invalidate();
    catalogoNavCache.invalidateAll();
    res.status(200).json(result.rows);
  } catch (error){
    console.error(error);

    if (error.code === '23503') {
      return res.status(409).json({
        error: 'Não é permitido excluir este modelo, pois está vinculado a outros registros.'
      });
    }
    res.status(500).json({ error: "Erro ao excluir modelo" });
  }
};

exports.listarTodosModelos = async (req, res) => {
  const search = String(req.query.search || "").trim();
  const limitParam = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, 200)
    : (search ? 50 : 0);

  try {
    // Sem termo e sem limite: mantém o catálogo completo (telas do painel),
    // agora com cache em memória + ETag (invalidado nos writes de modelo).
    if (!search && limit === 0) {
      let entry = modelosCache.get();
      if (!entry) {
        const result = await pool.query(`select * from vw_modelos `);
        entry = modelosCache.set(result.rows);
      }
      return sendCached(req, res, entry);
    }

    const params = [];
    let where = "";
    if (search) {
      params.push(`%${search}%`);
      where = `WHERE moddes ILIKE $${params.length}`;
    }

    let limitSql = "";
    if (limit > 0) {
      params.push(limit);
      limitSql = `LIMIT $${params.length}`;
    }

    // Mesma ordenação da vw_modelos, agora com filtro no banco e LIMIT.
    const result = await pool.query(
      `SELECT modcod, moddes, modsit, modmarcascod, ordem
         FROM modelo
         ${where}
         ORDER BY substring(moddes::text, '^\\D*'), substring(moddes::text, '\\d+')::integer
         ${limitSql}`,
      params
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar modelos" });
  }
};

exports.atualizarOrdemModelos = async (req, res) => {
  try {
    const { ordem } = req.body; // array: [{id, descricao}, ...]

    if (!Array.isArray(ordem)) {
      return res.status(400).json({ message: "Ordem inválida" });
    }

    const ids    = ordem.map((item) => item.id);
    const ordens = ordem.map((_, i) => i + 1);

    await pool.query(
      `UPDATE modelo SET ordem = v.ordem
       FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::int[]) AS ordem) AS v
       WHERE modcod = v.id`,
      [ids, ordens]
    );

    modelosCache.invalidate();
    catalogoNavCache.invalidateAll();
    return res.status(200).json({ message: "Ordem atualizada com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar ordem:", error);
    return res.status(500).json({ message: "Erro interno ao atualizar ordem" });
  }
};
