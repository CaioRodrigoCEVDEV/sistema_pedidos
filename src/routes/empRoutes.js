const express = require("express");
const router = express.Router();
const empController = require("../controllers/empController");
const autenticarToken = require('../middlewares/middlewares');

router.get("/emp", empController.listarEmpresa);
router.put("/emp",autenticarToken, empController.editarNumeroEmpresa);


module.exports = router;
