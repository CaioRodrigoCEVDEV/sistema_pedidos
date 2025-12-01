const pool = require("../config/db");

/**
 * Listar todos os grupos de peças ativos
 */
exports.listarGrupos = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT grupcod, grupdes, estoque, grupsit 
       FROM part_grups 
       WHERE grupsit = 'A' 
       ORDER BY grupdes`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar grupos" });
  }
};

/**
 * Buscar um grupo específico por ID
 */
exports.buscarGrupo = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT grupcod, grupdes, estoque, grupsit 
       FROM part_grups 
       WHERE grupcod = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Grupo não encontrado" });
    }
    
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar grupo" });
  }
};

/**
 * Inserir um novo grupo de peças
 */
exports.inserirGrupo = async (req, res) => {
  const { grupdes, estoque } = req.body;

  if (!grupdes || grupdes.trim() === "") {
    return res.status(400).json({ error: "Descrição do grupo é obrigatória" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO part_grups (grupdes, estoque) 
       VALUES ($1, $2) 
       RETURNING *`,
      [grupdes.trim(), estoque !== undefined ? estoque : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar grupo" });
  }
};

/**
 * Atualizar um grupo existente
 */
exports.atualizarGrupo = async (req, res) => {
  const { id } = req.params;
  const { grupdes, estoque } = req.body;

  if (!grupdes || grupdes.trim() === "") {
    return res.status(400).json({ error: "Descrição do grupo é obrigatória" });
  }

  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    // Atualiza o grupo
    const result = await client.query(
      `UPDATE part_grups 
       SET grupdes = $1, estoque = $2 
       WHERE grupcod = $3 
       RETURNING *`,
      [grupdes.trim(), estoque !== undefined ? estoque : null, id]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Grupo não encontrado" });
    }

    // Se o estoque do grupo foi definido, sincroniza todas as peças do grupo
    if (estoque !== null && estoque !== undefined) {
      await client.query(
        `UPDATE pro SET proqtde = $1 WHERE progrupcod = $2`,
        [estoque, id]
      );
    }

    await client.query("COMMIT");
    res.status(200).json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar grupo" });
  } finally {
    client.release();
  }
};

/**
 * Excluir (inativar) um grupo
 */
exports.excluirGrupo = async (req, res) => {
  const { id } = req.params;

  try {
    // Primeiro, desvincula todas as peças do grupo
    await pool.query(
      `UPDATE pro SET progrupcod = NULL WHERE progrupcod = $1`,
      [id]
    );
    
    // Depois, inativa o grupo
    const result = await pool.query(
      `UPDATE part_grups SET grupsit = 'I' WHERE grupcod = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Grupo não encontrado" });
    }

    res.status(200).json({ message: "Grupo excluído com sucesso" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao excluir grupo" });
  }
};

/**
 * Listar peças de um grupo
 */
exports.listarPecasGrupo = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT procod, prodes, proqtde, promarcascod, marcasdes
       FROM pro 
       LEFT JOIN marcas ON marcascod = promarcascod
       WHERE progrupcod = $1 AND prosit = 'A'
       ORDER BY prodes`,
      [id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar peças do grupo" });
  }
};

/**
 * Vincular uma peça a um grupo
 */
exports.vincularPecaGrupo = async (req, res) => {
  const { grupcod, procod } = req.body;

  if (!grupcod || !procod) {
    return res.status(400).json({ error: "grupcod e procod são obrigatórios" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verifica se o grupo existe
    const grupoResult = await client.query(
      `SELECT grupcod, estoque FROM part_grups WHERE grupcod = $1 AND grupsit = 'A'`,
      [grupcod]
    );

    if (grupoResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Grupo não encontrado" });
    }

    // Atualiza a peça para pertencer ao grupo
    const result = await client.query(
      `UPDATE pro SET progrupcod = $1 WHERE procod = $2 RETURNING *`,
      [grupcod, procod]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Peça não encontrada" });
    }

    // Se o grupo tem estoque definido, sincroniza a peça
    const grupo = grupoResult.rows[0];
    if (grupo.estoque !== null) {
      await client.query(
        `UPDATE pro SET proqtde = $1 WHERE procod = $2`,
        [grupo.estoque, procod]
      );
    }

    await client.query("COMMIT");
    res.status(200).json({ message: "Peça vinculada ao grupo com sucesso" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro ao vincular peça ao grupo" });
  } finally {
    client.release();
  }
};

/**
 * Desvincular uma peça de um grupo
 */
exports.desvincularPecaGrupo = async (req, res) => {
  const { procod } = req.params;

  try {
    const result = await pool.query(
      `UPDATE pro SET progrupcod = NULL WHERE procod = $1 RETURNING *`,
      [procod]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Peça não encontrada" });
    }

    res.status(200).json({ message: "Peça desvinculada do grupo com sucesso" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao desvincular peça do grupo" });
  }
};

/**
 * Atualizar estoque do grupo e sincronizar todas as peças
 */
exports.atualizarEstoqueGrupo = async (req, res) => {
  const { id } = req.params;
  const { estoque } = req.body;

  if (estoque === undefined || estoque === null) {
    return res.status(400).json({ error: "Estoque é obrigatório" });
  }

  if (estoque < 0) {
    return res.status(400).json({ error: "Estoque não pode ser negativo" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Atualiza o estoque do grupo
    const grupoResult = await client.query(
      `UPDATE part_grups SET estoque = $1 WHERE grupcod = $2 AND grupsit = 'A' RETURNING *`,
      [estoque, id]
    );

    if (grupoResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Grupo não encontrado" });
    }

    // Sincroniza o estoque de todas as peças do grupo
    await client.query(
      `UPDATE pro SET proqtde = $1 WHERE progrupcod = $2`,
      [estoque, id]
    );

    await client.query("COMMIT");
    res.status(200).json({ 
      message: "Estoque do grupo atualizado e peças sincronizadas com sucesso",
      grupo: grupoResult.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar estoque do grupo" });
  } finally {
    client.release();
  }
};
