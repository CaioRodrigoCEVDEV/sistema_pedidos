const express = require("express");
const router = express.Router();
const gruposController = require("../controllers/gruposController");
const autenticarToken = require("../middlewares/middlewares");

// Todas as rotas de grupos requerem autenticação
router.get("/grupos", autenticarToken, gruposController.listarGrupos);
router.get("/grupos/:id", autenticarToken, gruposController.buscarGrupo);
router.get("/grupos/:id/pecas", autenticarToken, gruposController.listarPecasGrupo);

// Rotas protegidas
router.post("/grupos", autenticarToken, gruposController.inserirGrupo);
router.put("/grupos/:id", autenticarToken, gruposController.atualizarGrupo);
router.delete("/grupos/:id", autenticarToken, gruposController.excluirGrupo);
router.put("/grupos/:id/estoque", autenticarToken, gruposController.atualizarEstoqueGrupo);

// Vincular/desvincular peças
router.post("/grupos/vincular", autenticarToken, gruposController.vincularPecaGrupo);
router.delete("/grupos/desvincular/:procod", autenticarToken, gruposController.desvincularPecaGrupo);

module.exports = router;
