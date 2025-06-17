const express = require('express');
const router = express.Router();
const tipoController = require('../controllers/tipoController');
//const autenticarToken = require('../src/middleware/authMiddleware');  // desatvado por enquanto 

router.get('/tipo', tipoController.listarTipo);
router.post('/tipo', tipoController.inserirTipo);
router.put('/tipo/:id', tipoController.atualizarTipo);
router.delete('/tipo/:id', tipoController.deleteTipo);

module.exports = router;
