const express = require("express");
const router = express.Router();
const usuarioController = require("../controllers/usuarioController");
const autenticarToken = require("../middlewares/middlewares");
const requireTela = require("../middlewares/telaMiddleware");

const requireUsuarios = requireTela("usuarios", { api: true });

router.post(
  "/usuario/atualizar/:id",
  requireUsuarios,
  usuarioController.atualizarCadastro
);
router.get("/usuario/login/", autenticarToken, usuarioController.listarlogin);
router.get(
  "/usuario/listar/",
  requireUsuarios,
  usuarioController.listarUsuarios
);
router.post(
  "/usuario/novo/",
  requireUsuarios,
  usuarioController.cadastrarlogin
);
router.post(
  "/usuario/excluir/:id",
  requireUsuarios,
  usuarioController.excluirCadastro
);

router.get(
  "/vendedor/listar/",
  autenticarToken,
  usuarioController.listarVendedores
);

// viuversao
router.post(
  "/usuario/viuversao/",
  autenticarToken,
  usuarioController.viuVersao
);

router.get(
  "/usuario/viuversao/",
  autenticarToken,
  usuarioController.usuViuVersao
);
// fim viuversao

// Preferência do tour guiado da tela de Vitrines
router.post("/usuario/viutour/", autenticarToken, usuarioController.viuTour);
router.get("/usuario/viutour/", autenticarToken, usuarioController.usuViuTour);
// fim viutour

// Preferência do tour que apresenta o item Vitrines no menu
router.post(
  "/usuario/viutourmenu/",
  autenticarToken,
  usuarioController.viuTourMenu
);
router.get(
  "/usuario/viutourmenu/",
  autenticarToken,
  usuarioController.usuViuTourMenu
);
// fim viutourmenu

module.exports = router;
