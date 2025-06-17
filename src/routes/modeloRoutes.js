const express = require('express');
const router = express.Router();
const modeloController = require('../controllers/modeloController');
//const autenticarToken = require('../src/middleware/authMiddleware');  // desatvado por enquanto 

router.get('/modelo/:id', modeloController.listarModelo);
router.post('/modelo', modeloController.inserirModelo);
router.put('/modelo/:id', modeloController.atualizarModelo);
router.delete('/modelo/:id', modeloController.deletarModelo);

module.exports = router;
