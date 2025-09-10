const pool = require("../config/db");

exports.listarEmpresa = async (req, res) => {
  try {
    const result = await pool.query("select * from emp");
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar dados da empresa" });
  }
};

exports.editarNumeroEmpresa = async (req, res) => {
  const { empwhatsapp1, empwhatsapp2, emprazao } = req.body;
  try {
    const result = await pool.query(
      "update emp set empwhatsapp1 = $1, empwhatsapp2 = $2, emprazao=$3 RETURNING *",
      [empwhatsapp1, empwhatsapp2, emprazao]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar dados da empresa" });
  }
};

exports.dadosPagamento = async (req, res) => {
  try {
    const result = await pool.query("select empdtvenc, empdtpag from emp");
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar dados de pagamento" });
  }
};
