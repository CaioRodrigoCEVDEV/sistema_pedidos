const express = require("express");
const autenticarToken = require("../middlewares/middlewares");
const devolucoesController = require("../controllers/devolucoesController");

const router = express.Router();

router.get(
  "/devolucoes/itens",
  autenticarToken,
  devolucoesController.buscarItensVendidos,
);
router.get(
  "/devolucoes/historico",
  autenticarToken,
  devolucoesController.listarHistorico,
);
router.post(
  "/devolucoes",
  autenticarToken,
  devolucoesController.registrarDevolucao,
);

module.exports = router;
