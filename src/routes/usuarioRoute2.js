const express = require('express');
const router = express.Router();
const usuarioController2 = require('../controllers/usuarioController2');
const requireTela = require('../middlewares/telaMiddleware');

const requireUsuarios = requireTela("usuarios", { api: true });

router.get('/api/v2/usuario/listar/', requireUsuarios, usuarioController2.listarUsuarios);
router.post('/api/v2/usuario/excluir/:id', requireUsuarios, usuarioController2.excluirCadastro);

module.exports = router;
