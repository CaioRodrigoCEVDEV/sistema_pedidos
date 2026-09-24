const express = require("express");
const router = express.Router();
const promocaoController = require("../controllers/promocaoController");
const requireTela = require("../middlewares/telaMiddleware");

/**
 * Rotas das promoções por produto.
 *
 * Público:
 *   POST   /carrinho/precos               - Revalida preços dos itens do carrinho
 *
 * Admin (requireTela('promocoes')):
 *   GET    /promocoes/admin               - Lista as promoções cadastradas
 *   POST   /promocoes                     - Cria/substitui a promoção do produto
 *   PUT    /promocoes/:procod             - Atualiza a promoção
 *   DELETE /promocoes/:procod             - Remove a promoção
 */

const requirePromocoes = requireTela("promocoes", { api: true });

router.post("/carrinho/precos", promocaoController.precosCarrinho);

router.get("/promocoes/admin", requirePromocoes, promocaoController.listarAdmin);
router.post("/promocoes", requirePromocoes, promocaoController.criar);
router.put("/promocoes/:procod", requirePromocoes, promocaoController.atualizar);
router.delete("/promocoes/:procod", requirePromocoes, promocaoController.remover);

module.exports = router;
