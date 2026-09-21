const jwt = require("jsonwebtoken");

// Bloqueia endpoints de API quando a empresa nao controla estoque
// (empusaest <> 'S'). Deve rodar depois de autenticarToken, que deixa o token
// decodificado em req.token. Diferente do telaMiddleware (paginas), responde
// com JSON para o fetch do frontend.
function requireModuloEst(req, res, next) {
  let decoded = req.token;

  if (!decoded) {
    const token = req.cookies && req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: "Não autenticado." });
    }
    try {
      decoded = jwt.verify(token, "chave-secreta");
    } catch (err) {
      return res.status(401).json({ error: "Sessão inválida." });
    }
  }

  if (String(decoded.empusaest || "").trim() !== "S") {
    return res.status(403).json({ error: "Módulo de estoque não habilitado." });
  }

  return next();
}

module.exports = requireModuloEst;
