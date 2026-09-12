const pool = require("../config/db");

// Lista o catálogo de telas ativas (usado pelo modal de usuários).
exports.listarTelas = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT telacod, telachave, telanome, telarota, telaicone, telagrupo, telaordem
         FROM public.telas
        WHERE telaativa = 'S'
        ORDER BY telaordem, telanome`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar telas" });
  }
};

// Permissões do usuário logado (usado pelo shell para montar o menu).
exports.minhasPermissoes = async (req, res) => {
  const { usucod, usuadm, usupv, usuest } = req.token;

  try {
    if (usuadm === "S") {
      const todas = await pool.query(
        `SELECT telachave FROM public.telas WHERE telaativa = 'S' ORDER BY telaordem`
      );
      return res.status(200).json({
        usuadm,
        usupv,
        usuest,
        telas: todas.rows.map((r) => r.telachave),
      });
    }

    const result = await pool.query(
      `SELECT t.telachave
         FROM public.usu_telas ut
         JOIN public.telas t ON t.telacod = ut.usutelatelacod
        WHERE ut.usutelausucod = $1
          AND ut.usutelapermitido = 'S'
          AND t.telaativa = 'S'
        ORDER BY t.telaordem`,
      [usucod]
    );

    res.status(200).json({
      usuadm,
      usupv,
      usuest,
      telas: result.rows.map((r) => r.telachave),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar permissões" });
  }
};
