const pool = require("../config/db");

/**
 * Modelo/DAO de Grupos de Peças (Grupos de Compatibilidade)
 * 
 * Este módulo gerencia os grupos de compatibilidade para estoque compartilhado.
 * Peças no mesmo grupo compartilham a mesma quantidade de estoque, útil quando
 * diferentes variantes de peças (ex: fornecedores diferentes) são fisicamente iguais.
 * 
 * Tabelas utilizadas:
 * - part_groups: Armazena os grupos com id (INTEGER), nome e quantidade de estoque
 * - part_group_audit: Histórico de movimentações de estoque por grupo
 * - pro: Tabela de produtos/peças, com part_group_id referenciando o grupo
 */

/**
 * Lista todos os grupos de peças com contagem de peças associadas
 * @returns {Promise<Array>} Lista de grupos com informações resumidas
 */
async function listAllGroups() {
  const result = await pool.query(`
    SELECT 
      pg.id,
      pg.name,
      pg.stock_quantity,
      pg.created_at,
      pg.updated_at,
      COUNT(p.procod) as parts_count
    FROM part_groups pg
    LEFT JOIN pro p ON p.part_group_id = pg.id
    GROUP BY pg.id, pg.name, pg.stock_quantity, pg.created_at, pg.updated_at
    ORDER BY pg.name
  `);
  return result.rows;
}

/**
 * Busca um grupo de peças pelo ID, incluindo as peças associadas
 * @param {number} groupId - ID do grupo (INTEGER)
 * @returns {Promise<Object|null>} Dados do grupo com array de peças ou null se não encontrado
 */
async function getGroupById(groupId) {
  const groupResult = await pool.query(
    `
    SELECT 
      pg.id,
      pg.name,
      pg.stock_quantity,
      pg.created_at,
      pg.updated_at
    FROM part_groups pg
    WHERE pg.id = $1
  `,
    [groupId]
  );

  if (groupResult.rows.length === 0) {
    return null;
  }

  const partsResult = await pool.query(
    `
    SELECT 
      p.procod,
      p.prodes,
      p.provl,
      m.marcasdes,
      t.tipodes
    FROM pro p
    LEFT JOIN marcas m ON m.marcascod = p.promarcascod
    LEFT JOIN tipo t ON t.tipocod = p.protipocod
    WHERE p.part_group_id = $1
    ORDER BY p.prodes
  `,
    [groupId]
  );

  return {
    ...groupResult.rows[0],
    parts: partsResult.rows,
  };
}

/**
 * Busca o grupo ao qual uma peça pertence
 * @param {number} partId - ID da peça (procod)
 * @returns {Promise<Object|null>} Dados do grupo ou null se a peça não pertence a nenhum grupo
 */
async function getGroupByPartId(partId) {
  const result = await pool.query(
    `
    SELECT 
      pg.id,
      pg.name,
      pg.stock_quantity,
      pg.created_at,
      pg.updated_at
    FROM part_groups pg
    JOIN pro p ON p.part_group_id = pg.id
    WHERE p.procod = $1
  `,
    [partId]
  );
  return result.rows[0] || null;
}

/**
 * Obtém a quantidade de estoque para uma peça
 * Se a peça pertence a um grupo, retorna o estoque do grupo
 * Se não pertence a nenhum grupo, retorna o estoque individual da peça (proqtde)
 * @param {number} partId - ID da peça (procod)
 * @returns {Promise<Object|null>} Informações de estoque ou null se não encontrado
 */
async function getGroupStock(partId) {
  const result = await pool.query(
    `
    SELECT 
      CASE 
        WHEN p.part_group_id IS NOT NULL THEN pg.stock_quantity
        ELSE p.proqtde
      END as stock_quantity,
      p.part_group_id,
      pg.id as group_id,
      pg.name as group_name
    FROM pro p
    LEFT JOIN part_groups pg ON pg.id = p.part_group_id
    WHERE p.procod = $1
  `,
    [partId]
  );

  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0];
}

/**
 * Decrementa o estoque do grupo de uma peça com bloqueio de transação
 * Usa SELECT ... FOR UPDATE para prevenir condições de corrida
 * @param {number} partId - ID da peça (procod)
 * @param {number} qty - Quantidade a decrementar
 * @param {object} client - Cliente de transação (opcional, cria nova transação se não fornecido)
 * @returns {Promise<Object>} Resultado com status de sucesso e estoque atualizado
 */
async function decrementGroupStock(partId, qty, client = null) {
  const shouldCommit = !client;
  const txClient = client || (await pool.connect());

  try {
    if (shouldCommit) await txClient.query("BEGIN");

    // Busca a peça e seu grupo com bloqueio para evitar corrida
    const partResult = await txClient.query(
      `
      SELECT p.procod, p.part_group_id, p.prodes
      FROM pro p
      WHERE p.procod = $1
      FOR UPDATE
    `,
      [partId]
    );

    if (partResult.rows.length === 0) {
      throw new Error(`Peça com ID ${partId} não encontrada`);
    }

    const part = partResult.rows[0];

    if (!part.part_group_id) {
      // Peça não pertence a um grupo, decrementa estoque individual
      const updateResult = await txClient.query(
        `
        UPDATE pro 
        SET proqtde = proqtde - $1
        WHERE procod = $2 AND proqtde >= $1
        RETURNING proqtde
      `,
        [qty, partId]
      );

      if (updateResult.rows.length === 0) {
        throw new Error("Estoque insuficiente");
      }

      if (shouldCommit) await txClient.query("COMMIT");
      return {
        success: true,
        newStock: updateResult.rows[0].proqtde,
        groupId: null,
      };
    }

    // Bloqueia e atualiza o estoque do grupo
    const groupResult = await txClient.query(
      `
      SELECT id, stock_quantity, name
      FROM part_groups
      WHERE id = $1
      FOR UPDATE
    `,
      [part.part_group_id]
    );

    if (groupResult.rows.length === 0) {
      throw new Error("Grupo de peças não encontrado");
    }

    const group = groupResult.rows[0];

    if (group.stock_quantity < qty) {
      throw new Error("Estoque do grupo insuficiente");
    }

    // Decrementa o estoque do grupo
    const updateResult = await txClient.query(
      `
      UPDATE part_groups 
      SET stock_quantity = stock_quantity - $1, updated_at = NOW()
      WHERE id = $2 AND stock_quantity >= $1
      RETURNING stock_quantity
    `,
      [qty, part.part_group_id]
    );

    if (updateResult.rows.length === 0) {
      throw new Error("Estoque do grupo insuficiente");
    }

    // Cria registro de auditoria
    await txClient.query(
      `
      INSERT INTO part_group_audit (part_group_id, change, reason, reference_id)
      VALUES ($1, $2, $3, $4)
    `,
      [part.part_group_id, -qty, "sale", partId.toString()]
    );

    if (shouldCommit) await txClient.query("COMMIT");

    return {
      success: true,
      newStock: updateResult.rows[0].stock_quantity,
      groupId: part.part_group_id,
      groupName: group.name,
    };
  } catch (error) {
    if (shouldCommit) await txClient.query("ROLLBACK");
    throw error;
  } finally {
    if (shouldCommit) txClient.release();
  }
}

/**
 * Incrementa o estoque do grupo de uma peça com bloqueio de transação
 * @param {number} partId - ID da peça (procod)
 * @param {number} qty - Quantidade a incrementar
 * @param {string} reason - Motivo do aumento de estoque
 * @param {object} client - Cliente de transação (opcional)
 * @returns {Promise<Object>} Resultado com status de sucesso e estoque atualizado
 */
async function incrementGroupStock(
  partId,
  qty,
  reason = "manual",
  client = null
) {
  const shouldCommit = !client;
  const txClient = client || (await pool.connect());

  try {
    if (shouldCommit) await txClient.query("BEGIN");

    // Busca a peça e seu grupo
    const partResult = await txClient.query(
      `
      SELECT p.procod, p.part_group_id, p.prodes
      FROM pro p
      WHERE p.procod = $1
    `,
      [partId]
    );

    if (partResult.rows.length === 0) {
      throw new Error(`Peça com ID ${partId} não encontrada`);
    }

    const part = partResult.rows[0];

    if (!part.part_group_id) {
      // Peça não pertence a um grupo, incrementa estoque individual
      const updateResult = await txClient.query(
        `
        UPDATE pro 
        SET proqtde = proqtde + $1
        WHERE procod = $2
        RETURNING proqtde
      `,
        [qty, partId]
      );

      if (shouldCommit) await txClient.query("COMMIT");
      return {
        success: true,
        newStock: updateResult.rows[0].proqtde,
        groupId: null,
      };
    }

    // Atualiza o estoque do grupo
    const updateResult = await txClient.query(
      `
      UPDATE part_groups 
      SET stock_quantity = stock_quantity + $1, updated_at = NOW()
      WHERE id = $2
      RETURNING stock_quantity
    `,
      [qty, part.part_group_id]
    );

    // Cria registro de auditoria
    await txClient.query(
      `
      INSERT INTO part_group_audit (part_group_id, change, reason, reference_id)
      VALUES ($1, $2, $3, $4)
    `,
      [part.part_group_id, qty, reason, partId.toString()]
    );

    if (shouldCommit) await txClient.query("COMMIT");

    return {
      success: true,
      newStock: updateResult.rows[0].stock_quantity,
      groupId: part.part_group_id,
    };
  } catch (error) {
    if (shouldCommit) await txClient.query("ROLLBACK");
    throw error;
  } finally {
    if (shouldCommit) txClient.release();
  }
}

/**
 * Cria um novo grupo de peças
 * @param {string} name - Nome do grupo
 * @param {number} stockQuantity - Quantidade inicial de estoque (padrão: 0)
 * @returns {Promise<Object>} Dados do grupo criado
 */
async function createGroup(name, stockQuantity = 0) {
  const result = await pool.query(
    `
    INSERT INTO part_groups (name, stock_quantity)
    VALUES ($1, $2)
    RETURNING *
  `,
    [name, stockQuantity]
  );
  return result.rows[0];
}

/**
 * Atualiza um grupo de peças
 * @param {number} groupId - ID do grupo (INTEGER)
 * @param {string} name - Novo nome do grupo
 * @param {number|null} stockQuantity - Nova quantidade de estoque (opcional)
 * @returns {Promise<Object|null>} Dados do grupo atualizado ou null se não encontrado
 */
async function updateGroup(groupId, name, stockQuantity = null) {
  let query, params;

  if (stockQuantity !== null) {
    query = `
      UPDATE part_groups 
      SET name = $1, stock_quantity = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    params = [name, stockQuantity, groupId];
  } else {
    query = `
      UPDATE part_groups 
      SET name = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    params = [name, groupId];
  }

  const result = await pool.query(query, params);
  return result.rows[0] || null;
}

/**
 * Exclui um grupo de peças
 * As peças associadas terão part_group_id definido como NULL (ON DELETE SET NULL)
 * @param {number} groupId - ID do grupo a ser excluído (INTEGER)
 * @returns {Promise<Object|null>} Dados do grupo excluído ou null se não encontrado
 */
async function deleteGroup(groupId) {
  const result = await pool.query(
    `
    DELETE FROM part_groups WHERE id = $1 RETURNING *
  `,
    [groupId]
  );
  return result.rows[0] || null;
}

/**
 * Adiciona uma peça a um grupo de compatibilidade
 * @param {number} partId - ID da peça (procod)
 * @param {number} groupId - ID do grupo (INTEGER)
 * @returns {Promise<Object|null>} Dados da peça atualizada ou null se não encontrada
 */
async function addPartToGroup(partId, groupId) {
  const result = await pool.query(
    `
    UPDATE pro 
    SET part_group_id = $1
    WHERE procod = $2
    RETURNING procod, prodes, part_group_id
  `,
    [groupId, partId]
  );
  return result.rows[0] || null;
}

/**
 * Remove uma peça do seu grupo (define part_group_id como NULL)
 * @param {number} partId - ID da peça (procod)
 * @returns {Promise<Object|null>} Dados da peça atualizada ou null se não encontrada
 */
async function removePartFromGroup(partId) {
  const result = await pool.query(
    `
    UPDATE pro 
    SET part_group_id = NULL
    WHERE procod = $1
    RETURNING procod, prodes, part_group_id
  `,
    [partId]
  );
  return result.rows[0] || null;
}

/**
 * Busca peças disponíveis para adicionar a um grupo
 * Retorna peças que não pertencem a nenhum grupo ou que já estão no grupo especificado
 * @param {number|null} currentGroupId - ID do grupo atual (para mostrar peças já no grupo)
 * @returns {Promise<Array>} Lista de peças disponíveis
 */
async function getAvailableParts(currentGroupId = null) {
  let query, params;

  if (currentGroupId) {
    query = `
      SELECT 
        p.procod,
        p.prodes,
        p.provl,
        p.proqtde,
        p.part_group_id,
        m.marcasdes,
        t.tipodes
      FROM pro p
      LEFT JOIN marcas m ON m.marcascod = p.promarcascod
      LEFT JOIN tipo t ON t.tipocod = p.protipocod
      WHERE p.part_group_id IS NULL OR p.part_group_id = $1
      ORDER BY p.prodes
    `;
    params = [currentGroupId];
  } else {
    query = `
      SELECT 
        p.procod,
        p.prodes,
        p.provl,
        p.proqtde,
        p.part_group_id,
        m.marcasdes,
        t.tipodes
      FROM pro p
      LEFT JOIN marcas m ON m.marcascod = p.promarcascod
      LEFT JOIN tipo t ON t.tipocod = p.protipocod
      WHERE p.part_group_id IS NULL
      ORDER BY p.prodes
    `;
    params = [];
  }

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Busca todas as peças (para listagem completa no modal de adicionar)
 * @returns {Promise<Array>} Lista de todas as peças
 */
async function getAvailablePart() {
  const query = `
      SELECT 
        p.procod,
        p.prodes,
        p.provl,
        p.proqtde,
        p.part_group_id,
        m.marcasdes,
        t.tipodes
      FROM pro p
      LEFT JOIN marcas m ON m.marcascod = p.promarcascod
      LEFT JOIN tipo t ON t.tipocod = p.protipocod
      ORDER BY p.prodes
    `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * Busca o histórico de auditoria (movimentações) de um grupo
 * @param {number} groupId - ID do grupo (INTEGER)
 * @param {number} limit - Limite de registros a retornar (padrão: 50)
 * @returns {Promise<Array>} Lista de movimentações do grupo
 */
async function getGroupAuditHistory(groupId, limit = 50) {
  const result = await pool.query(
    `
    SELECT 
      a.id,
      a.change,
      a.reason,
      a.reference_id,
      a.created_at,
      p.prodes as part_name
    FROM part_group_audit a
    LEFT JOIN pro p ON p.procod::text = a.reference_id
    WHERE a.part_group_id = $1
    ORDER BY a.created_at DESC
    LIMIT $2
  `,
    [groupId, limit]
  );
  return result.rows;
}

/**
 * Atualiza o estoque de um grupo diretamente (para ajustes manuais)
 * @param {number} groupId - ID do grupo (INTEGER)
 * @param {number} newQuantity - Nova quantidade de estoque
 * @param {string} reason - Motivo do ajuste (padrão: "manual_adjustment")
 * @returns {Promise<Object>} Dados do grupo atualizado
 */
async function updateGroupStock(
  groupId,
  newQuantity,
  reason = "manual_adjustment"
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Busca o estoque atual para calcular a diferença
    const currentResult = await client.query(
      `
      SELECT stock_quantity FROM part_groups WHERE id = $1 FOR UPDATE
    `,
      [groupId]
    );

    if (currentResult.rows.length === 0) {
      throw new Error("Grupo não encontrado");
    }

    const currentStock = currentResult.rows[0].stock_quantity;
    const change = newQuantity - currentStock;

    // Atualiza o estoque
    const updateResult = await client.query(
      `
      UPDATE part_groups 
      SET stock_quantity = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
      [newQuantity, groupId]
    );

    // Cria registro de auditoria se houve alteração
    if (change !== 0) {
      await client.query(
        `
        INSERT INTO part_group_audit (part_group_id, change, reason)
        VALUES ($1, $2, $3)
      `,
        [groupId, change, reason]
      );
    }

    await client.query("COMMIT");
    return updateResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listAllGroups,
  getGroupById,
  getGroupByPartId,
  getGroupStock,
  decrementGroupStock,
  incrementGroupStock,
  createGroup,
  updateGroup,
  deleteGroup,
  addPartToGroup,
  removePartFromGroup,
  getAvailableParts,
  getAvailablePart,
  getGroupAuditHistory,
  updateGroupStock,
};
