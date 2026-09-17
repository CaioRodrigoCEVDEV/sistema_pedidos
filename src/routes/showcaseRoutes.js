const express = require("express");
const router = express.Router();
const showcaseController = require("../controllers/showcaseController");
const requireAdmin = require("../middlewares/adminMiddleware");

/**
 * Rotas das vitrines da página inicial (Destaques / Mais vendidos / Novidades).
 *
 * Público:
 *   GET    /showcases                            - Vitrines ativas com itens
 *
 * Admin (requireAdmin):
 *   GET    /showcases/admin                      - Todas as vitrines + itens manuais
 *   PUT    /showcases/admin/:id                  - Ativa/desativa, posição, max_items
 *   POST   /showcases/admin/ordem                - Reordena as vitrines
 *   POST   /showcases/admin/:id/items            - Adiciona produto aos Destaques
 *   POST   /showcases/admin/:id/items/ordem      - Reordena produtos dos Destaques
 *   DELETE /showcases/admin/:id/items/:procod    - Remove produto dos Destaques
 */

router.get("/showcases", showcaseController.listarPublicas);

router.get("/showcases/admin", requireAdmin, showcaseController.listarAdmin);
router.put(
  "/showcases/admin/:id",
  requireAdmin,
  showcaseController.atualizarShowcase
);
router.post(
  "/showcases/admin/ordem",
  requireAdmin,
  showcaseController.atualizarOrdem
);
router.post(
  "/showcases/admin/:id/items",
  requireAdmin,
  showcaseController.adicionarItem
);
router.post(
  "/showcases/admin/:id/items/ordem",
  requireAdmin,
  showcaseController.atualizarOrdemItens
);
router.delete(
  "/showcases/admin/:id/items/:procod",
  requireAdmin,
  showcaseController.removerItem
);

module.exports = router;
