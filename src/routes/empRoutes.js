const express = require("express");
const router = express.Router();
const empController = require("../controllers/empController");
const autenticarToken = require("../middlewares/middlewares");
const requireTela = require("../middlewares/telaMiddleware");

const requireConfiguracoes = requireTela("configuracoes", { api: true });

router.get("/emp", empController.listarEmpresa);
router.get("/emp/pagamento", autenticarToken, empController.dadosPagamento);
router.put("/emp", requireConfiguracoes, empController.editarNumeroEmpresa);
router.put("/emp/estoque", requireConfiguracoes, empController.editarConfigEstoque);

module.exports = router;
