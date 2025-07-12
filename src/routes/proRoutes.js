const express = require("express");
const router = express.Router();
const proController = require("../controllers/proController");
const autenticarToken = require('../middlewares/middlewares');

router.get("/pro/:id", proController.listarProduto);
router.get("/proCores", proController.listarProCor);
router.put("/pro/:id",autenticarToken, proController.editarProduto);
router.get("/pro/painel/:id", proController.listarProdutosPainelId);
router.get("/pros", proController.listarProdutos);
router.post("/pro", autenticarToken,proController.inserirProduto);
router.get("/pro/carrinho/:id", proController.listarProdutoCarrinho);
router.delete("/pro/:id",autenticarToken, proController.excluirProduto);

router.post("/proCoresDisponiveis/:id", autenticarToken,proController.inserirProdutoCoresDisponiveis);
router.get("/proCoresDisponiveis/:id", proController.listarProdutoCoresDisponiveis);
router.put("/proCoresDisponiveis/:id", autenticarToken,proController.alterarProdutoCoresDisponiveis);
router.delete("/proCoresDisponiveis/:id", autenticarToken,proController.deletarProdutoCoresDisponiveis);

module.exports = router;
