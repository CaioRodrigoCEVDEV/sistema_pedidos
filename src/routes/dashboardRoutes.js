const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const autenticarToken = require("../middlewares/middlewares");
const requireTela = require("../middlewares/telaMiddleware");

router.get("/dashboard/resumo", requireTela("dashboard", { api: true }), autenticarToken, dashboardController.resumo);

module.exports = router;
