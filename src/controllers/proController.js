const pool = require("../config/db");

exports.listarProduto = async (req, res) => {
  const { id } = req.params;
  const { marca, modelo } = req.query;

  try {
    const result = await pool.query(
      `select procod, prodes, provl,tipodes, case when cornome is null then '' else cornome end as cornome from pro join tipo on tipocod = protipocod left join cores on corcod = procor where promarcascod = $1 and promodcod  = $2 and protipocod  = $3`,
      [marca, modelo, id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
};

exports.listarProdutos = async (req, res) => {
  try {
    const result = await pool.query(`
      select 
      procod, 
      case when prodes is null then '' else prodes end as prodes, 
      case when provl is null then 0 else provl end as provl
      from pro order by procod desc`);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
};

exports.listarProdutosPainelId = async (req, res) => {
  try {
    const result = await pool.query(
      `select         
       procod, 
       case when prodes is null then '' else prodes end as prodes,
       case when provl is null then 0 else provl end as provl from pro where procod = $1`,
      [req.params.id]
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
      "select procod, prodes, provl,tipodes from pro join tipo on tipocod = protipocod  where procod = $1",
      [id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
};

exports.inserirProduto = async (req, res) => {
  const { prodes, promarcascod, promodcod, protipocod, provl, procor } = req.body;
  try {
    const result = await pool.query(
      `insert into pro (prodes,promarcascod,promodcod,protipocod,provl, procor) values ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [prodes, promarcascod, promodcod, protipocod, provl,procor]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao inserir produto" });
  }
};

// excluir produto
exports.excluirProduto = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("delete from pro where procod = $1", [id]);
    if (result.rowCount > 0) {
      res.status(200).json({ message: "Produto excluído com sucesso" });
    } else {
      res.status(404).json({ error: "Produto não encontrado" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao excluir produto" });
  }
};


exports.editarProduto = async (req, res) => {
  const { id } = req.params;
  const { prodes, provl } = req.body;
  try {
    const result = await pool.query(
      `update pro set prodes = $1, provl = $2 where procod = $3 RETURNING *`,
      [prodes, provl,id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao inserir produto" });
  }
};

exports.listarProCor = async (req, res) => {

  try {
    const result = await pool.query(
      "select corcod, cornome from cores order by corcod"
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar cores" });
  }
};

