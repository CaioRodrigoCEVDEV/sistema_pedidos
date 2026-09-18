const express = require("express");
const router = express.Router();
const empController = require("../controllers/empController");
const autenticarToken = require("../middlewares/middlewares");

router.get("/emp", empController.listarEmpresa);
router.get("/emp/pagamento", autenticarToken, empController.dadosPagamento);
router.put("/emp", autenticarToken, empController.editarNumeroEmpresa);
router.put("/emp/estoque", autenticarToken, empController.editarConfigEstoque);

module.exports = router;
