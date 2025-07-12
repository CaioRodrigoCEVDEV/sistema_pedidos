const express = require('express');
const router = express.Router();
const marcasController = require('../controllers/marcasController');
const autenticarToken = require('../middlewares/middlewares');

router.get('/marcas', marcasController.listarMarcas);
router.get('/marcas/:id', marcasController.listarMarcasId);
router.post('/marcas', autenticarToken,marcasController.inserirMarcas);
router.put('/marcas/:id', autenticarToken,marcasController.atualizarMarcas);
router.delete('/marcas/:id', autenticarToken,marcasController.deletarMarcas);

module.exports = router;
