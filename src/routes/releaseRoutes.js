const express = require("express");
const router = express.Router();
const releaseController = require("../controllers/releaseController");

/**
 * Rotas de releases/atualizações do sistema.
 *
 * GET /api/releases - Lista as releases salvas no banco (sem GitHub).
 * GET /api/version  - Retorna apenas a versão mais recente (tag git).
 */
router.get("/api/releases", releaseController.listReleases);
router.get("/api/version", releaseController.getVersion);

module.exports = router;
