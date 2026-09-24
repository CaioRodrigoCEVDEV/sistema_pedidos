const express = require("express");
const router = express.Router();
const munController = require("../controllers/munController");

router.get('/municipios', munController.listarMunicipios);
module.exports = router;
