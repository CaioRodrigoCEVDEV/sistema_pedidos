const express = require("express");
const router = express.Router();
const proController = require("../controllers/proController");
const autenticarToken = require("../middlewares/middlewares");
const requireAdmin = require("../middlewares/adminMiddleware");

router.get("/pro/:id", proController.listarProduto);
router.get("/proCores", proController.listarProCor);
router.put("/pro/:id", requireAdmin, proController.editarProduto);
router.get("/pro/painel/:id", proController.listarProdutosPainelId);
router.get("/pros", proController.listarProdutos);
router.post("/pro", requireAdmin, proController.inserirProduto);
router.get("/pro/carrinho/:id", proController.listarProdutoCarrinho);
router.delete("/pro/:id", requireAdmin, proController.excluirProduto);
router.post(
  "/pro/ordem",
  autenticarToken,
  proController.atualizarOrdemProdutos
);

router.post(
  "/proCoresDisponiveis/:id",
  autenticarToken,
  proController.inserirProdutoCoresDisponiveis
);
router.get(
  "/proCoresDisponiveis/:id",
  proController.listarProdutoCoresDisponiveis
);
router.put(
  "/proCoresDisponiveis/:id",
  autenticarToken,
  proController.alterarProdutoCoresDisponiveis
);
router.delete(
  "/proCoresDisponiveis/:id",
  autenticarToken,
  proController.deletarProdutoCoresDisponiveis
);
router.get(
  "/proComEstoque",
  autenticarToken,
  proController.listarProdutosComEstoque
);
router.get(
  "/proSemEstoque",
  autenticarToken,
  proController.listarProdutosSemEstoque
);
router.put(
  "/pro/estoque/:id",
  autenticarToken,
  proController.gravarEstoqueProduto
);
module.exports = router;
