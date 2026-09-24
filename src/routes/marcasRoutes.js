const express = require("express");
const router = express.Router();
const marcasController = require("../controllers/marcasController");
const autenticarToken = require("../middlewares/middlewares");
const requireTela = require("../middlewares/telaMiddleware");

const requireProdutos = requireTela("produtos", { api: true });

router.get("/marcas", marcasController.listarMarcas);
router.get("/marcas/:id", marcasController.listarMarcasId);
router.post("/marcas", requireProdutos, marcasController.inserirMarcas);
router.post(
  "/marcas/ordem",
  autenticarToken,
  marcasController.atualizarOrdemMarcas
);
router.put("/marcas/:id", requireProdutos, marcasController.atualizarMarcas);
router.put(
  "/marcas/status/:id",
  requireProdutos,
  marcasController.atualizarMarcasStatus
);
router.delete("/marcas/:id", requireProdutos, marcasController.deletarMarcas);

module.exports = router;
