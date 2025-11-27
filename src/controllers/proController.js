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

/**
 * Insere vínculo de cor a um produto.
 * Validação: Só permite vincular cor quando pro.proqtde = 0.
 * Observação: Esta implementação assume a existência da coluna procor.procorqtde
 * (criada em src/config/atualizardb.js). Caso a coluna não exista em produção,
 * a validação de quantidade por cor não funcionará.
 */
exports.inserirProdutoCoresDisponiveis = async (req, res) => {
  const { id } = req.params;
  const { corescod } = req.query;

  try {
    // Verificar se o produto possui estoque geral > 0
    const produtoResult = await pool.query(
      `SELECT proqtde FROM pro WHERE procod = $1`,
      [id]
    );

    if (produtoResult.rows.length === 0) {
      return res.status(404).json({ erro: "Produto não encontrado" });
    }

    const proqtde = produtoResult.rows[0].proqtde || 0;

    if (proqtde > 0) {
      return res.status(400).json({
        erro: "Não é permitido vincular cor enquanto o produto possuir quantidade (proqtde) maior que zero"
      });
    }

    const result = await pool.query(
      `insert into procor values($1,$2) RETURNING *`,
      [id, corescod]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao inserir cores" });
  }
};

/**
 * Deleta vínculo de cor de um produto.
 * Validação: Só permite desvincular cor quando a quantidade dessa cor (procor.procorqtde) = 0.
 * Se procor.procorqtde for NULL, usa o estoque geral do produto (pro.proqtde) como fallback.
 * Observação: Esta implementação assume a existência da coluna procor.procorqtde
 * (criada em src/config/atualizardb.js). Caso a coluna não exista em produção,
 * a validação de quantidade por cor não funcionará.
 */
exports.deletarProdutoCoresDisponiveis = async (req, res) => {
  const { id } = req.params;
  const { corescod } = req.query;

  try {
    // Buscar procor.procorqtde e pro.proqtde para a combinação
    const validationResult = await pool.query(
      `SELECT procor.procorqtde, pro.proqtde 
       FROM procor 
       JOIN pro ON pro.procod = procor.procorprocod 
       WHERE procorprocod = $1 AND procorcorescod = $2`,
      [id, corescod]
    );

    if (validationResult.rows.length === 0) {
      return res.status(404).json({ erro: "Vínculo de cor não encontrado" });
    }

    const { procorqtde, proqtde } = validationResult.rows[0];

    // Se procorqtde não é null e > 0, recusar
    if (procorqtde !== null && procorqtde > 0) {
      return res.status(400).json({
        erro: "Não é permitido desvincular cor enquanto a quantidade desta cor for maior que zero"
      });
    }

    // Se procorqtde é null, usar proqtde como fallback
    if (procorqtde === null && (proqtde || 0) > 0) {
      return res.status(400).json({
        erro: "Não é permitido desvincular cor enquanto o produto possuir quantidade (proqtde) maior que zero"
      });
    }

    const result = await pool.query(
      `delete from procor where procorprocod = $1 and procorcorescod = $2 RETURNING *`,
      [id, corescod]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao deletar cores" });
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
