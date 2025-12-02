/**
 * Serviço de Gestão de Estoque
 * 
 * Este módulo implementa a lógica de consumo de estoque para itens de pedidos,
 * incluindo a sincronização de estoque entre grupos de compatibilidade.
 * 
 * MODO DE CONSUMO PARA GRUPOS: 'each' (ativo)
 * ============================================
 * Ao confirmar um pedido contendo uma peça que pertence a um grupo:
 * - Debita a quantidade vendida de CADA peça do grupo.
 * - Exemplo: Grupo com peças A e B, venda qty=2 -> A recebe -2 e B recebe -2.
 * - Cada peça afetada gera uma linha na tabela part_group_audit.
 * 
 * MODO ALTERNATIVO: 'pool' (comentado/desativado)
 * ================================================
 * Distribui a retirada entre as peças do grupo, começando pelas de maior estoque.
 * Exemplo: Grupo com peças A(estoque=5) e B(estoque=3), venda qty=6 -> A fica 0, B fica 2.
 * 
 * Funcionalidades:
 * - Consumo de estoque para peças individuais (sem grupo)
 * - Consumo de estoque modo 'each': debita de CADA peça do grupo
 * - Atualização automática do estoque do grupo (MIN das peças)
 * - Registro de auditoria para cada movimentação
 * - Suporte a transações para garantir atomicidade
 * - Agregação de itens por part_id para evitar duplicidade
 */

const pool = require("../config/db");

// Constante que define o modo de consumo de estoque para grupos
// 'each' = debita de CADA peça do grupo
// 'pool' = distribui entre as peças (alternativa, não ativa)
const CONSUMPTION_MODE = "each";

/**
 * Consome estoque para um único item (peça) usando o modo 'each'.
 * 
 * MODO 'each' (ATIVO):
 * ====================
 * a) Para peças COM grupo: debita a quantidade de CADA peça do grupo.
 *    Exemplo: Grupo com peças A e B, qty=2 -> A recebe -2 e B recebe -2.
 * b) Após debitar, atualiza part_groups.stock_quantity = MIN(estoque das peças).
 * c) Gera um registro de auditoria para CADA peça afetada.
 * 
 * Para peças SEM grupo:
 * =====================
 * d) Decrementa apenas o estoque individual da peça (proqtde).
 * e) Valida estoque suficiente antes de decrementar.
 * 
 * AUDITORIA:
 * ==========
 * f) Grava registro em part_group_audit com:
 *    - part_group_id: ID do grupo (ou null se peça isolada)
 *    - change: valor negativo da quantidade retirada
 *    - reason: 'sale' (ou outro motivo)
 *    - reference_id: código do produto (procod) como texto
 * 
 * @param {number} partId - ID da peça (procod)
 * @param {number} quantidade - Quantidade a consumir
 * @param {string} reason - Motivo do consumo (ex: 'sale', 'cancellation')
 * @param {object} client - Cliente de transação PostgreSQL (opcional)
 * @returns {object} Resultado com detalhes do consumo
 * @throws {Error} Se estoque insuficiente ou peça não encontrada
 */
async function consumirEstoqueParaItem(partId, quantidade, reason = "sale", client = null) {
  // Normaliza partId para inteiro - aceita string ou número
  const normalizedPartId = parseInt(String(partId), 10);
  // Normaliza quantidade para inteiro - arredonda se necessário
  const normalizedQuantidade = Math.round(Number(quantidade));

  // Determina se está usando transação externa ou deve criar uma própria
  const useExternalTransaction = !!client;
  const txClient = client || await pool.connect();

  // Log de debug para facilitar diagnóstico (pode ser desativado em produção)
  console.debug(`[Stock Service] consumirEstoqueParaItem: partId=${partId}->${normalizedPartId}, quantidade=${quantidade}->${normalizedQuantidade}, reason=${reason}`);

  try {
    // Inicia transação se não estiver usando externa
    if (!useExternalTransaction) {
      await txClient.query("BEGIN");
      console.debug("[Stock Service] Transação iniciada (própria)");
    }

    // Valida parâmetros de entrada (após normalização)
    if (isNaN(normalizedPartId) || normalizedPartId <= 0) {
      throw new Error(`Parâmetros inválidos: partId=${partId} não é um inteiro válido`);
    }
    if (isNaN(normalizedQuantidade) || normalizedQuantidade <= 0) {
      throw new Error(`Parâmetros inválidos: quantidade=${quantidade} não é um número válido`);
    }

    // Busca a peça com bloqueio FOR UPDATE para evitar condição de corrida
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
      [normalizedPartId]
    );

    // Verifica se a peça existe
    if (partResult.rows.length === 0) {
      throw new Error(`Peça com ID ${normalizedPartId} não encontrada`);
    }

    const part = partResult.rows[0];
    const referenceId = part.reference_code;

    console.debug(`[Stock Service] Peça encontrada: procod=${part.procod}, prodes="${part.prodes}", part_group_id=${part.part_group_id || 'null'}, proqtde=${part.proqtde}`);

    // ============================================================
    // CASO 1: Peça SEM grupo - decrementa apenas o estoque individual
    // ============================================================
    if (!part.part_group_id) {
      const estoqueAtual = part.proqtde || 0;
      console.debug(`[Stock Service] Peça SEM grupo - estoque atual: ${estoqueAtual}, a decrementar: ${normalizedQuantidade}`);

      // Valida estoque suficiente
      if (estoqueAtual < normalizedQuantidade) {
        throw new Error(
          `Estoque insuficiente para a peça "${part.prodes}" (ID: ${normalizedPartId}). ` +
          `Disponível: ${estoqueAtual}, Solicitado: ${normalizedQuantidade}`
        );
      }

      // Decrementa estoque individual (usando valor inteiro)
      const updateResult = await txClient.query(
        `UPDATE pro 
         SET proqtde = proqtde - $1
         WHERE procod = $2
         RETURNING proqtde`,
        [normalizedQuantidade, normalizedPartId]
      );

      // Commit se transação própria
      if (!useExternalTransaction) {
        await txClient.query("COMMIT");
        console.debug(`[Stock Service] Peça SEM grupo - estoque decrementado com sucesso. Novo estoque: ${updateResult.rows[0].proqtde}`);
      }

      // Retorna resultado para peça sem grupo
      return {
        success: true,
        partId: normalizedPartId,
        partName: part.prodes,
        quantidadeConsumida: normalizedQuantidade,
        novoEstoque: updateResult.rows[0].proqtde,
        grupoPertence: false,
        grupoId: null
      };
    }

    // ============================================================
    // CASO 2: Peça COM grupo - MODO 'each': debita de CADA peça do grupo
    // ============================================================
    const groupId = part.part_group_id;

    // Busca o grupo com bloqueio FOR UPDATE
    const groupResult = await txClient.query(
      `SELECT id, name, stock_quantity
       FROM part_groups
       WHERE id = $1
       FOR UPDATE`,
      [groupId]
    );

    // Verifica se o grupo existe
    if (groupResult.rows.length === 0) {
      throw new Error(`Grupo de compatibilidade (ID: ${groupId}) não encontrado`);
    }

    const group = groupResult.rows[0];

    console.debug(`[Stock Service] Grupo encontrado: id=${group.id}, name="${group.name}", stock_quantity=${group.stock_quantity}`);

    // Busca TODAS as peças do grupo com bloqueio FOR UPDATE
    // Ordenação por procod para consistência
    const pecasGrupoResult = await txClient.query(
      `SELECT procod, prodes, proqtde,
              procod::text as reference_code
       FROM pro
       WHERE part_group_id = $1
       ORDER BY procod ASC
       FOR UPDATE`,
      [groupId]
    );

    const pecasDoGrupo = pecasGrupoResult.rows;

    console.debug(`[Stock Service] Modo 'each' - ${pecasDoGrupo.length} peça(s) no grupo. Cada uma receberá -${normalizedQuantidade}`);

    // Lista para armazenar peças afetadas
    const pecasAfetadas = [];

    // ============================================================
    // MODO 'each': Debita a quantidade de CADA peça do grupo
    // ============================================================
    // Para cada peça do grupo, valida estoque e debita a mesma quantidade
    for (const pecaGrupo of pecasDoGrupo) {
      const estoqueAtual = pecaGrupo.proqtde || 0;

      // Valida estoque suficiente para ESTA peça
      if (estoqueAtual < normalizedQuantidade) {
        throw new Error(
          `Estoque insuficiente para a peça "${pecaGrupo.prodes}" (ID: ${pecaGrupo.procod}) ` +
          `no grupo "${group.name}". Disponível: ${estoqueAtual}, Solicitado: ${normalizedQuantidade}`
        );
      }

      // Atualiza o estoque DESTA peça (debita a quantidade completa - valor inteiro)
      await txClient.query(
        `UPDATE pro 
         SET proqtde = proqtde - $1
         WHERE procod = $2`,
        [normalizedQuantidade, pecaGrupo.procod]
      );

      // Adiciona à lista de peças afetadas
      pecasAfetadas.push({
        procod: pecaGrupo.procod,
        prodes: pecaGrupo.prodes,
        quantidadeRetirada: normalizedQuantidade,
        novoEstoque: estoqueAtual - normalizedQuantidade,
        referenceCode: pecaGrupo.reference_code
      });

      console.debug(`[Stock Service] Peça ${pecaGrupo.procod} ("${pecaGrupo.prodes}"): estoque ${estoqueAtual} -> ${estoqueAtual - normalizedQuantidade}`);
    }

    // ============================================================
    // Atualiza part_groups.stock_quantity = MIN(estoques das peças)
    // ============================================================
    if (group.stock_quantity !== null) {
      const minEstoqueResult = await txClient.query(
        `SELECT COALESCE(MIN(proqtde), 0) as min_estoque
         FROM pro
         WHERE part_group_id = $1`,
        [groupId]
      );

      const novoEstoqueGrupo = minEstoqueResult.rows[0].min_estoque;

      console.debug(`[Stock Service] Atualizando part_groups.stock_quantity: ${group.stock_quantity} -> ${novoEstoqueGrupo} (MIN das peças)`);

      await txClient.query(
        `UPDATE part_groups 
         SET stock_quantity = $1, updated_at = NOW()
         WHERE id = $2`,
        [novoEstoqueGrupo, groupId]
      );
    }

    // ============================================================
    // Grava registros de auditoria para CADA peça afetada
    // ============================================================
    // Nota: created_at usa o default do banco de dados para garantir consistência
    console.debug(`[Stock Service] Gravando ${pecasAfetadas.length} registro(s) de auditoria em part_group_audit`);
    for (const pecaAfetada of pecasAfetadas) {
      await txClient.query(
        `INSERT INTO part_group_audit (part_group_id, change, reason, reference_id)
         VALUES ($1, $2, $3, $4)`,
        [groupId, -pecaAfetada.quantidadeRetirada, reason, pecaAfetada.referenceCode]
      );
    }

    // Commit se transação própria
    if (!useExternalTransaction) {
      await txClient.query("COMMIT");
    }

    // Retorna resultado detalhado
    return {
      success: true,
      partId: normalizedPartId,
      partName: part.prodes,
      quantidadeConsumida: normalizedQuantidade,
      grupoPertence: true,
      grupoId: groupId,
      grupoNome: group.name,
      modoConsumo: CONSUMPTION_MODE, // Indica o modo de consumo utilizado
      pecasAfetadas
    };

  } catch (error) {
    // Rollback se transação própria
    if (!useExternalTransaction) {
      try {
        await txClient.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("[Stock Service] Erro ao fazer rollback:", rollbackError.message);
      }
    }
    throw error;
  } finally {
    // Libera conexão se transação própria
    if (!useExternalTransaction) {
      txClient.release();
    }
  }
}

/* ============================================================
 * MODO 'pool' (DESATIVADO/ALTERNATIVO)
 * ============================================================
 * Este bloco de código implementa o modo 'pool', que distribui
 * a retirada entre as peças do grupo começando pelas de maior estoque.
 * 
 * Para ativar este modo, renomear esta função para consumirEstoqueParaItem
 * e renomear a função acima para consumirEstoqueParaItem_each.
 * 
 * Exemplo de funcionamento:
 * Grupo com peças A(estoque=5) e B(estoque=3), venda qty=6:
 * -> A fica com 0 (retirou 5), B fica com 2 (retirou 1)
 * 
async function consumirEstoqueParaItem_pool(partId, quantidade, reason = "sale", client = null) {
  // ... código do modo pool (distribuição entre peças) ...
  // Implementação anterior que distribuía entre peças
}
*/

/**
 * Consome estoque para múltiplos itens de um pedido em uma única transação.
 * 
 * AGREGAÇÃO DE ITENS:
 * ===================
 * Agrega itens por partId ANTES de processar para evitar débito duplicado
 * quando a mesma peça aparece em múltiplas linhas do pedido.
 * 
 * Exemplo: Pedido com peça A (qty=2) + peça A (qty=3) = 5 unidades totais
 * Resultado: Uma única operação de consumo de 5 unidades.
 * 
 * MODO 'each' (ATIVO):
 * ====================
 * Para peças que pertencem a grupos, debita a quantidade de CADA peça do grupo.
 * Se múltiplas peças do mesmo grupo aparecem no pedido, suas quantidades são
 * somadas e o débito é aplicado uma única vez por grupo.
 * 
 * Exemplo: Grupo com peças A e B, pedido tem A(qty=2) + B(qty=3)
 * -> Quantidade total do grupo = 5
 * -> A recebe -5 e B recebe -5
 * -> Duas linhas na auditoria, uma para A (-5) e uma para B (-5)
 * 
 * TRANSAÇÃO:
 * ==========
 * Toda a operação é atômica. Se qualquer item falhar (ex: estoque insuficiente),
 * toda a transação é revertida (ROLLBACK).
 * 
 * @param {Array<{partId: number, quantidade: number}>} itens - Lista de itens do pedido
 * @param {string} reason - Motivo do consumo (ex: 'sale')
 * @param {string} referenceId - ID de referência opcional (ex: código do pedido)
 * @param {object} externalClient - Cliente de transação PostgreSQL externo (opcional)
 * @returns {object} Resultado com detalhes de todos os itens processados
 * @throws {Error} Se estoque insuficiente ou qualquer erro de validação
 */
async function consumirEstoqueParaPedido(itens, reason = "sale", referenceId = null, externalClient = null) {
  // Valida que há itens para processar
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error("Lista de itens vazia ou inválida");
  }

  // Log de debug inicial com todos os itens recebidos
  console.debug(`[Stock Service] consumirEstoqueParaPedido: ${itens.length} item(s), reason="${reason}", referenceId="${referenceId}"`);
  console.debug(`[Stock Service] Itens recebidos:`, JSON.stringify(itens));

  // Determina se está usando transação externa
  const useExternalTransaction = !!externalClient;
  const client = externalClient || await pool.connect();

  try {
    // Inicia transação se não estiver usando externa
    if (!useExternalTransaction) {
      await client.query("BEGIN");
      console.debug("[Stock Service] Transação iniciada (própria)");
    }

    // ============================================================
    // PASSO 1: Agregar itens por partId para evitar duplicidade
    // ============================================================
    // Isso garante que se a mesma peça aparecer em múltiplas linhas,
    // o estoque será debitado apenas uma vez com a quantidade total
    const itensAgregados = new Map();
    for (const item of itens) {
      // Normaliza partId para inteiro - aceita string ou número
      // Exemplo: "123" -> 123, 123.0 -> 123
      const rawPartId = item.partId;
      const partId = parseInt(String(rawPartId), 10);
      
      // Normaliza quantidade para inteiro - arredonda se necessário
      // Exemplo: "1.0000" -> 1, 2.5 -> 3 (arredonda para cima)
      const rawQuantidade = item.quantidade;
      const quantidade = Math.round(Number(rawQuantidade));

      // Valida cada item após normalização
      if (isNaN(partId) || partId <= 0) {
        throw new Error(`Item inválido: partId=${rawPartId} não é um inteiro válido`);
      }
      if (isNaN(quantidade) || quantidade <= 0) {
        throw new Error(`Item inválido: quantidade=${rawQuantidade} não é um número válido`);
      }

      console.debug(`[Stock Service] Item normalizado: partId=${rawPartId}->${partId}, quantidade=${rawQuantidade}->${quantidade}`);

      // Agrega: se já existe, soma a quantidade
      if (itensAgregados.has(partId)) {
        const existingItem = itensAgregados.get(partId);
        existingItem.quantidade += quantidade;
        existingItem.linhasOriginais++;
        console.debug(`[Stock Service] Agregando: partId=${partId} já existe, nova quantidade total=${existingItem.quantidade}`);
      } else {
        itensAgregados.set(partId, {
          partId,
          quantidade,
          linhasOriginais: 1
        });
      }
    }

    // Log para debug/auditoria
    console.debug(
      `[Stock Service] Itens agregados por partId: ${itens.length} linhas -> ${itensAgregados.size} peças únicas`
    );

    // ============================================================
    // PASSO 2: Agrupar peças por grupo para processar uma vez por grupo
    // ============================================================
    // Isso é importante para o modo 'each': se várias peças do mesmo grupo
    // aparecem no pedido, precisamos somar suas quantidades antes de debitar
    const resultados = [];
    const gruposProcessados = new Map();

    for (const [partId, itemAgregado] of itensAgregados) {
      const { quantidade, linhasOriginais } = itemAgregado;

      // Busca informação do grupo da peça
      const partResult = await client.query(
        `SELECT procod, part_group_id FROM pro WHERE procod = $1`,
        [partId]
      );

      if (partResult.rows.length === 0) {
        throw new Error(`Peça com ID ${partId} não encontrada`);
      }

      const groupId = partResult.rows[0].part_group_id;

      // Se peça pertence a um grupo já visto, acumula quantidade
      if (groupId && gruposProcessados.has(groupId)) {
        gruposProcessados.get(groupId).quantidadeTotal += quantidade;
        gruposProcessados.get(groupId).itens.push({ partId, quantidade, linhasOriginais });
        continue;
      }

      // Marca grupo como em processamento
      if (groupId) {
        gruposProcessados.set(groupId, {
          quantidadeTotal: quantidade,
          itens: [{ partId, quantidade, linhasOriginais }],
          primeiroItem: { partId, quantidade }
        });
      } else {
        // ============================================================
        // Peça SEM grupo: processa imediatamente
        // ============================================================
        const resultado = await consumirEstoqueParaItem(partId, quantidade, reason, client);
        resultados.push({
          ...resultado,
          linhasOriginais
        });
      }
    }

    // ============================================================
    // PASSO 3: Processar grupos acumulados (modo 'each')
    // ============================================================
    // Para cada grupo, chama consumirEstoqueParaItem com a quantidade total
    // A função irá debitar de CADA peça do grupo
    for (const [groupId, grupoInfo] of gruposProcessados) {
      const { quantidadeTotal, primeiroItem } = grupoInfo;
      
      console.debug(
        `[Stock Service] Processando grupo ${groupId}: quantidade total = ${quantidadeTotal} ` +
        `(modo 'each' - debitará de cada peça do grupo)`
      );

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

    // Commit se transação própria
    if (!useExternalTransaction) {
      await client.query("COMMIT");
      console.debug("[Stock Service] Transação COMMIT com sucesso");
    }

    // Log final de sucesso
    console.debug(
      `[Stock Service] Estoque consumido com sucesso para ${resultados.length} item(s) (${itens.length} linhas originais).`,
      referenceId ? `Referência: ${referenceId}` : ""
    );

    // Retorna resultado completo
    return {
      success: true,
      itensProcessados: resultados,
      totalLinhasOriginais: itens.length,
      totalPecasUnicas: itensAgregados.size,
      modoConsumoGrupo: CONSUMPTION_MODE, // Documenta o modo utilizado
      referenceId
    };

  } catch (error) {
    // Rollback se transação própria
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
    // Libera conexão se transação própria
    if (!useExternalTransaction) {
      client.release();
    }
  }
}

module.exports = {
  consumirEstoqueParaItem,
  consumirEstoqueParaPedido
};
