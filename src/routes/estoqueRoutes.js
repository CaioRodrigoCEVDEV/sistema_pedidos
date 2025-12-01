const express = require("express");
const router = express.Router();
const estoqueController = require("../controllers/estoqueController");
const autenticarToken = require('../middlewares/middlewares');

router.get("/get/estoqueItem/:id", estoqueController.mostrarEstoqueItem);
router.get("/get/estoqueItens", estoqueController.mostrarEstoqueItens);
router.put("/put/estoque/:id",autenticarToken ,estoqueController.atualizarEstoque);
router.post("/validar-estoque", estoqueController.validarEstoqueCarrinho);

module.exports = router;
