const express = require("express");
const router = express.Router();
const manutencaoController = require("../controllers/manutencaoController");
const autenticarToken = require("../middlewares/middlewares");

// Aviso de manutenção exibido no shell autenticado. O backend consulta uma API
// externa (MAINTENANCE_API_URL) e devolve um JSON normalizado; o navegador
// nunca fala diretamente com a API externa.
router.get(
  "/api/manutencao",
  autenticarToken,
  manutencaoController.obterManutencao
);

module.exports = router;
