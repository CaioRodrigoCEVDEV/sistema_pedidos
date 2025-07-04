const express = require('express');
const router = express.Router();
const loginController = require('../controllers/loginController');
const autenticarToken = require('../middlewares/middlewares');

router.post('/auth/login', loginController.validarLogin);
router.put('/auth/atualizarCadastro/:id', autenticarToken, loginController.atualizarCadastro);
router.post('/auth/register', loginController.cadastrarlogin);
router.get('/auth/listarlogin', autenticarToken, loginController.listarlogin);

module.exports = router;