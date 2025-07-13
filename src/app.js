require("dotenv").config();
const jwt = require("jsonwebtoken");
const express = require("express");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require('cors');


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para servir arquivos estáticos (inclui uploads)
app.use(express.static(path.join(__dirname, "../public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // <-- pasta onde salva imagens

// Middlewares
const autenticarToken = require("./middlewares/middlewares");
app.set("views", path.join(__dirname, "views"));
app.use(morgan("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(cors());


const corsOptions = {
  origin: ['http://jppecashop.com.br', 'http://www.jppecashop.com.br'],
  credentials: true,
};

// Configuração do CORS
app.use(cors(corsOptions));

// Rotas
const mainRoutes = require("./routes");
app.use("/", mainRoutes);

const loginRoute = require("./routes/loginRoute");
app.use(loginRoute);

const marcasRoutes = require("./routes/marcasRoutes");
app.use(marcasRoutes);

const modeloRoutes = require("./routes/modeloRoutes");
app.use(modeloRoutes);

const proRoutes = require("./routes/proRoutes");
app.use(proRoutes);

const tipoRoutes = require("./routes/tipoRoutes");
app.use(tipoRoutes);

const empRoutes = require("./routes/empRoutes");
app.use(empRoutes);

// Rotas de páginas
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/auth/login.html"));
});
app.get("/index", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/index.html"));
});
app.get("/modelo", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/modelo.html"));
});
app.get("/pecas", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/pecas.html"));
});
app.get("/lista-pecas", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/lista-pecas.html"));
});
app.get("/carrinho", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/carrinho.html"));
});
app.get("/perfil", autenticarToken, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/auth/perfil.html"));
});
app.get("/configuracoes", autenticarToken, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/configuracoes.html"));
});
app.get("/painel", autenticarToken,(req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/auth/admin/html/painel.html"));
});
app.get("/dashboard",autenticarToken, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/auth/admin/html/index.html"));
});
app.get("/dashboard/modelo",autenticarToken, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/auth/admin/html/modelo.html"));
});
app.get("/dashboard/modelo/pecas",autenticarToken, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/auth/admin/html/pecas.html"));
});
app.get("/dashboard/modelo/pecas/lista",autenticarToken, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/auth/admin/html/lista-pecas.html"));
});

app.get("/config.js", (req, res) => {
  res.type("application/javascript");
  res.send(`const BASE_URL = '${process.env.BASE_URL}';`);
});

app.get('/auth/sair', (req, res) => {
  const token_session = req.cookies.token;
  if (token_session) {
    res.clearCookie('usunome', { path: '/' });
    res.clearCookie('token', { path: '/' });
    res.json({ message: 'Logout realizado com sucesso.' });
  } else {
    res.status(401).json({ error: "erro ao sair" });
  }
});

//  Rota para upload de logo
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, "logo.jpg"), 
});
const upload = multer({ storage });

app.post("/upload-logo", autenticarToken, upload.single("logo"), (req, res) => {
  res.redirect("/configuracoes"); 
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${process.env.BASE_URL}/index`);
});
