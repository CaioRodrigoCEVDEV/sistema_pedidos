const express = require("express");
const requireTela = require("../middlewares/telaMiddleware");
const devolucoesController = require("../controllers/devolucoesController");

const router = express.Router();
const requireDevolucoes = requireTela("devolucoes");

router.get(
  "/devolucoes/itens",
  requireDevolucoes,
  devolucoesController.buscarItensVendidos,
);
router.get(
  "/devolucoes/historico",
  requireDevolucoes,
  devolucoesController.listarHistorico,
);
router.post(
  "/devolucoes",
  requireDevolucoes,
  devolucoesController.registrarDevolucao,
);

module.exports = router;
