const pool = require("../config/db");

/**
 * Modelo de Grupos de Compatibilidade (Part Groups)
 *
 * Gerencia os grupos de compatibilidade para estoque compartilhado.
 * Peças no mesmo grupo compartilham a mesma quantidade de estoque.
 *
 * Estrutura das tabelas:
 * - part_groups: Tabela principal dos grupos (id INTEGER, name, stock_quantity)
 * - part_group_audit: Histórico de movimentações de estoque
 * - pro.part_group_id: Coluna FK que vincula uma peça a um grupo
 *
 * IMPORTANTE: O campo id usa INTEGER simples (auto increment), não UUID.
 */

/**
 * Lista todos os grupos de compatibilidade com contagem de peças
 * @returns {Array} Lista de grupos com informações resumidas
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
 * Busca um grupo específico pelo ID, incluindo suas peças
 * @param {number} groupId - ID do grupo (INTEGER)
 * @returns {Object|null} Dados do grupo com lista de peças ou null se não encontrado
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
 * Busca o grupo de uma peça específica
 * @param {number} partId - ID da peça (procod)
 * @returns {Object|null} Dados do grupo ou null se a peça não pertence a nenhum grupo
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
 * Caso contrário, retorna o estoque individual da peça (proqtde)
 * @param {number} partId - ID da peça (procod)
 * @returns {Object|null} Informações de estoque ou null se peça não encontrada
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
 * Usa SELECT ... FOR UPDATE para evitar condições de corrida (race conditions)
 * Se a peça não pertence a um grupo, decrementa o estoque individual
 * @param {number} partId - ID da peça (procod)
 * @param {number} qty - Quantidade a decrementar
 * @param {object} client - Cliente de transação (opcional, cria nova transação se não fornecido)
 * @returns {object} Resultado com status de sucesso e estoque atualizado
 * @throws {Error} Se estoque insuficiente ou peça não encontrada
 */
async function decrementGroupStock(partId, qty, client = null) {
  const shouldCommit = !client;
  const txClient = client || (await pool.connect());

  try {
    if (shouldCommit) await txClient.query("BEGIN");

    // Busca a peça e seu grupo com bloqueio para atualização
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
      // Peça não pertence a nenhum grupo, decrementa estoque individual
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
      throw new Error("Grupo de compatibilidade não encontrado");
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
 * Se a peça não pertence a um grupo, incrementa o estoque individual
 * @param {number} partId - ID da peça (procod)
 * @param {number} qty - Quantidade a incrementar
 * @param {string} reason - Motivo do incremento (ex: 'manual', 'devolução')
 * @param {object} client - Cliente de transação (opcional)
 * @returns {object} Resultado com status de sucesso e estoque atualizado
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
      // Peça não pertence a nenhum grupo, incrementa estoque individual
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
 * Cria um novo grupo de compatibilidade
 * @param {string} name - Nome do grupo
 * @param {number} stockQuantity - Quantidade inicial de estoque (padrão: 0)
 * @returns {Object} Grupo criado
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
 * Atualiza um grupo de compatibilidade
 * @param {number} groupId - ID do grupo (INTEGER)
 * @param {string} name - Novo nome do grupo
 * @param {number|null} stockQuantity - Nova quantidade de estoque (opcional)
 * @returns {Object|null} Grupo atualizado ou null se não encontrado
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
 * Exclui um grupo de compatibilidade
 * As peças vinculadas terão part_group_id definido como NULL (ON DELETE SET NULL)
 * @param {number} groupId - ID do grupo (INTEGER)
 * @returns {Object|null} Grupo excluído ou null se não encontrado
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
 * @returns {Object|null} Peça atualizada ou null se não encontrada
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
 * Remove uma peça do seu grupo de compatibilidade (define part_group_id como NULL)
 * @param {number} partId - ID da peça (procod)
 * @returns {Object|null} Peça atualizada ou null se não encontrada
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
 * Busca peças disponíveis para agrupamento
 * Retorna peças que não estão em nenhum grupo ou que estão no grupo especificado
 * @param {number|null} currentGroupId - ID do grupo atual (opcional)
 * @returns {Array} Lista de peças disponíveis
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
 * Busca todas as peças disponíveis para agrupamento (lista completa)
 * @returns {Array} Lista de todas as peças
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
 * @param {number} limit - Quantidade máxima de registros (padrão: 50)
 * @returns {Array} Lista de registros de auditoria
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
 * Cria registro de auditoria automaticamente
 * @param {number} groupId - ID do grupo (INTEGER)
 * @param {number} newQuantity - Nova quantidade de estoque
 * @param {string} reason - Motivo do ajuste (padrão: 'manual_adjustment')
 * @returns {Object} Grupo atualizado
 */
async function updateGroupStock(
  groupId,
  newQuantity,
  reason = "Ajuste_Manual"
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

/**
 * Valida e decrementa estoque para múltiplos itens de venda em uma única transação atômica.
 *
 * Esta função implementa a lógica de sincronização de estoque entre grupos:
 * - Para peças sem grupo: decrementa apenas o estoque individual (proqtde)
 * - Para peças com grupo:
 *   a) Se o grupo tem stock_quantity definido (não nulo): usa esse campo como fonte da verdade
 *      e sincroniza todas as peças do grupo para o mesmo valor
 *   b) Se o grupo NÃO tem stock_quantity definido: valida e decrementa cada peça individualmente
 *
 * @param {Array<{partId: number, quantidade: number}>} itens - Lista de itens a vender
 * @param {string} referenceId - ID de referência para auditoria (ex: pvcod)
 * @returns {Object} Resultado com status de sucesso e detalhes
 * @throws {Error} Se estoque insuficiente ou qualquer erro de validação
 */
async function venderItens(itens, referenceId = null) {
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error("Lista de itens vazia ou inválida");
  }

  // Sanitiza o referenceId - apenas caracteres alfanuméricos, hífen e underscore são permitidos
  let sanitizedReferenceId = null;
  if (referenceId !== null && referenceId !== undefined) {
    sanitizedReferenceId = String(referenceId).replace(/[^a-zA-Z0-9_-]/g, "");
    if (sanitizedReferenceId.length > 100) {
      sanitizedReferenceId = sanitizedReferenceId.substring(0, 100);
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const resultados = [];
    const gruposProcessados = new Map(); // Para evitar processar o mesmo grupo múltiplas vezes

    for (const item of itens) {
      const { partId, quantidade } = item;

      if (!partId || !quantidade || quantidade <= 0) {
        throw new Error(
          `Item inválido: partId=${partId}, quantidade=${quantidade}`
        );
      }

      // Busca a peça com bloqueio para atualização
      const partResult = await client.query(
        `
        SELECT p.procod, p.prodes, p.part_group_id, p.proqtde
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

      // CASO 1: Peça não pertence a nenhum grupo
      if (!part.part_group_id) {
        // Verifica estoque individual
        if (part.proqtde < quantidade) {
          throw new Error(
            `Estoque insuficiente para a peça "${part.prodes}" (ID: ${partId}). ` +
              `Disponível: ${part.proqtde}, Solicitado: ${quantidade}`
          );
        }

        // Decrementa estoque individual
        const updateResult = await client.query(
          `
          UPDATE pro 
          SET proqtde = proqtde - $1
          WHERE procod = $2
          RETURNING proqtde
        `,
          [quantidade, partId]
        );

        resultados.push({
          partId,
          partName: part.prodes,
          quantidadeVendida: quantidade,
          novoEstoque: updateResult.rows[0].proqtde,
          grupoPertence: false,
        });

        continue;
      }

      // CASO 2: Peça pertence a um grupo
      const groupId = part.part_group_id;

      // Verifica se já processamos este grupo (para itens do mesmo grupo no carrinho)
      if (gruposProcessados.has(groupId)) {
        // Acumula a quantidade adicional para o mesmo grupo
        gruposProcessados.get(groupId).quantidadeTotal += quantidade;
        gruposProcessados
          .get(groupId)
          .itens.push({ partId, partName: part.prodes, quantidade });
        continue;
      }

      // Marca o grupo como em processamento
      gruposProcessados.set(groupId, {
        quantidadeTotal: quantidade,
        itens: [{ partId, partName: part.prodes, quantidade }],
      });
    }

    // Processa cada grupo acumulado
    for (const [groupId, grupoInfo] of gruposProcessados) {
      const { quantidadeTotal, itens: itensDoGrupo } = grupoInfo;

      // Busca e bloqueia o grupo para atualização
      const groupResult = await client.query(
        `
        SELECT id, name, stock_quantity
        FROM part_groups
        WHERE id = $1
        FOR UPDATE
      `,
        [groupId]
      );

      if (groupResult.rows.length === 0) {
        throw new Error(
          `Grupo de compatibilidade (ID: ${groupId}) não encontrado`
        );
      }

      const group = groupResult.rows[0];

      // CASO 2a: Grupo TEM stock_quantity definido (não nulo)
      // Neste caso, todas as peças do grupo compartilham o mesmo estoque conceitual.
      // Ao vender, decrementamos todas as peças simultaneamente.
      if (group.stock_quantity !== null) {
        // Busca todas as peças do grupo com bloqueio para validação e atualização
        const pecasGrupoResult = await client.query(
          `
          SELECT procod, prodes, proqtde
          FROM pro
          WHERE part_group_id = $1
          ORDER BY proqtde DESC, procod ASC
          FOR UPDATE
        `,
          [groupId]
        );

        // Calcula o estoque mínimo disponível no grupo (todas as peças devem poder decrementar)
        const estoqueMinimo = Math.min(
          ...pecasGrupoResult.rows.map((p) => p.proqtde || 0)
        );

        // Valida que o estoque mínimo é suficiente para a quantidade solicitada
        if (estoqueMinimo < quantidadeTotal) {
          throw new Error(
            `Estoque insuficiente no grupo "${group.name}". ` +
              `Disponível: ${estoqueMinimo}, Solicitado: ${quantidadeTotal}`
          );
        }

        // Decrementa o estoque de TODAS as peças do grupo (compartilham estoque)
        await client.query(
          `
          UPDATE pro 
          SET proqtde = proqtde - $1
          WHERE part_group_id = $2
        `,
          [quantidadeTotal, groupId]
        );

        // Atualiza o estoque do grupo para MIN(estoque das peças)
        const minEstoqueResult = await client.query(
          `
          SELECT COALESCE(MIN(proqtde), 0) as min_estoque
          FROM pro
          WHERE part_group_id = $1
        `,
          [groupId]
        );

        const novoEstoqueGrupo = minEstoqueResult.rows[0].min_estoque;

        // Atualiza o estoque do grupo
        await client.query(
          `
          UPDATE part_groups 
          SET stock_quantity = $1, updated_at = NOW()
          WHERE id = $2
        `,
          [novoEstoqueGrupo, groupId]
        );

        // Cria registros de auditoria para cada peça vendida
        // reference_id é o código do produto (procod) para identificar a peça no histórico
        for (const itemGrupo of itensDoGrupo) {
          await client.query(
            `
            INSERT INTO part_group_audit (part_group_id, change, reason, reference_id)
            VALUES ($1, $2, $3, $4)
          `,
            [groupId, -itemGrupo.quantidade, "Venda", String(itemGrupo.partId)]
          );

          resultados.push({
            partId: itemGrupo.partId,
            partName: itemGrupo.partName,
            quantidadeVendida: itemGrupo.quantidade,
            novoEstoque: novoEstoqueGrupo,
            grupoPertence: true,
            grupoId: groupId,
            grupoNome: group.name,
            estoqueGrupoUsado: true,
          });
        }
      } else {
        // CASO 2b: Grupo NÃO tem stock_quantity definido (nulo)
        // Distribui a retirada entre as peças do grupo, preferindo peças com maior estoque

        // Busca todas as peças do grupo com bloqueio, ordenadas por estoque DESC, id ASC
        const pecasGrupoResult = await client.query(
          `
          SELECT procod, prodes, proqtde
          FROM pro
          WHERE part_group_id = $1
          ORDER BY proqtde DESC, procod ASC
          FOR UPDATE
        `,
          [groupId]
        );

        // Calcula o estoque total disponível no grupo
        const estoqueTotal = pecasGrupoResult.rows.reduce(
          (sum, p) => sum + (p.proqtde || 0),
          0
        );

        // Valida que o estoque total do grupo é suficiente
        if (estoqueTotal < quantidadeTotal) {
          throw new Error(
            `Estoque insuficiente no grupo "${group.name}". ` +
              `Disponível (soma das peças): ${estoqueTotal}, Solicitado: ${quantidadeTotal}`
          );
        }

        // Distribui a retirada entre as peças, começando pelas de maior estoque
        let restanteATirar = quantidadeTotal;
        const pecasAfetadas = [];

        for (const pecaGrupo of pecasGrupoResult.rows) {
          if (restanteATirar <= 0) break;

          const estoqueAtual = pecaGrupo.proqtde || 0;
          const tirarDestaPeca = Math.min(estoqueAtual, restanteATirar);

          if (tirarDestaPeca > 0) {
            // Atualiza o estoque desta peça
            await client.query(
              `
              UPDATE pro 
              SET proqtde = proqtde - $1
              WHERE procod = $2
            `,
              [tirarDestaPeca, pecaGrupo.procod]
            );

            pecasAfetadas.push({
              procod: pecaGrupo.procod,
              prodes: pecaGrupo.prodes,
              quantidadeRetirada: tirarDestaPeca,
              novoEstoque: estoqueAtual - tirarDestaPeca,
            });

            restanteATirar -= tirarDestaPeca;
          }
        }

        // Cria registros de auditoria para cada peça afetada
        // reference_id é o código do produto (procod) para identificar a peça no histórico
        for (const pecaAfetada of pecasAfetadas) {
          await client.query(
            `
            INSERT INTO part_group_audit (part_group_id, change, reason, reference_id)
            VALUES ($1, $2, $3, $4)
          `,
            [
              groupId,
              -pecaAfetada.quantidadeRetirada,
              "Venda",
              String(pecaAfetada.procod),
            ]
          );
        }

        for (const itemGrupo of itensDoGrupo) {
          resultados.push({
            partId: itemGrupo.partId,
            partName: itemGrupo.partName,
            quantidadeVendida: itemGrupo.quantidade,
            novoEstoque: null, // Cada peça pode ter estoque diferente após a distribuição
            grupoPertence: true,
            grupoId: groupId,
            grupoNome: group.name,
            estoqueGrupoUsado: false,
            pecasAfetadas: pecasAfetadas,
          });
        }
      }
    }

    await client.query("COMMIT");

    return {
      success: true,
      itensProcessados: resultados,
      totalItens: itens.length,
    };
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
  venderItens,
};
