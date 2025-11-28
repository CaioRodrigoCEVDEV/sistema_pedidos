const partGroupModels = require("../models/partGroupModels");

/**
 * Part Group Controller
 * Admin-only endpoints for managing compatibility groups
 */

// List all part groups
exports.listGroups = async (req, res) => {
  try {
    const groups = await partGroupModels.listAllGroups();
    res.status(200).json(groups);
  } catch (error) {
    console.error("Error listing part groups:", error);
    res.status(500).json({ error: "Erro ao listar grupos de peças" });
  }
};

// Get a single group by ID with its member parts
exports.getGroup = async (req, res) => {
  const { id } = req.params;

  try {
    const group = await partGroupModels.getGroupById(id);
    if (!group) {
      return res.status(404).json({ error: "Grupo não encontrado" });
    }
    res.status(200).json(group);
  } catch (error) {
    console.error("Error getting part group:", error);
    res.status(500).json({ error: "Erro ao buscar grupo de peças" });
  }
};

// Get stock for a specific part's group
exports.getPartGroupStock = async (req, res) => {
  const { partId } = req.params;

  try {
    const stockInfo = await partGroupModels.getGroupStock(partId);
    if (!stockInfo) {
      return res.status(404).json({ error: "Peça não encontrada" });
    }
    res.status(200).json(stockInfo);
  } catch (error) {
    console.error("Error getting part group stock:", error);
    res.status(500).json({ error: "Erro ao buscar estoque do grupo" });
  }
};

// Create a new part group
exports.createGroup = async (req, res) => {
  const { name, stock_quantity = 0 } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Nome do grupo é obrigatório" });
  }

  try {
    const group = await partGroupModels.createGroup(
      name.trim(),
      stock_quantity
    );
    res.status(201).json(group);
  } catch (error) {
    console.error("Error creating part group:", error);
    res.status(500).json({ error: "Erro ao criar grupo de peças" });
  }
};

// Update a part group
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
    console.error("Error updating part group:", error);
    res.status(500).json({ error: "Erro ao atualizar grupo de peças" });
  }
};

// Update group stock directly
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
    const group = await partGroupModels.updateGroupStock(
      id,
      stock_quantity,
      reason
    );
    if (!group) {
      return res.status(404).json({ error: "Grupo não encontrado" });
    }
    res.status(200).json(group);
  } catch (error) {
    console.error("Error updating group stock:", error);
    res.status(500).json({ error: "Erro ao atualizar estoque do grupo" });
  }
};

// Delete a part group
exports.deleteGroup = async (req, res) => {
  const { id } = req.params;

  try {
    const group = await partGroupModels.deleteGroup(id);
    if (!group) {
      return res.status(404).json({ error: "Grupo não encontrado" });
    }
    res.status(200).json({ message: "Grupo excluído com sucesso", group });
  } catch (error) {
    console.error("Error deleting part group:", error);
    res.status(500).json({ error: "Erro ao excluir grupo de peças" });
  }
};

// Add a part to a group
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
    console.error("Error adding part to group:", error);
    res.status(500).json({ error: "Erro ao adicionar peça ao grupo" });
  }
};

// Remove a part from its group
exports.removePartFromGroup = async (req, res) => {
  const { partId } = req.params;

  try {
    const result = await partGroupModels.removePartFromGroup(partId);
    if (!result) {
      return res.status(404).json({ error: "Peça não encontrada" });
    }
    res.status(200).json(result);
  } catch (error) {
    console.error("Error removing part from group:", error);
    res.status(500).json({ error: "Erro ao remover peça do grupo" });
  }
};

// Get available parts for grouping
exports.getAvailableParts = async (req, res) => {
  const { groupId } = req.query;

  try {
    const parts = await partGroupModels.getAvailableParts(groupId || null);
    res.status(200).json(parts);
  } catch (error) {
    console.error("Error getting available parts:", error);
    res.status(500).json({ error: "Erro ao buscar peças disponíveis" });
  }
};

exports.getAvailablePart = async (req, res) => {
  try {
    const parts = await partGroupModels.getAvailablePart();
    res.status(200).json(parts);
  } catch (error) {
    console.error("Error getting available parts:", error);
    res.status(500).json({ error: "Erro ao buscar peças disponíveis" });
  }
};

// Get audit history for a group
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
    console.error("Error getting group audit history:", error);
    res.status(500).json({ error: "Erro ao buscar histórico do grupo" });
  }
};
