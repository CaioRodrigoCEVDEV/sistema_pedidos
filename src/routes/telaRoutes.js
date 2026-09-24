const express = require("express");
const router = express.Router();
const telaController = require("../controllers/telaController");
const autenticarToken = require("../middlewares/middlewares");
const requireTela = require("../middlewares/telaMiddleware");

const requireUsuarios = requireTela("usuarios", { api: true });

router.get("/telas", requireUsuarios, telaController.listarTelas);
router.get("/me/permissoes", autenticarToken, telaController.minhasPermissoes);

module.exports = router;
