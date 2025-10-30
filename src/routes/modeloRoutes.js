const express = require("express");
const router = express.Router();
const modeloController = require("../controllers/modeloController");
const autenticarToken = require("../middlewares/middlewares");
const requireAdmin = require("../middlewares/adminMiddleware");

router.get("/modelo/:id", modeloController.listarModelo);
router.get("/mod/:id", modeloController.buscarModelo);
router.get("/modelos", modeloController.listarTodosModelos);
router.post("/modelo", requireAdmin, modeloController.inserirModelo);
router.put("/modelo/:id", requireAdmin, modeloController.atualizarModelo);
router.delete("/modelo/:id", requireAdmin, modeloController.deletarModelo);
router.post(
  "/modelo/ordem",
  autenticarToken,
  modeloController.atualizarOrdemModelos
);

module.exports = router;
