const express = require("express");
const router = express.Router();
const relatoriosController = require("../controllers/relatoriosController");
const autenticarToken = require("../middlewares/middlewares");
const requireTela = require("../middlewares/telaMiddleware");
const requireEstoqueGrupos = requireTela("estoque-grupos", { api: true, modulo: "est" });
const requireRelatorios = requireTela("relatorios", { api: true });

/**
 * Rotas de Relatórios
 * 
 * Todas as rotas requerem autenticação de administrador.
 * 
 * Endpoints disponíveis:
 * GET /v2/relatorios/top-pecas      - Retorna JSON com dados do relatório
 * GET /v2/relatorios/top-pecas/pdf  - Exporta relatório em PDF
 * GET /v2/relatorios/top-pecas/xls  - Exporta relatório em Excel
 * 
 * Query params aceitos:
 * - dataInicio: Data inicial (YYYY-MM-DD)
 * - dataFim: Data final (YYYY-MM-DD)
 * - marca: ID da marca (opcional)
 * - groupBy: 'peca' ou 'grupo' (default: 'peca')
 */

// Relatório Top Peças - JSON
router.get(
  "/v2/relatorios/top-pecas",
  requireRelatorios,
  autenticarToken,
  relatoriosController.getTopPecasJSON
);

// Relatório Top Peças - PDF
router.get(
  "/v2/relatorios/top-pecas/pdf",
  requireRelatorios,
  autenticarToken,
  relatoriosController.getTopPecasPDF
);

// Relatório Top Peças - Excel
router.get(
  "/v2/relatorios/top-pecas/xls",
  requireRelatorios,
  autenticarToken,
  relatoriosController.getTopPecasXLS
);

// Relatório Estoque por Grupos (Top Peças) - JSON
router.get(
  "/v2/relatorios/estoque-grupos",
  requireEstoqueGrupos,
  autenticarToken,
  relatoriosController.getEstoqueGruposJSON
);

// Relatório Peças Cadastradas - JSON
router.get(
  "/v2/relatorios/pecas-cadastradas",
  requireRelatorios,
  autenticarToken,
  relatoriosController.getPecasCadastradasJSON
);

// Relatório Peças Cadastradas - PDF
router.get(
  "/v2/relatorios/pecas-cadastradas/pdf",
  requireRelatorios,
  autenticarToken,
  relatoriosController.getPecasCadastradasPDF
);

module.exports = router;
