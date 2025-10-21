const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const autenticarToken = require('../middlewares/middlewares');

router.put('/usuario/atualizar/:id', autenticarToken, usuarioController.atualizarCadastro);
router.get('/usuario/login/', autenticarToken, usuarioController.listarlogin);
router.get('/usuario/listar/',autenticarToken, usuarioController.listarUsuarios);
router.post('/usuario/novo/', autenticarToken, usuarioController.cadastrarlogin);

module.exports = router;