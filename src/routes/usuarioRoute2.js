const express = require('express');
const router = express.Router();
const usuarioController2 = require('../controllers/usuarioController2');
const autenticarToken = require('../middlewares/middlewares');
const requireAdmin = require("../middlewares/adminMiddleware");

router.get('/usuario/listar2/',autenticarToken, usuarioController2.listarUsuarios);
router.post('/usuario/excluir2/:id',requireAdmin, usuarioController2.excluirCadastro);

module.exports = router;