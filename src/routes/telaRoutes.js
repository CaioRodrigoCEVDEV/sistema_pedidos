const express = require("express");
const router = express.Router();
const telaController = require("../controllers/telaController");
const autenticarToken = require("../middlewares/middlewares");
const requireAdmin = require("../middlewares/adminMiddleware");

router.get("/telas", requireAdmin, telaController.listarTelas);
router.get("/me/permissoes", autenticarToken, telaController.minhasPermissoes);

module.exports = router;
