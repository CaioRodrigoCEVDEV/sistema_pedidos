const jwt = require("jsonwebtoken");
const pool = require("../config/db");

/**
 * Única camada de autorização do sistema: exige que o usuário autenticado tenha
 * a tela liberada em usu_telas. Não há mais bypass de administrador nem gating
 * por módulo (empusapv/empusaest/usupv/usuest) — o acesso é definido
 * exclusivamente pelas "telas liberadas" do usuário (tela de Usuários).
 *
 * Uso: app.get('/clientes', requireTela('clientes'), handler)
 *
 * @param {string} chave chave da tela registrada em src/config/telas.js
 */
function requireTela(chave, opts) {
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
