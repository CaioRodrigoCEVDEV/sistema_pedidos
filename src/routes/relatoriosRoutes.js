const express = require("express");
const router = express.Router();
const relatoriosController = require("../controllers/relatoriosController");
const autenticarToken = require("../middlewares/middlewares");

/**
 * Rotas de Relatórios
 * 
 * Todas as rotas requerem autenticação.
 * 
 * Endpoints disponíveis:
 * GET /v2/relatorios/top-pecas        - Retorna JSON com dados do relatório
 * GET /v2/relatorios/top-pecas/pdf    - Retorna PDF do relatório
 * GET /v2/relatorios/top-pecas/xls    - Retorna Excel do relatório
 * 
 * Parâmetros de query aceitos:
 * - dataInicio: Data inicial (YYYY-MM-DD)
 * - dataFim: Data final (YYYY-MM-DD)
 * - marca: Código da marca (ou "todas")
 * - groupBy: "peca" (padrão) ou "grupo"
 */

// Endpoint JSON
router.get(
  "/v2/relatorios/top-pecas",
  autenticarToken,
  relatoriosController.getTopPecas
);

// Endpoint PDF
router.get(
  "/v2/relatorios/top-pecas/pdf",
  autenticarToken,
  relatoriosController.getTopPecasPDF
);

// Endpoint Excel
router.get(
  "/v2/relatorios/top-pecas/xls",
  autenticarToken,
  relatoriosController.getTopPecasXLS
);

module.exports = router;
