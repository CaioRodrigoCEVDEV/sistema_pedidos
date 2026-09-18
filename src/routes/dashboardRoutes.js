const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const autenticarToken = require("../middlewares/middlewares");

router.get("/dashboard/resumo", autenticarToken, dashboardController.resumo);

module.exports = router;
