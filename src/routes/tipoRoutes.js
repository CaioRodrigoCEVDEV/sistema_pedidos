const express = require("express");
const router = express.Router();
const tipoController = require("../controllers/tipoController");
const autenticarToken = require("../middlewares/middlewares");
const requireTela = require("../middlewares/telaMiddleware");

const requireProdutos = requireTela("produtos", { api: true });

router.get("/tipo/:id", tipoController.listarTipo);
router.get("/modtipo/:id", tipoController.buscarTipo);
router.get("/tipos", tipoController.listarTodosTipos);
router.post("/tipo", requireProdutos, tipoController.inserirTipo);
router.put("/tipo/:id", requireProdutos, tipoController.atualizarTipo);
router.delete("/tipo/:id", requireProdutos, tipoController.deleteTipo);
router.post("/tipo/ordem", autenticarToken, tipoController.atualizarOrdemTipos);

module.exports = router;
