const express = require("express");
const router = express.Router();
const showcaseController = require("../controllers/showcaseController");
const requireTela = require("../middlewares/telaMiddleware");

const requireVitrines = requireTela("vitrines", { api: true });

/**
 * Rotas das vitrines da página inicial (Destaques / Mais vendidos / Novidades).
 *
 * Público:
 *   GET    /showcases                            - Vitrines ativas com itens
 *
 * Admin (requireVitrines):
 *   GET    /showcases/admin                      - Todas as vitrines + itens manuais
 *   PUT    /showcases/admin/:id                  - Ativa/desativa, posição, max_items
 *   POST   /showcases/admin/ordem                - Reordena as vitrines
 *   POST   /showcases/admin/:id/items            - Adiciona produto aos Destaques
 *   POST   /showcases/admin/:id/items/ordem      - Reordena produtos dos Destaques
 *   DELETE /showcases/admin/:id/items/:procod    - Remove produto dos Destaques
 */

router.get("/showcases", showcaseController.listarPublicas);

router.get("/showcases/admin", requireVitrines, showcaseController.listarAdmin);
router.put(
  "/showcases/admin/:id",
  requireVitrines,
  showcaseController.atualizarShowcase
);
router.post(
  "/showcases/admin/ordem",
  requireVitrines,
  showcaseController.atualizarOrdem
);
router.post(
  "/showcases/admin/:id/items",
  requireVitrines,
  showcaseController.adicionarItem
);
router.post(
  "/showcases/admin/:id/items/ordem",
  requireVitrines,
  showcaseController.atualizarOrdemItens
);
router.delete(
  "/showcases/admin/:id/items/:procod",
  requireVitrines,
  showcaseController.removerItem
);

module.exports = router;
