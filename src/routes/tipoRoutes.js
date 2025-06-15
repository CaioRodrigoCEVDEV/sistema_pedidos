const express = require('express');
const router = express.Router();
const tipoController = require('../controllers/tipoController');
//const autenticarToken = require('../src/middleware/authMiddleware');  // desatvado por enquanto 

router.get('/tipo', tipoController.listarTipo);

module.exports = router;
