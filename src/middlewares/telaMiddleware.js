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
    const json = opts?.api || (req.get("accept") || "").includes("application/json");
    const token = req.cookies.token;

    if (!token) {
      if (json) return res.status(401).json({ error: "Faça login para continuar." });
      return res.status(401).redirect("/login");
    }

    let decoded;
    try {
      decoded = jwt.verify(token, "chave-secreta");
    } catch (err) {
      if (json) return res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
      return res.status(500).redirect("/login");
    }

    req.token = decoded;

    // O módulo da empresa vale para todos, inclusive administradores.
    if (modulo === "pv" && decoded.empusapv !== "S") {
      if (json) return res.status(403).json({ error: "Módulo de pedidos não habilitado." });
      return res.status(403).redirect("/painel?erroMSG=modulo-nao-habilitado");
    }
    if (modulo === "est" && decoded.empusaest !== "S") {
      if (json) return res.status(403).json({ error: "Módulo de estoque não habilitado." });
      return res.status(403).redirect("/painel?erroMSG=modulo-nao-habilitado");
    }

    // Administrador ignora qualquer restrição por tela.
    if (decoded && decoded.usuadm === "S") {
      req.user = decoded;
      return next();
    }

    if (modulo === "pv" && decoded.usupv !== "S") {
      if (json) return res.status(403).json({ error: "Seu usuário não tem acesso ao módulo de pedidos." });
      return res.status(403).redirect("/perfil");
    }
    if (modulo === "est" && decoded.usuest !== "S") {
      if (json) return res.status(403).json({ error: "Seu usuário não tem acesso ao módulo de estoque." });
      return res.status(403).redirect("/perfil");
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

      if (json) return res.status(403).json({ error: "Você não tem permissão para acessar esta tela." });
      return res.status(403).send(`
        <script>
          alert("⚠️ Acesso negado: você não tem permissão para acessar esta tela.");
          window.location.href = "/perfil";
        </script>
      `);
    } catch (err) {
      console.error("Erro ao verificar permissão de tela:", err);
      if (json) return res.status(500).json({ error: "Não foi possível verificar suas permissões." });
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
