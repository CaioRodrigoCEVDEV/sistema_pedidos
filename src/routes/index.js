const express = require('express');
const router = express.Router();

router.get('/teste', (req, res) => {
  res.send('Deu boa pá nois!');
});

module.exports = router;
