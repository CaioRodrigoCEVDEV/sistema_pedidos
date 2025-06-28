const pool = require("../config/db");

exports.listarTipo = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "select  tipocod,tipodes, promarcascod,promodcod from vw_tipo_pecas  where promodcod = $1 ",
      [id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar tipo" });
  }
};

exports.listarTodosTipos = async (req, res) => {
  try {
    const result = await pool.query("select  tipocod,tipodes from tipo");
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar tipo" });
  }
};

exports.inserirTipo = async (req, res) => {
  const { tipodes } = req.body;

  try {
    const result = await pool.query(
      "insert into tipo (tipodes) values ($1) returning *",
      [tipodes]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar novo tipo" });
  }
};

exports.atualizarTipo = async (req, res) => {
  const { id } = req.params;
  const { tipodes } = req.body;

  try {
    const result = await pool.query(
      "update tipo set tipodes = $1 where tipocod = $2 returning *",
      [tipodes, id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao alterar tipo" });
  }
};

exports.deleteTipo = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "delete from tipo where tipocod = $1 returning *",
      [id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao excluir tipo" });
  }
};
