/**
 * Serviço de Gestão de Estoque
 * 
 * Este módulo implementa a lógica de consumo de estoque para itens de pedidos,
 * incluindo a sincronização de estoque entre grupos de compatibilidade.
 * 
 * Funcionalidades:
 * - Consumo de estoque para peças individuais (sem grupo)
 * - Consumo de estoque distribuído entre peças de um grupo
 * - Atualização automática do estoque do grupo (MIN das peças)
 * - Registro de auditoria para cada movimentação
 * - Suporte a transações para garantir atomicidade
 */

const pool = require("../config/db");

/**
 * Consome estoque para um único item (peça).
 * 
 * Lógica de funcionamento:
 * a) Para peças com grupo: consome das peças do grupo, distribuindo a retirada
 *    começando pelas peças com maior estoque (ordenação DESC por estoque).
 * b) Quando o grupo tem part_groups.estoque definido, após decrementar as peças,
 *    atualiza part_groups.estoque = MIN(estoque das peças do grupo).
 * c) Quando o grupo NÃO tem estoque definido (NULL), apenas distribui entre as peças.
 * d) Para peças sem grupo, decrementa apenas o estoque individual da peça.
 * e) Grava registro em part_group_audit com reference_id = código do produto.
 * 
 * @param {number} partId - ID da peça (procod)
 * @param {number} quantidade - Quantidade a consumir
 * @param {string} reason - Motivo do consumo (ex: 'sale', 'cancellation')
 * @param {object} client - Cliente de transação PostgreSQL (opcional)
 * @returns {object} Resultado com detalhes do consumo
 * @throws {Error} Se estoque insuficiente ou peça não encontrada
 */
async function consumirEstoqueParaItem(partId, quantidade, reason = "sale", client = null) {
  const useExternalTransaction = !!client;
  const txClient = client || await pool.connect();

  try {
    if (!useExternalTransaction) {
      await txClient.query("BEGIN");
    }

    // Valida parâmetros
    if (!partId || quantidade <= 0) {
      throw new Error(`Parâmetros inválidos: partId=${partId}, quantidade=${quantidade}`);
    }

    // Busca a peça com bloqueio FOR UPDATE
    const partResult = await txClient.query(
      `SELECT 
        p.procod, 
        p.prodes, 
        p.part_group_id, 
        p.proqtde,
        p.procod::text as reference_code
      FROM pro p
      WHERE p.procod = $1
      FOR UPDATE`,
      [partId]
    );

    if (partResult.rows.length === 0) {
      throw new Error(`Peça com ID ${partId} não encontrada`);
    }

    const part = partResult.rows[0];
    const referenceId = part.reference_code;

    // CASO 1: Peça SEM grupo - decrementa apenas o estoque individual
    if (!part.part_group_id) {
      const estoqueAtual = part.proqtde || 0;

      if (estoqueAtual < quantidade) {
        throw new Error(
          `Estoque insuficiente para a peça "${part.prodes}" (ID: ${partId}). ` +
          `Disponível: ${estoqueAtual}, Solicitado: ${quantidade}`
        );
      }

      // Decrementa estoque individual
      const updateResult = await txClient.query(
        `UPDATE pro 
         SET proqtde = proqtde - $1
         WHERE procod = $2
         RETURNING proqtde`,
        [quantidade, partId]
      );

      if (!useExternalTransaction) {
        await txClient.query("COMMIT");
      }

      return {
        success: true,
        partId,
        partName: part.prodes,
        quantidadeConsumida: quantidade,
        novoEstoque: updateResult.rows[0].proqtde,
        grupoPertence: false,
        grupoId: null
      };
    }

    // CASO 2: Peça COM grupo - consome das peças do grupo
    const groupId = part.part_group_id;

    // Busca o grupo com bloqueio FOR UPDATE
    const groupResult = await txClient.query(
      `SELECT id, name, stock_quantity
       FROM part_groups
       WHERE id = $1
       FOR UPDATE`,
      [groupId]
    );

    if (groupResult.rows.length === 0) {
      throw new Error(`Grupo de compatibilidade (ID: ${groupId}) não encontrado`);
    }

    const group = groupResult.rows[0];

    // Busca todas as peças do grupo com bloqueio, ordenadas por estoque DESC
    const pecasGrupoResult = await txClient.query(
      `SELECT procod, prodes, proqtde,
              procod::text as reference_code
       FROM pro
       WHERE part_group_id = $1
       ORDER BY proqtde DESC, procod ASC
       FOR UPDATE`,
      [groupId]
    );

    const pecasDoGrupo = pecasGrupoResult.rows;

    // Calcula estoque total disponível no grupo
    const estoqueTotal = pecasDoGrupo.reduce(
      (sum, p) => sum + (p.proqtde || 0),
      0
    );

    // Verifica se há estoque suficiente
    if (estoqueTotal < quantidade) {
      throw new Error(
        `Estoque insuficiente no grupo "${group.name}". ` +
        `Disponível: ${estoqueTotal}, Solicitado: ${quantidade}`
      );
    }

    // Distribui a retirada entre as peças, começando pelas de maior estoque
    let restanteATirar = quantidade;
    const pecasAfetadas = [];

    for (const pecaGrupo of pecasDoGrupo) {
      if (restanteATirar <= 0) break;

      const estoqueAtual = pecaGrupo.proqtde || 0;
      const tirarDestaPeca = Math.min(estoqueAtual, restanteATirar);

      if (tirarDestaPeca > 0) {
        // Atualiza o estoque desta peça
        await txClient.query(
          `UPDATE pro 
           SET proqtde = proqtde - $1
           WHERE procod = $2`,
          [tirarDestaPeca, pecaGrupo.procod]
        );

        pecasAfetadas.push({
          procod: pecaGrupo.procod,
          prodes: pecaGrupo.prodes,
          quantidadeRetirada: tirarDestaPeca,
          novoEstoque: estoqueAtual - tirarDestaPeca,
          referenceCode: pecaGrupo.reference_code
        });

        restanteATirar -= tirarDestaPeca;
      }
    }

    // Se o grupo tem stock_quantity definido, atualiza para MIN(estoques das peças)
    if (group.stock_quantity !== null) {
      const minEstoqueResult = await txClient.query(
        `SELECT COALESCE(MIN(proqtde), 0) as min_estoque
         FROM pro
         WHERE part_group_id = $1`,
        [groupId]
      );

      const novoEstoqueGrupo = minEstoqueResult.rows[0].min_estoque;

      await txClient.query(
        `UPDATE part_groups 
         SET stock_quantity = $1, updated_at = NOW()
         WHERE id = $2`,
        [novoEstoqueGrupo, groupId]
      );
    }

    // Grava registros de auditoria para cada peça afetada
    for (const pecaAfetada of pecasAfetadas) {
      await txClient.query(
        `INSERT INTO part_group_audit (part_group_id, change, reason, reference_id)
         VALUES ($1, $2, $3, $4)`,
        [groupId, -pecaAfetada.quantidadeRetirada, reason, pecaAfetada.referenceCode]
      );
    }

    if (!useExternalTransaction) {
      await txClient.query("COMMIT");
    }

    return {
      success: true,
      partId,
      partName: part.prodes,
      quantidadeConsumida: quantidade,
      grupoPertence: true,
      grupoId: groupId,
      grupoNome: group.name,
      pecasAfetadas
    };

  } catch (error) {
    if (!useExternalTransaction) {
      try {
        await txClient.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("[Stock Service] Erro ao fazer rollback:", rollbackError.message);
      }
    }
    throw error;
  } finally {
    if (!useExternalTransaction) {
      txClient.release();
    }
  }
}

/**
 * Consome estoque para múltiplos itens em uma única transação.
 * 
 * CORREÇÃO IMPORTANTE: Agrega itens por partId antes de processar para evitar
 * débito duplicado quando a mesma peça aparece em múltiplas linhas do pedido.
 * 
 * Processa uma lista de itens, consumindo o estoque de cada um em sequência.
 * Se qualquer item falhar (ex: estoque insuficiente), toda a transação é revertida.
 * 
 * @param {Array<{partId: number, quantidade: number}>} itens - Lista de itens
 * @param {string} reason - Motivo do consumo (ex: 'sale')
 * @param {string} referenceId - ID de referência opcional (ex: código do pedido)
 * @param {object} externalClient - Cliente de transação PostgreSQL externo (opcional)
 * @returns {object} Resultado com detalhes de todos os itens processados
 * @throws {Error} Se estoque insuficiente ou qualquer erro de validação
 */
async function consumirEstoqueParaPedido(itens, reason = "sale", referenceId = null, externalClient = null) {
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error("Lista de itens vazia ou inválida");
  }

  const useExternalTransaction = !!externalClient;
  const client = externalClient || await pool.connect();

  try {
    if (!useExternalTransaction) {
      await client.query("BEGIN");
    }

    // CORREÇÃO: Agregar itens por partId ANTES de processar
    // Isso evita débito duplicado quando a mesma peça aparece em múltiplas linhas
    const itensAgregados = new Map();
    for (const item of itens) {
      const { partId, quantidade } = item;

      if (!partId || !quantidade || quantidade <= 0) {
        throw new Error(`Item inválido: partId=${partId}, quantidade=${quantidade}`);
      }

      if (itensAgregados.has(partId)) {
        itensAgregados.get(partId).quantidade += quantidade;
        itensAgregados.get(partId).linhasOriginais++;
      } else {
        itensAgregados.set(partId, {
          partId,
          quantidade,
          linhasOriginais: 1
        });
      }
    }

    console.log(
      `[Stock Service] Itens agregados por partId: ${itens.length} linhas -> ${itensAgregados.size} peças únicas`
    );

    const resultados = [];
    const gruposProcessados = new Map();

    // Processa itens agregados
    for (const [partId, itemAgregado] of itensAgregados) {
      const { quantidade, linhasOriginais } = itemAgregado;

      // Verifica se esta peça pertence a um grupo
      const partResult = await client.query(
        `SELECT procod, part_group_id FROM pro WHERE procod = $1`,
        [partId]
      );

      if (partResult.rows.length === 0) {
        throw new Error(`Peça com ID ${partId} não encontrada`);
      }

      const groupId = partResult.rows[0].part_group_id;

      // Se pertence a um grupo já processado, acumula a quantidade
      if (groupId && gruposProcessados.has(groupId)) {
        gruposProcessados.get(groupId).quantidadeTotal += quantidade;
        gruposProcessados.get(groupId).itens.push({ partId, quantidade, linhasOriginais });
        continue;
      }

      // Marca o grupo como em processamento
      if (groupId) {
        gruposProcessados.set(groupId, {
          quantidadeTotal: quantidade,
          itens: [{ partId, quantidade, linhasOriginais }],
          primeiroItem: { partId, quantidade }
        });
      } else {
        // Peça sem grupo, processa imediatamente
        const resultado = await consumirEstoqueParaItem(partId, quantidade, reason, client);
        resultados.push({
          ...resultado,
          linhasOriginais
        });
      }
    }

    // Processa grupos acumulados
    for (const [groupId, grupoInfo] of gruposProcessados) {
      const { quantidadeTotal, primeiroItem } = grupoInfo;
      const resultado = await consumirEstoqueParaItem(
        primeiroItem.partId, 
        quantidadeTotal, 
        reason, 
        client
      );
      resultados.push({
        ...resultado,
        quantidadeOriginal: quantidadeTotal,
        itensAgrupados: grupoInfo.itens.length
      });
    }

    if (!useExternalTransaction) {
      await client.query("COMMIT");
    }

    console.log(
      `[Stock Service] Estoque consumido com sucesso para ${resultados.length} item(s) (${itens.length} linhas originais).`,
      referenceId ? `Referência: ${referenceId}` : ""
    );

    return {
      success: true,
      itensProcessados: resultados,
      totalLinhasOriginais: itens.length,
      totalPecasUnicas: itensAgregados.size,
      referenceId
    };

  } catch (error) {
    if (!useExternalTransaction) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("[Stock Service] Erro ao fazer rollback:", rollbackError.message);
      }
    }
    console.error("[Stock Service] Erro ao consumir estoque:", error.message);
    throw error;
  } finally {
    if (!useExternalTransaction) {
      client.release();
    }
  }
}

module.exports = {
  consumirEstoqueParaItem,
  consumirEstoqueParaPedido
};
