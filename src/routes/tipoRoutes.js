const express = require("express");
const router = express.Router();
const tipoController = require("../controllers/tipoController");
const autenticarToken = require('../middlewares/middlewares');

router.get("/tipo/:id", tipoController.listarTipo);
router.get("/modtipo/:id", tipoController.buscarTipo);
router.get("/tipos", tipoController.listarTodosTipos);
router.post("/tipo", autenticarToken,tipoController.inserirTipo);
router.put("/tipo/:id", autenticarToken,tipoController.atualizarTipo);
router.delete("/tipo/:id", autenticarToken,tipoController.deleteTipo);

module.exports = router;
