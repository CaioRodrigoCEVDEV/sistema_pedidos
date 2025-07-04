const express = require("express");
const router = express.Router();
const proController = require("../controllers/proController");
//const autenticarToken = require('../src/middleware/authMiddleware');  // desatvado por enquanto

router.get("/pro/:id", proController.listarProduto);
router.get("/pro/painel/:id", proController.listarProdutosPainelId);
router.get("/pros", proController.listarProdutos);
router.post("/pro", proController.inserirProduto);
router.get("/pro/carrinho/:id", proController.listarProdutoCarrinho);
router.delete("/pro/:id", proController.excluirProduto);

module.exports = router;
