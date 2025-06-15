const express = require('express');
const router = express.Router();
const marcasController = require('../controllers/marcasController');
//const autenticarToken = require('../src/middleware/authMiddleware');  // desatvado por enquanto 

router.get('/marcas', marcasController.listarMarcas);

module.exports = router;
