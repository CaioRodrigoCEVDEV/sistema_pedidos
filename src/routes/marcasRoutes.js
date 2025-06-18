const express = require('express');
const router = express.Router();
const marcasController = require('../controllers/marcasController');
//const autenticarToken = require('../src/middleware/authMiddleware');  // desatvado por enquanto 

router.get('/marcas', marcasController.listarMarcas);
router.get('/marcas/:id', marcasController.listarMarcasId);
router.post('/marcas', marcasController.inserirMarcas);
router.put('/marcas/:id', marcasController.atualizarMarcas);
router.delete('/marcas/:id', marcasController.deletarMarcas);

module.exports = router;
