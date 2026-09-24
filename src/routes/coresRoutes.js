const express = require("express");
const router = express.Router();
const coresController = require("../controllers/coresController");
const autenticarToken = require('../middlewares/middlewares');
const requireTela = require("../middlewares/telaMiddleware");

const requireProdutos = requireTela("produtos", { api: true });

router.get("/cores", coresController.listarCores);
router.post("/cores", requireProdutos,coresController.inserirCores);
router.put("/cores/:id", requireProdutos,coresController.atualizarCores);
router.delete("/cores/:id", requireProdutos,coresController.deleteCores);

module.exports = router;
