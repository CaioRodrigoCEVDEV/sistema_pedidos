const express = require("express");
const router = express.Router();
const releaseController = require("../controllers/releaseController");

/**
 * Rotas de releases/atualizações do sistema.
 *
 * GET /api/releases - Lista as releases salvas no banco (sem GitHub).
 */
router.get("/api/releases", releaseController.listReleases);

module.exports = router;
