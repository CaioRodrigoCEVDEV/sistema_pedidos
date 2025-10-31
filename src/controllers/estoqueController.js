const pool = require("../config/db");

exports.mostrarEstoqueItens = async (req, res) => {

  try {
    const result = await pool.query(
      `select  
        procod,
        marcasdes,
        prodes,
        tipodes,
        case when cornome is null then 'Nenhuma' else cornome end as cornome,
        proqtde 
        from pro 
        join marcas on marcascod = promarcascod  
        join tipo on tipocod = protipocod 
        left join cores on corcod =procor 
        where prosit = 'A'`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar estoque" });
  }
};


exports.mostrarEstoqueItem = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "select  procod,proqtde from pro  where procod = $1",[id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar estoque" });
  }
};

exports.atualizarEstoque = async (req, res) => {
  const { id } = req.params;
  const { proqtde } = req.body;

  try {
    const result = await pool.query(
      "update pro set proqtde = $1 where procod = $2 returning *",
      [proqtde, id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar estoque" });
  }
};
