const express = require("express");
const router = express.Router();
const empController = require("../controllers/empController");
//const autenticarToken = require('../src/middleware/authMiddleware');  // desatvado por enquanto

router.get("/emp", empController.listarEmpresa);
router.put("/emp", empController.editarNumeroEmpresa);


module.exports = router;
