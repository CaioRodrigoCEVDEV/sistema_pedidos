const express = require("express");
const router = express.Router();
const coresController = require("../controllers/coresController");
const autenticarToken = require('../middlewares/middlewares');
const requireAdmin = require("../middlewares/adminMiddleware");

router.get("/cores", coresController.listarCores);
router.post("/cores", requireAdmin,coresController.inserirCores);
router.put("/cores/:id", requireAdmin,coresController.atualizarCores);
router.delete("/cores/:id", requireAdmin,coresController.deleteCores);

module.exports = router;
