require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
var path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(express.static('public/'));
app.use(express.static('public/html/js/'));

// Middlewares
app.set('views', path.join(__dirname, 'views'));
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
// Serve arquivos estáticos da pasta 'public' fora da src
app.use(express.static(path.join(__dirname, '../public')));

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

app.get('/index', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/html/index.html'));
});
app.get('/modelo', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/html/modelo.html'));
});
app.get('/pecas', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/html/pecas.html'));
});
app.get('/lista-pecas', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/html/lista-pecas.html'));
});
app.get('/carrinho', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/html/carrinho.html'));
});
app.get('/registro', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/html/register/registro.html'));
});

app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`const BASE_URL = '${process.env.BASE_URL}';`);
});
// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${process.env.BASE_URL}/index`);
});
