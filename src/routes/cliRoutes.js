const express = require("express");
const router = express.Router();
const cliController = require("../controllers/cliController");
const autenticarToken = require("../middlewares/middlewares");
const requireTela = require("../middlewares/telaMiddleware");

// Todas as rotas de clientes exigem autenticação.
router.use("/cli", requireTela("clientes", { api: true }), autenticarToken);

// Rotas específicas antes de /cli/:id para não colidir.
router.get("/cli/pedidos/disponiveis", cliController.listarPedidosDisponiveis);

router.post("/cli", cliController.create);
router.get("/cli", cliController.list);
router.get("/cli/:id", cliController.getById);
router.put("/cli/:id", cliController.update);
router.delete("/cli/:id", cliController.remove);

// Pedidos vinculados
router.get("/cli/:id/pedidos", cliController.listarPedidosCliente);
router.get("/cli/:id/pedidos/:pvcod/itens", cliController.listarItensPedidoCliente);
router.post("/cli/:id/pedidos/:pvcod", cliController.vincularPedido);
router.delete("/cli/:id/pedidos/:pvcod", cliController.desvincularPedido);

// Conta / movimentações
router.get("/cli/:id/conta", cliController.resumoConta);
router.get("/cli/:id/movimentacoes", cliController.listarMovimentacoes);
router.post("/cli/:id/movimentacoes", cliController.criarMovimentacao);

// Cobranças
router.get("/cli/:id/cobrancas", cliController.listarCobrancas);
router.post("/cli/:id/cobrancas", cliController.criarCobranca);
router.put("/cli/:id/cobrancas/:cobcod/baixar", cliController.baixarCobranca);
router.put("/cli/:id/cobrancas/:cobcod/cancelar", cliController.cancelarCobranca);

module.exports = router;
