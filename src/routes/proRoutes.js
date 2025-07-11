const express = require("express");
const router = express.Router();
const proController = require("../controllers/proController");
//const autenticarToken = require('../src/middleware/authMiddleware');  // desatvado por enquanto

router.get("/pro/:id", proController.listarProduto);
router.get("/proCores", proController.listarProCor);
router.put("/pro/:id", proController.editarProduto);
router.get("/pro/painel/:id", proController.listarProdutosPainelId);
router.get("/pros", proController.listarProdutos);
router.post("/pro", proController.inserirProduto);
router.get("/pro/carrinho/:id", proController.listarProdutoCarrinho);
router.delete("/pro/:id", proController.excluirProduto);

router.post("/proCoresDisponiveis/:id", proController.inserirProdutoCoresDisponiveis);
router.get("/proCoresDisponiveis/:id", proController.listarProdutoCoresDisponiveis);
router.put("/proCoresDisponiveis/:id", proController.alterarProdutoCoresDisponiveis);
router.delete("/proCoresDisponiveis/:id", proController.deletarProdutoCoresDisponiveis);

module.exports = router;
