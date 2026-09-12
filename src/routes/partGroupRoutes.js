const express = require("express");
const router = express.Router();
const partGroupController = require("../controllers/partGroupController");
const requireTela = require("../middlewares/telaMiddleware");
const requireGrupos = requireTela("grupos");

/**
 * Rotas de Grupos de Compatibilidade
 * 
 * Todas as rotas requerem autenticação de administrador.
 * O ID dos grupos é INTEGER simples (auto increment), não criptografado.
 * 
 * Endpoints disponíveis:
 * GET    /part-groups                     - Lista todos os grupos
 * GET    /part-groups/available-parts     - Peças disponíveis (com filtro)
 * GET    /part-groups/available-part      - Todas as peças
 * GET    /part-groups/:id                 - Busca grupo por ID
 * GET    /part-groups/:id/audit           - Histórico de movimentações
 * GET    /part-groups/part/:partId/stock  - Estoque por ID da peça
 * POST   /part-groups                     - Cria novo grupo
 * PUT    /part-groups/:id                 - Atualiza grupo
 * PUT    /part-groups/:id/stock           - Atualiza estoque
 * POST   /part-groups/:id/parts           - Adiciona variação (procorid) ao grupo
 * DELETE /part-groups/parts/:procorid     - Remove variação do grupo
 * DELETE /part-groups/:id                 - Exclui grupo
 */

// Lista todos os grupos de compatibilidade
router.get("/part-groups", requireGrupos, partGroupController.listGroups);

// Busca peças disponíveis para agrupamento (com filtro opcional por grupo)
router.get(
  "/part-groups/available-parts",
  requireGrupos,
  partGroupController.getAvailableParts
);

// Busca todas as peças disponíveis (lista completa)
router.get(
  "/part-groups/available-part",
  requireGrupos,
  partGroupController.getAvailablePart
);

// Busca grupo por ID (inclui lista de peças do grupo)
router.get("/part-groups/:id", requireGrupos, partGroupController.getGroup);

// Busca histórico de movimentações (auditoria) de um grupo
router.get(
  "/part-groups/:id/audit",
  requireGrupos,
  partGroupController.getGroupAuditHistory
);

// Busca estoque através do ID da peça
router.get(
  "/part-groups/part/:partId/stock",
  requireGrupos,
  partGroupController.getPartGroupStock
);

// Cria novo grupo de compatibilidade
router.post("/part-groups", requireGrupos, partGroupController.createGroup);

// Atualiza grupo de compatibilidade
router.put("/part-groups/:id", requireGrupos, partGroupController.updateGroup);

// Atualiza estoque do grupo diretamente
router.put(
  "/part-groups/:id/stock",
  requireGrupos,
  partGroupController.updateGroupStock
);

// Adiciona peça ao grupo
router.post(
  "/part-groups/:id/parts",
  requireGrupos,
  partGroupController.addPartToGroup
);

// Remove peça do grupo (por procorid)
router.delete(
  "/part-groups/parts/:procorid",
  requireGrupos,
  partGroupController.removePartFromGroup
);

// Atualiza quantidade ideal de um grupo
router.put(
  "/part-groups/:id/ideal",
  requireGrupos,
  partGroupController.updateGroupIdealQty
);

// Ajusta estoque do grupo por delta (adicionar ou reduzir)
router.post(
  "/part-groups/:id/adjust-stock",
  requireGrupos,
  partGroupController.adjustGroupStock
);

// Exclui grupo de compatibilidade
router.delete(
  "/part-groups/:id",
  requireGrupos,
  partGroupController.deleteGroup
);

module.exports = router;
