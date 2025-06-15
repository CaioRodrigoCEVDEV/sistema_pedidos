const express = require('express');
const router = express.Router();
const qualidadeController = require('../controllers/qualidadeController');
//const autenticarToken = require('../src/middleware/authMiddleware');  // desatvado por enquanto 

router.get('/qualidade', qualidadeController.listarQualidade);

module.exports = router;
