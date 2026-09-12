const jwt = require("jsonwebtoken");
const pool = require("../config/db");

/**
 * Protege uma página/tela exigindo que o usuário tenha a permissão da tela
 * liberada. Administradores (usuadm='S') têm acesso total e ignoram a checagem.
 *
 * Uso: app.get('/clientes', requireTela('clientes'), handler)
 *
 * @param {string} chave   chave da tela registrada em src/config/telas.js
 * @param {object} [opts]
 * @param {'pv'|'est'} [opts.modulo] módulo da empresa que também deve estar ativo
 */
function requireTela(chave, opts) {
  const modulo = opts && opts.modulo;

  return async function (req, res, next) {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).redirect("/login");
    }

    let decoded;
    try {
      decoded = jwt.verify(token, "chave-secreta");
    } catch (err) {
      return res.status(500).redirect("/login");
    }

    req.token = decoded;

    // O módulo da empresa vale para todos, inclusive administradores.
    if (modulo === "pv" && decoded.empusapv !== "S") {
      return res.status(403).redirect("/painel?erroMSG=modulo-nao-habilitado");
    }
    if (modulo === "est" && decoded.empusaest !== "S") {
      return res.status(403).redirect("/painel?erroMSG=modulo-nao-habilitado");
    }

    // Administrador ignora qualquer restrição por tela.
    if (decoded && decoded.usuadm === "S") {
      req.user = decoded;
      return next();
    }

    try {
      const result = await pool.query(
        `SELECT 1
           FROM public.usu_telas ut
           JOIN public.telas t ON t.telacod = ut.usutelatelacod
          WHERE ut.usutelausucod = $1
            AND t.telachave = $2
            AND ut.usutelapermitido = 'S'
            AND t.telaativa = 'S'
          LIMIT 1`,
        [decoded.usucod, chave]
      );

      if (result.rowCount > 0) {
        req.user = decoded;
        return next();
      }

      return res.status(403).send(`
        <script>
          alert("⚠️ Acesso negado: você não tem permissão para acessar esta tela.");
          window.location.href = "/perfil";
        </script>
      `);
    } catch (err) {
      console.error("Erro ao verificar permissão de tela:", err);
      return res.status(500).send(`
        <script>
          alert("Erro ao verificar permissões. Tente novamente.");
          window.location.href = "/perfil";
        </script>
      `);
    }
  };
}

module.exports = requireTela;
