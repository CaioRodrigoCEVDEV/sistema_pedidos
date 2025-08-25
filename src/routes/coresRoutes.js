const express = require("express");
const router = express.Router();
const coresController = require("../controllers/coresController");
const autenticarToken = require('../middlewares/middlewares');

router.get("/cores", coresController.listarCores);
router.post("/cores", autenticarToken,coresController.inserirCores);
router.put("/cores/:id", autenticarToken,coresController.atualizarCores);
router.delete("/cores/:id", autenticarToken,coresController.deleteCores);

module.exports = router;
