const express = require("express");
const router = express.Router();
const telaController = require("../controllers/telaController");
const autenticarToken = require("../middlewares/middlewares");

router.get("/telas", autenticarToken, telaController.listarTelas);
router.get("/me/permissoes", autenticarToken, telaController.minhasPermissoes);

module.exports = router;
