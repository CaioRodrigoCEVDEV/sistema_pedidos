const pool = require("../config/db");

exports.listarMarcas = async (req, res) => {
  try {
    const result = await pool.query(
      "select * from marcas where marcassit = 'A' order by marcasordem"
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar marca" });
  }
};

exports.listarMarcasId = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "select * from vw_marcas where marcascod = $1",
      [id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar marca" });
  }
};

exports.inserirMarcas = async (req, res) => {
  const { marcasdes } = req.body;
  try {
    const result = await pool.query(
      `insert into marcas (marcasdes) values ($1) RETURNING *`,
      [marcasdes]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao inserir marca" });
  }
};

exports.atualizarMarcas = async (req, res) => {
  const { id } = req.params;
  const { marcasdes } = req.body;
  try {
    const result = await pool.query(
      `update marcas set marcasdes = $1 where marcascod = $2 RETURNING *`,
      [marcasdes, id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao inserir marca" });
  }
};

exports.atualizarMarcasStatus = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `update marcas set marcassit = $1 where marcascod = $2 RETURNING *`,
      ["I", id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar status da marca" });
  }
};

exports.deletarMarcas = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `delete from marcas where marcascod = $1 RETURNING *`,
      [id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao inserir marca" });
  }
};

exports.atualizarOrdemMarcas = async (req, res) => {
  try {
    const { ordem } = req.body; // array: [{id, descricao}, ...]

    if (!Array.isArray(ordem)) {
      return res.status(400).json({ message: "Ordem inválida" });
    }

    for (let i = 0; i < ordem.length; i++) {
      const item = ordem[i];
      await pool.query(
        `UPDATE marcas SET marcasordem = $1 WHERE marcascod = $2`,
        [i + 1, item.id] // usa o índice + 1 como nova ordem
      );
    }

    return res.status(200).json({ message: "Ordem atualizada com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar ordem:", error);
    return res.status(500).json({ message: "Erro interno ao atualizar ordem" });
  }
};
