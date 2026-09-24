const express = require("express");
const router = express.Router();
const modeloController = require("../controllers/modeloController");
const autenticarToken = require("../middlewares/middlewares");
const requireTela = require("../middlewares/telaMiddleware");

const requireProdutos = requireTela("produtos", { api: true });

router.get("/modelo/:id", modeloController.listarModelo);
router.get("/mod/:id", modeloController.buscarModelo);
router.get("/modelos", modeloController.listarTodosModelos);
router.post("/modelo", requireProdutos, modeloController.inserirModelo);
router.put("/modelo/:id", requireProdutos, modeloController.atualizarModelo);
router.delete("/modelo/:id", requireProdutos, modeloController.deletarModelo);
router.post(
  "/modelo/ordem",
  autenticarToken,
  modeloController.atualizarOrdemModelos
);

module.exports = router;
