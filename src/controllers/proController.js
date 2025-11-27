const pool = require("../config/db");

exports.listarProduto = async (req, res) => {
  const { id } = req.params;
  const { marca, modelo } = req.query;

  try {
    const result = await pool.query(
      `select procod, prodes, provl,tipodes,prosemest from pro 
        join tipo on tipocod = protipocod
         where promarcascod = $1 and promodcod  = $2 and protipocod  = $3
         order by proordem`,
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
      tipodes,
      marcasdes, 
      case when prodes is null then '' else prodes end as prodes, 
      case when provl is null then 0 else provl end as provl
      from pro
      join tipo on tipocod = protipocod
      join marcas on promarcascod = marcascod and marcassit = 'A'
      order by procod desc`);
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
       case when provl is null then 0 else provl end as provl, 
       case when prosemest is null then 'N' else prosemest end as prosemest from pro where procod = $1`,
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
  const { prodes, provl, prosemest } = req.body;
  try {
    const result = await pool.query(
      `update pro set prodes = $1, provl = $2, prosemest = $3 where procod = $4 RETURNING *`,
      [prodes, provl, prosemest,id]
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

exports.listarProdutoCoresDisponiveis = async (req, res) => {
  const { id } = req.params;
  //const { marca, modelo } = req.query;

  try {
    const result = await pool.query(
      `select procod, prodes, provl, tipodes, corcod, case when cornome is null then '' else cornome end as cornome from pro
        join tipo on tipocod = protipocod
        left join procor on procorprocod = procod
        left join cores on corcod = procorcorescod where procod  = $1`,
      [id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar cores" });
  }
};

// Nota: Esta função depende da coluna procor.procorqtde (criada em src/config/atualizardb.js).
// Se a coluna não existir, a validação de estoque por cor não funcionará corretamente.
exports.inserirProdutoCoresDisponiveis = async (req, res) => {
  const { id } = req.params;
  //const { marca, modelo } = req.query;

  try {
    // Verifica se o produto tem estoque geral > 0
    const produtoResult = await pool.query(
      `SELECT proqtde FROM pro WHERE procod = $1`,
      [id]
    );

    if (produtoResult.rows.length > 0) {
      const proqtde = produtoResult.rows[0].proqtde ?? 0;
      if (proqtde > 0) {
        return res.status(400).json({
          erro: "Não é permitido adicionar cor enquanto o produto possuir quantidade (proqtde) maior que zero."
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO procor (procorprocod, procorcorescod) VALUES ($1, $2) RETURNING *`,
      [id, req.query.corescod]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao inserir cores" });
  }
};

// Nota: Esta função depende da coluna procor.procorqtde (criada em src/config/atualizardb.js).
// Lógica de validação:
// 1. Se procor.procorqtde !== null e > 0, recusar a remoção.
// 2. Se procor.procorqtde is null, usar pro.proqtde como fallback; se > 0, recusar.
// 3. Só permitir DELETE quando a quantidade efetiva for 0.
exports.deletarProdutoCoresDisponiveis = async (req, res) => {
  const { id } = req.params;
  const corescod = req.query.corescod;

  try {
    // Busca procorqtde da linha específica
    const procorResult = await pool.query(
      `SELECT procorqtde FROM procor WHERE procorprocod = $1 AND procorcorescod = $2`,
      [id, corescod]
    );

    if (procorResult.rows.length > 0) {
      const procorqtde = procorResult.rows[0].procorqtde;

      // Se procorqtde não é null, verificar se é > 0
      if (procorqtde !== null) {
        if (procorqtde > 0) {
          return res.status(400).json({
            erro: "Não é permitido desvincular cor enquanto a quantidade desta cor for maior que zero."
          });
        }
        // procorqtde === 0, pode prosseguir com a remoção
      } else {
        // procorqtde é null, usar pro.proqtde como fallback
        const produtoResult = await pool.query(
          `SELECT proqtde FROM pro WHERE procod = $1`,
          [id]
        );

        if (produtoResult.rows.length > 0) {
          const proqtde = produtoResult.rows[0].proqtde ?? 0;
          if (proqtde > 0) {
            return res.status(400).json({
              erro: "Não é permitido desvincular cor enquanto o produto possuir quantidade (proqtde) maior que zero."
            });
          }
        }
      }
    }

    const result = await pool.query(
      `delete from procor where procorprocod = $1 and procorcorescod = $2 RETURNING *`,
      [id, corescod]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao deletar cor do produto" });
  }
};

exports.alterarProdutoCoresDisponiveis = async (req, res) => {
  const { id } = req.params;
  //const { marca, modelo } = req.query;

  try {
    const result = await pool.query(
      `update procor set procorcorescod = $1 where procorprocod = $2 and procorcorescod = $3 RETURNING *`,
      [req.query.corescodnovo, id, req.query.corescod]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao inserir cores" });
  }
};

exports.atualizarOrdemProdutos = async (req, res) => {
  try {
    const { ordem } = req.body; // array: [{id, descricao}, ...]

    if (!Array.isArray(ordem)) {
      return res.status(400).json({ message: "Ordem inválida" });
    }

    for (let i = 0; i < ordem.length; i++) {
      const item = ordem[i];
      await pool.query(
        `UPDATE pro SET proordem = $1 WHERE procod = $2`,
        [i + 1, item.id] // usa o índice + 1 como nova ordem
      );
    }

    return res.status(200).json({ message: "Ordem atualizada com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar ordem:", error);
    return res.status(500).json({ message: "Erro interno ao atualizar ordem" });
  }
};

exports.listarProdutosComEstoque = async (req, res) => {
  try {
    const result = await pool.query(
      `select 
        procod,
        prodes,
        marcasdes,
        moddes,
        tipodes,
        coalesce(cornome, 'Sem Cor') as cordes,
        case when procorcorescod is null then proqtde else procorqtde end as qtde,
        procorcorescod
        from pro
        join marcas on marcascod = promarcascod 
        join tipo on tipocod = protipocod
        left join procor on procod = procorprocod
        left join cores on corcod = procorcorescod
        join modelo on modcod = promodcod
        where case when procorcorescod is null then proqtde else procorqtde end > 0
        and prosit = 'A'`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar produtos estoque" });
  }
};

exports.listarProdutosSemEstoque = async (req, res) => {
  try {
    const result = await pool.query(
      `select 
        procod,
        prodes,
        marcasdes,
        moddes,
        tipodes,
        coalesce(cornome, 'Sem Cor') as cordes,
        case when procorcorescod is null then proqtde else procorqtde end as qtde,
        procorcorescod
        from pro
        join marcas on marcascod = promarcascod 
        join tipo on tipocod = protipocod
        left join procor on procod = procorprocod
        left join cores on corcod = procorcorescod
        join modelo on modcod = promodcod
        where case when procorcorescod is null then proqtde else procorqtde end <= 0
        and prosit = 'A'`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar produtos estoque" });
  }
};

exports.gravarEstoqueProduto = async (req, res) => {
  const { id } = req.params;
  const { quantidade, cor = null } = req.body;

  //console.log("Recebido no backend:", { id, quantidade, cor });
  try {
    const produto = await pool.query(
      "SELECT procorprocod FROM procor WHERE procorprocod = $1 group by procorprocod",
      [id]
    );

    if (
      produto.rows.length > 0 &&
      produto.rows[0].procorprocod &&
      cor !== null
    ) {
      await pool.query(
        "UPDATE procor SET procorqtde = $1 WHERE procorprocod = $2 and procorcorescod = $3",
        [quantidade, id, cor]
      );
    } else {
      await pool.query(
        "UPDATE pro SET proqtde = $1 WHERE procod = $2",
        [quantidade, id]
      );
    }

    res.json({ sucesso: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar estoque" });
  }
};
