const pool = require("../config/db");
const { coresCache, sendCached } = require("../utils/catalogListCaches");

exports.listarCores = async (req, res) => {
  try {
    let entry = coresCache.get();

    if (!entry) {
      const result = await pool.query("select  * from cores  ");
      entry = coresCache.set(result.rows);
    }

    return sendCached(req, res, entry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar cores" });
  }
};


exports.inserirCores = async (req, res) => {
  const { cornome } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO public.cores (cornome) VALUES($1) returning *",
      [cornome]
    );
    coresCache.invalidate();
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao cadastrar nova cor" });
  }
};

exports.atualizarCores = async (req, res) => {
  const { id } = req.params;
  const { cornome } = req.body;

  try {
    const result = await pool.query(
      "update cores set cornome = $1 where corcod = $2 returning *",
      [cornome, id]
    );
    coresCache.invalidate();
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao alterar COR" });
  }
};

exports.deleteCores = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "delete from cores where corcod = $1 returning *",
      [id]
    );
    coresCache.invalidate();
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao excluir cor" });
  }
};
