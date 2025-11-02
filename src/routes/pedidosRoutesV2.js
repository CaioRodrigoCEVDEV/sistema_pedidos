const express = require("express");
const router = express.Router();
const pedidosController = require("../controllers/pedidosControllerV2");
//const autenticarToken = require("../middlewares/middlewares");

router.get("/v2/pedidos/total", pedidosController.totalVendas);

module.exports = router;
