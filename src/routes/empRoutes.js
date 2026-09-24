const express = require("express");
const router = express.Router();
const empController = require("../controllers/empController");
const autenticarToken = require("../middlewares/middlewares");
const requireAdmin = require("../middlewares/adminMiddleware");

router.get("/emp", empController.listarEmpresa);
router.get("/emp/pagamento", autenticarToken, empController.dadosPagamento);
router.put("/emp", requireAdmin, empController.editarNumeroEmpresa);
router.put("/emp/estoque", requireAdmin, empController.editarConfigEstoque);

module.exports = router;
