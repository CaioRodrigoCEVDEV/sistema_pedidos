const express = require("express");
const router = express.Router();
const estoqueController = require("../controllers/estoqueController");
const autenticarToken = require('../middlewares/middlewares');
const requireTela = require("../middlewares/telaMiddleware");
const relatoriosController = require("../controllers/relatoriosController");
const partGroupController = require("../controllers/partGroupController");

const requireEstoque = requireTela("estoque", { api: true });
const requireEstoqueGrupos = requireTela("estoque-grupos", { api: true });

router.get("/api/estoque/itens", requireEstoque, estoqueController.listarEstoque);
router.post("/api/estoque/itens/:id/ajustar", requireEstoque, estoqueController.ajustarEstoque);
router.get("/api/estoque-grupos", requireEstoqueGrupos, relatoriosController.getEstoqueGruposJSON);
router.put("/api/estoque-grupos/:id/ideal", requireEstoqueGrupos, partGroupController.updateGroupIdealQty);
router.post("/api/estoque-grupos/:id/ajustar", requireEstoqueGrupos, partGroupController.adjustGroupStock);
router.get("/api/estoque-grupos/:id/historico", requireEstoqueGrupos, partGroupController.getGroupAuditHistory);

router.get("/get/estoqueItem/:id", estoqueController.mostrarEstoqueItem);
router.get("/get/estoqueItens", estoqueController.mostrarEstoqueItens);
router.put("/put/estoque/:id", requireEstoque, estoqueController.atualizarEstoque);

module.exports = router;
