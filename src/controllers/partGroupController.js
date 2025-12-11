const partGroupModels = require("../models/partGroupModels");

/**
 * Controlador de Grupos de Compatibilidade
 * 
 * Gerencia os endpoints da API para administração dos grupos de compatibilidade.
 * Todos os endpoints requerem autenticação de administrador.
 * 
 * Estrutura JSON de resposta dos grupos:
 * { id: number, name: string, stock_quantity: number, parts: [...], ... }
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
// Sempre cria com stock_quantity = 0, pois o estoque só pode ser definido
// depois que o grupo for criado e tiver peças vinculadas
exports.createGroup = async (req, res) => {
  const { name } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Nome do grupo é obrigatório" });
  }

  try {
    // Sempre cria o grupo com estoque inicial 0
    const group = await partGroupModels.createGroup(name.trim(), 0);
    res.status(201).json(group);
  } catch (error) {
    console.error("Erro ao criar grupo de compatibilidade:", error);
    res.status(500).json({ error: "Erro ao criar grupo de peças" });
  }
};

// Atualiza um grupo de compatibilidade
exports.updateGroup = async (req, res) => {
  const { id } = req.params;
  const { name, stock_quantity } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Nome do grupo é obrigatório" });
  }

  try {
    const group = await partGroupModels.updateGroup(
      id,
      name.trim(),
      stock_quantity
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
// Quando o estoque é atualizado, a quantidade é aplicada automaticamente
// para TODAS as peças que estão dentro do grupo
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
    await partGroupModels.updateAllPartsStockInGroup(id, stock_quantity);

    res.status(200).json({
      ...group,
      message: "Estoque do grupo atualizado e distribuído para todas as peças",
    });
  } catch (error) {
    console.error("Erro ao atualizar estoque do grupo:", error);
    res.status(500).json({ error: "Erro ao atualizar estoque do grupo" });
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
  const { partId } = req.body;

  if (!partId) {
    return res.status(400).json({ error: "ID da peça é obrigatório" });
  }

  try {
    const result = await partGroupModels.addPartToGroup(partId, id);
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

// Busca todas as peças disponíveis (lista completa)
exports.getAvailablePart = async (req, res) => {
  try {
    const parts = await partGroupModels.getAvailablePart();
    res.status(200).json(parts);
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
