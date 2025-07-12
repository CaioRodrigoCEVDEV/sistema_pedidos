const express = require('express');
const router = express.Router();
const modeloController = require('../controllers/modeloController');
const autenticarToken = require('../middlewares/middlewares');

router.get('/modelo/:id', modeloController.listarModelo);
router.get('/modelos', modeloController.listarTodosModelos);
router.post('/modelo', autenticarToken,modeloController.inserirModelo);
router.put('/modelo/:id', autenticarToken,modeloController.atualizarModelo);
router.delete('/modelo/:id',autenticarToken, modeloController.deletarModelo);

module.exports = router;
