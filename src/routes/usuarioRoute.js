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
