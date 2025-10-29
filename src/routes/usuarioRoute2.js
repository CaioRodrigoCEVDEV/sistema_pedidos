const express = require('express');
const router = express.Router();
const usuarioController2 = require('../controllers/usuarioController2');
const autenticarToken = require('../middlewares/middlewares');
const requireAdmin = require("../middlewares/adminMiddleware");

router.get('/api/v2/usuario/listar/',autenticarToken, usuarioController2.listarUsuarios);
router.post('api/v2/usuario/excluir/:id',requireAdmin, usuarioController2.excluirCadastro);

module.exports = router;