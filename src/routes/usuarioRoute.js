const express = require("express");
const router = express.Router();
const usuarioController = require("../controllers/usuarioController");
const autenticarToken = require("../middlewares/middlewares");

router.post(
  "/usuario/atualizar/:id",
  autenticarToken,
  usuarioController.atualizarCadastro
);
router.get("/usuario/login/", autenticarToken, usuarioController.listarlogin);
router.get(
  "/usuario/listar/",
  autenticarToken,
  usuarioController.listarUsuarios
);
router.post(
  "/usuario/novo/",
  autenticarToken,
  usuarioController.cadastrarlogin
);
router.post(
  "/usuario/excluir/:id",
  autenticarToken,
  usuarioController.excluirCadastro
);

router.get(
  "/vendedor/listar/",
  usuarioController.listarVendedores
);

module.exports = router;
