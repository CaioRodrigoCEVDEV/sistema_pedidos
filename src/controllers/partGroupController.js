const partGroupModels = require("../models/partGroupModels");

/**
 * Controlador de Grupos de Compatibilidade
 * 
 * Gerencia os endpoints da API para administração dos grupos de compatibilidade.
 * Todos os endpoints requerem autenticação de administrador.
 * 
 * Estrutura JSON de resposta dos grupos:
 * { id: number, name: string, stock_quantity: number, group_cost: number, parts: [...], ... }
 */

// Lista todos os grupos de compatibilidade
exports.listGroups = async (req, res) => {
  try {
    const groups = await partGroupModels.listAllGroups();
    res.status(200).json(groups);
  } catch (error) {
    console.error("Erro ao listar grupos de compatibilidade:", error);
    res.status(500).json({ error: "Erro ao listar grupos de peças" });
  }
};

// Busca um grupo específico pelo ID, incluindo suas peças
exports.getGroup = async (req, res) => {
  const { id } = req.params;

  try {
    const group = await partGroupModels.getGroupById(id);
    if (!group) {
      return res.status(404).json({ error: "Grupo não encontrado" });
    }
    res.status(200).json(group);
  } catch (error) {
    console.error("Erro ao buscar grupo de compatibilidade:", error);
    res.status(500).json({ error: "Erro ao buscar grupo de peças" });
  }
};

// Busca o estoque de um grupo através do ID da peça
exports.getPartGroupStock = async (req, res) => {
  const { partId } = req.params;

  try {
    const stockInfo = await partGroupModels.getGroupStock(partId);
    if (!stockInfo) {
      return res.status(404).json({ error: "Peça não encontrada" });
    }
    res.status(200).json(stockInfo);
  } catch (error) {
    console.error("Erro ao buscar estoque do grupo:", error);
    res.status(500).json({ error: "Erro ao buscar estoque do grupo" });
  }
};

// Cria um novo grupo de compatibilidade
// Grupos são sempre criados com stock_quantity = 0
// O estoque só pode ser definido após adicionar peças ao grupo
exports.createGroup = async (req, res) => {
  const { name, group_cost } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Nome do grupo é obrigatório" });
  }

  try {
    // Sempre cria grupos com estoque inicial de 0
    const group = await partGroupModels.createGroup(name.trim(), 0, group_cost || null);
    res.status(201).json(group);
  } catch (error) {
    console.error("Erro ao criar grupo de compatibilidade:", error);
    res.status(500).json({ error: "Erro ao criar grupo de peças" });
  }
};

// Atualiza um grupo de compatibilidade
exports.updateGroup = async (req, res) => {
  const { id } = req.params;
  const { name, stock_quantity, group_cost } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Nome do grupo é obrigatório" });
  }

  try {
    const group = await partGroupModels.updateGroup(
      id,
      name.trim(),
      stock_quantity,
      group_cost
    );
    if (!group) {
      return res.status(404).json({ error: "Grupo não encontrado" });
    }
    res.status(200).json(group);
  } catch (error) {
    console.error("Erro ao atualizar grupo de compatibilidade:", error);
    res.status(500).json({ error: "Erro ao atualizar grupo de peças" });
  }
};

// Atualiza o estoque de um grupo diretamente
// A quantidade definida será aplicada automaticamente para todas as peças do grupo
exports.updateGroupStock = async (req, res) => {
  const { id } = req.params;
  const { stock_quantity, reason = "manual_adjustment" } = req.body;

  if (stock_quantity === undefined || stock_quantity === null) {
    return res.status(400).json({ error: "Quantidade é obrigatória" });
  }

  if (stock_quantity < 0) {
    return res.status(400).json({ error: "Quantidade não pode ser negativa" });
  }

  try {
    // Atualiza o estoque do grupo
    const group = await partGroupModels.updateGroupStock(
      id,
      stock_quantity,
      reason
    );
    if (!group) {
      return res.status(404).json({ error: "Grupo não encontrado" });
    }

    // Distribui a quantidade para todas as peças do grupo
    const partsResult = await partGroupModels.updateAllPartsStockInGroup(
      id,
      stock_quantity
    );

    res.status(200).json({
      ...group,
      partsUpdated: partsResult.partsUpdated,
      message: `Estoque do grupo atualizado e distribuído para ${partsResult.partsUpdated} peça(s)`,
    });
  } catch (error) {
    console.error("Erro ao atualizar estoque do grupo:", error);
    res.status(500).json({ error: "Erro ao atualizar estoque do grupo" });
  }
};

// Atualiza o custo de um grupo diretamente
// O custo definido será aplicado automaticamente para todas as peças do grupo
exports.updateGroupCost = async (req, res) => {
  const { id } = req.params;
  const { group_cost } = req.body;

  if (group_cost === undefined || group_cost === null) {
    return res.status(400).json({ error: "Custo é obrigatório" });
  }

  if (group_cost < 0) {
    return res.status(400).json({ error: "Custo não pode ser negativo" });
  }

  try {
    // Atualiza o custo do grupo
    const group = await partGroupModels.updateGroup(
      id,
      undefined,
      undefined,
      group_cost
    );
    
    if (!group) {
      return res.status(404).json({ error: "Grupo não encontrado" });
    }

    // Precisa buscar o nome do grupo para passar ao updateGroup
    const fullGroup = await partGroupModels.getGroupById(id);
    if (!fullGroup) {
      return res.status(404).json({ error: "Grupo não encontrado" });
    }

    // Atualiza o grupo com o novo custo
    const updatedGroup = await partGroupModels.updateGroup(
      id,
      fullGroup.name,
      fullGroup.stock_quantity,
      group_cost
    );

    // Distribui o custo para todas as peças do grupo
    const partsResult = await partGroupModels.updateAllPartsCostInGroup(
      id,
      group_cost
    );

    res.status(200).json({
      ...updatedGroup,
      partsUpdated: partsResult.partsUpdated,
      message: `Custo do grupo atualizado e distribuído para ${partsResult.partsUpdated} peça(s)`,
    });
  } catch (error) {
    console.error("Erro ao atualizar custo do grupo:", error);
    res.status(500).json({ error: "Erro ao atualizar custo do grupo" });
  }
};

// Exclui um grupo de compatibilidade
exports.deleteGroup = async (req, res) => {
  const { id } = req.params;

  try {
    const group = await partGroupModels.deleteGroup(id);
    if (!group) {
      return res.status(404).json({ error: "Grupo não encontrado" });
    }
    res.status(200).json({ message: "Grupo excluído com sucesso", group });
  } catch (error) {
    console.error("Erro ao excluir grupo de compatibilidade:", error);
    res.status(500).json({ error: "Erro ao excluir grupo de peças" });
  }
};

// Adiciona uma peça a um grupo de compatibilidade
exports.addPartToGroup = async (req, res) => {
  const { id } = req.params;
  const { partId, colorId } = req.body;

  if (!partId) {
    return res.status(400).json({ error: "ID da peça é obrigatório" });
  }

  try {
    const result = await partGroupModels.addPartToGroup(partId, id, colorId);
    if (!result) {
      return res.status(404).json({ error: "Peça não encontrada" });
    }
    res.status(200).json(result);
  } catch (error) {
    console.error("Erro ao adicionar peça ao grupo:", error);
    res.status(500).json({ error: "Erro ao adicionar peça ao grupo" });
  }
};

// Remove uma peça do seu grupo de compatibilidade
exports.removePartFromGroup = async (req, res) => {
  const { partId } = req.params;

  try {
    const result = await partGroupModels.removePartFromGroup(partId);
    if (!result) {
      return res.status(404).json({ error: "Peça não encontrada" });
    }
    res.status(200).json(result);
  } catch (error) {
    console.error("Erro ao remover peça do grupo:", error);
    res.status(500).json({ error: "Erro ao remover peça do grupo" });
  }
};

// Busca peças disponíveis para agrupamento (com filtro opcional por grupo)
exports.getAvailableParts = async (req, res) => {
  const { groupId } = req.query;

  try {
    const parts = await partGroupModels.getAvailableParts(groupId || null);
    res.status(200).json(parts);
  } catch (error) {
    console.error("Erro ao buscar peças disponíveis:", error);
    res.status(500).json({ error: "Erro ao buscar peças disponíveis" });
  }
};

// Busca todas as peças disponíveis com paginação
exports.getAvailablePart = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const search = req.query.search || "";
    
    const result = await partGroupModels.getAvailablePart(page, limit, search);
    res.status(200).json(result);
  } catch (error) {
    console.error("Erro ao buscar peças disponíveis:", error);
    res.status(500).json({ error: "Erro ao buscar peças disponíveis" });
  }
};

// Busca histórico de auditoria (movimentações) de um grupo
exports.getGroupAuditHistory = async (req, res) => {
  const { id } = req.params;
  const { limit = 50 } = req.query;

  try {
    const history = await partGroupModels.getGroupAuditHistory(
      id,
      parseInt(limit, 10)
    );
    res.status(200).json(history);
  } catch (error) {
    console.error("Erro ao buscar histórico do grupo:", error);
    res.status(500).json({ error: "Erro ao buscar histórico do grupo" });
  }
};
