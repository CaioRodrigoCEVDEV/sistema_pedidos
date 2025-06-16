require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Rotas
const mainRoutes = require('./routes');
app.use('/', mainRoutes);

const marcasRoutes = require('./routes/marcasRoutes');
app.use(marcasRoutes);

const modeloRoutes = require('./routes/modeloRoutes');
app.use(modeloRoutes);

const proRoutes = require('./routes/proRoutes');
app.use(proRoutes);

const tipoRoutes = require('./routes/tipoRoutes');
app.use(tipoRoutes);

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta http://127.0.0.1:${PORT}/teste`);
});
