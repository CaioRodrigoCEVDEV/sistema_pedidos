const pool = require("../config/db");

exports.listarProduto = async (req, res) => {
  const { id } = req.params;
  const { marca, modelo } = req.query;

  try {
    const result = await pool.query(
      "select procod, prodes, provl from pro where promarcascod = $1 and promodcod  = $2 and protipocod  = $3",
      [marca, modelo, id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
};

exports.listarProdutoCarrinho = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "select procod, prodes, provl from pro where procod = $1 ",
      [id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
};

exports.inserirProduto = async (req, res) => {
  const { prodes, promarcascod, promodcod, protipocod, provl } = req.body;
  try {
    const result = await pool.query(
      `insert into pro (prodes,promarcascod,promodcod,protipocod,provl) values ($1,$2,$3,$4,$5) RETURNING *`,
      [prodes, promarcascod, promodcod, protipocod, provl]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao inserir produto" });
  }
};
