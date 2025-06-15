const express = require('express');
const router = express.Router();
const modeloController = require('../controllers/modeloController');
//const autenticarToken = require('../src/middleware/authMiddleware');  // desatvado por enquanto 

router.get('/modelo', modeloController.listarModelo);

module.exports = router;
