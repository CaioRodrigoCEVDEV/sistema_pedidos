const express = require("express");
const router = express.Router();
const tipoController = require("../controllers/tipoController");
const autenticarToken = require("../middlewares/middlewares");
const requireAdmin = require("../middlewares/adminMiddleware");

router.get("/tipo/:id", tipoController.listarTipo);
router.get("/modtipo/:id", tipoController.buscarTipo);
router.get("/tipos", tipoController.listarTodosTipos);
router.post("/tipo", requireAdmin, tipoController.inserirTipo);
router.put("/tipo/:id", autenticarToken, tipoController.atualizarTipo);
router.delete("/tipo/:id", autenticarToken, tipoController.deleteTipo);
router.post("/tipo/ordem", autenticarToken, tipoController.atualizarOrdemTipos);

module.exports = router;
