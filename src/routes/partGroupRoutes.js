const express = require("express");
const router = express.Router();
const partGroupController = require("../controllers/partGroupController");
const requireAdmin = require("../middlewares/adminMiddleware");

/**
 * Rotas de Grupos de Peças (Grupos de Compatibilidade)
 * 
 * Todas as rotas requerem autenticação de administrador.
 * 
 * Endpoints disponíveis:
 * - GET    /part-groups                  Lista todos os grupos
 * - GET    /part-groups/available-parts  Busca peças disponíveis para agrupamento
 * - GET    /part-groups/available-part   Busca todas as peças
 * - GET    /part-groups/:id              Busca um grupo pelo ID com suas peças
 * - GET    /part-groups/:id/audit        Busca histórico de movimentações do grupo
 * - GET    /part-groups/part/:partId/stock Busca estoque do grupo de uma peça
 * - POST   /part-groups                  Cria um novo grupo
 * - PUT    /part-groups/:id              Atualiza um grupo
 * - PUT    /part-groups/:id/stock        Atualiza o estoque de um grupo
 * - POST   /part-groups/:id/parts        Adiciona uma peça ao grupo
 * - DELETE /part-groups/parts/:partId    Remove uma peça do grupo
 * - DELETE /part-groups/:id              Exclui um grupo
 */

// Lista todos os grupos de peças
router.get("/part-groups", requireAdmin, partGroupController.listGroups);

// Busca peças disponíveis para agrupamento (não estão em nenhum grupo)
router.get(
  "/part-groups/available-parts",
  requireAdmin,
  partGroupController.getAvailableParts
);

// Busca todas as peças (para listagem completa no modal)
router.get(
  "/part-groups/available-part",
  requireAdmin,
  partGroupController.getAvailablePart
);

// Busca um grupo pelo ID com suas peças associadas
router.get("/part-groups/:id", requireAdmin, partGroupController.getGroup);

// Busca o histórico de auditoria (movimentações) de um grupo
router.get(
  "/part-groups/:id/audit",
  requireAdmin,
  partGroupController.getGroupAuditHistory
);

// Busca o estoque do grupo de uma peça específica
router.get(
  "/part-groups/part/:partId/stock",
  requireAdmin,
  partGroupController.getPartGroupStock
);

// Cria um novo grupo de peças
router.post("/part-groups", requireAdmin, partGroupController.createGroup);

// Atualiza um grupo de peças
router.put("/part-groups/:id", requireAdmin, partGroupController.updateGroup);

// Atualiza o estoque de um grupo diretamente (ajuste manual)
router.put(
  "/part-groups/:id/stock",
  requireAdmin,
  partGroupController.updateGroupStock
);

// Adiciona uma peça a um grupo
router.post(
  "/part-groups/:id/parts",
  requireAdmin,
  partGroupController.addPartToGroup
);

// Remove uma peça do seu grupo
router.delete(
  "/part-groups/parts/:partId",
  requireAdmin,
  partGroupController.removePartFromGroup
);

// Exclui um grupo de peças
router.delete(
  "/part-groups/:id",
  requireAdmin,
  partGroupController.deleteGroup
);

module.exports = router;
