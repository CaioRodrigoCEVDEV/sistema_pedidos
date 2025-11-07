const express = require("express");
const router = express.Router();
const proController = require("../controllers/proController");
const proControllerV2 = require("../controllers/proControllerV2");
const autenticarToken = require("../middlewares/middlewares");
const requireAdmin = require("../middlewares/adminMiddleware");

// ==================  GET
router.get("/pro/:id", proController.listarProduto);
router.get("/proCores", proController.listarProCor);
router.get("/pro/painel/:id", proController.listarProdutosPainelId);
router.get("/pros", proController.listarProdutos);
router.get("/pro/carrinho/:id", proController.listarProdutoCarrinho);
router.get(
  "/proCoresDisponiveis/:id",
  proController.listarProdutoCoresDisponiveis
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
// V2 Routes com models
router.get(
  "/v2/proComEstoque",
  autenticarToken,
  proControllerV2.listarProdutosComEstoque
);
router.get(
  "/v2/proSemEstoque",
  autenticarToken,
  proControllerV2.listarProdutosSemEstoque
);
// Fim V2 Routes com models


// ==================  PUT
router.put("/pro/:id", requireAdmin, proController.editarProduto);
router.put(
  "/proCoresDisponiveis/:id",
  autenticarToken,
  proController.alterarProdutoCoresDisponiveis
);


// ==================  POST
router.post("/pro", requireAdmin, proController.inserirProduto);
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


// ==================  DELETE
router.delete("/pro/:id", requireAdmin, proController.excluirProduto);
router.delete(
  "/proCoresDisponiveis/:id",
  autenticarToken,
  proController.deletarProdutoCoresDisponiveis
);
router.put(
  "/pro/estoque/:id",
  autenticarToken,
  proController.gravarEstoqueProduto
);

module.exports = router;
