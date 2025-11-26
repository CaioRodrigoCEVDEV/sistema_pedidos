const pool = require("../config/db");

exports.listarProduto = async (req, res) => {
  const { id } = req.params;
  const { marca, modelo } = req.query;

  try {
    // Busca produtos que estão vinculados ao modelo pela nova tabela promod
    // ou pelo campo legado promodcod (para compatibilidade)
    const result = await pool.query(
      `select distinct procod, prodes, provl, tipodes, prosemest from pro 
        join tipo on tipocod = protipocod
        left join promod on promodprocod = procod
        where promarcascod = $1 
          and (promodmodcod = $2 OR promodcod = $2)
          and protipocod = $3
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
      case when provl is null then 0 else provl end as provl,
      (
        SELECT string_agg(m.moddes, ', ' ORDER BY m.moddes)
        FROM promod pm
        JOIN modelo m ON pm.promodmodcod = m.modcod
        WHERE pm.promodprocod = pro.procod
      ) as modelos
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
       promarcascod,
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
  const { prodes, promarcascod, promodcod, promodcods, protipocod, provl } = req.body;
  
  // Normalizar modelos: aceitar tanto um único valor quanto um array
  let modelIds = [];
  if (promodcods && Array.isArray(promodcods)) {
    modelIds = promodcods.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  } else if (promodcod) {
    // Compatibilidade com formato antigo (único modelo)
    const singleId = parseInt(promodcod, 10);
    if (!isNaN(singleId)) {
      modelIds = [singleId];
    }
  }
  
  if (modelIds.length === 0) {
    return res.status(400).json({ error: "É necessário informar pelo menos um modelo" });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Inserir o produto com o primeiro modelo como promodcod (para compatibilidade)
    const result = await client.query(
      `insert into pro (prodes,promarcascod,promodcod,protipocod,provl) values ($1,$2,$3,$4,$5) RETURNING *`,
      [prodes, promarcascod, modelIds[0], protipocod, provl]
    );
    
    const procod = result.rows[0].procod;
    
    // Inserir todos os modelos na tabela de relacionamento usando batch insert
    if (modelIds.length > 0) {
      const values = modelIds.map((modcod, i) => `($1, $${i + 2})`).join(', ');
      const params = [procod, ...modelIds];
      await client.query(
        `INSERT INTO promod (promodprocod, promodmodcod) VALUES ${values} ON CONFLICT DO NOTHING`,
        params
      );
    }
    
    await client.query('COMMIT');
    res.status(200).json(result.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: "Erro ao inserir produto" });
  } finally {
    client.release();
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
  const { prodes, provl, prosemest, promodcods } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Atualizar dados básicos do produto
    const result = await client.query(
      `update pro set prodes = $1, provl = $2, prosemest = $3 where procod = $4 RETURNING *`,
      [prodes, provl, prosemest, id]
    );
    
    // Se foram enviados modelos, atualizar a tabela de relacionamento
    if (promodcods && Array.isArray(promodcods)) {
      const modelIds = promodcods.map(modId => parseInt(modId, 10)).filter(modId => !isNaN(modId));
      
      if (modelIds.length > 0) {
        // Remover modelos antigos
        await client.query(
          `DELETE FROM promod WHERE promodprocod = $1`,
          [id]
        );
        
        // Inserir novos modelos usando batch insert
        const values = modelIds.map((modcod, i) => `($1, $${i + 2})`).join(', ');
        const params = [id, ...modelIds];
        await client.query(
          `INSERT INTO promod (promodprocod, promodmodcod) VALUES ${values} ON CONFLICT DO NOTHING`,
          params
        );
        
        // Atualizar o promodcod no produto (para compatibilidade)
        await client.query(
          `UPDATE pro SET promodcod = $1 WHERE procod = $2`,
          [modelIds[0], id]
        );
      }
    }
    
    await client.query('COMMIT');
    res.status(200).json(result.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: "Erro ao editar produto" });
  } finally {
    client.release();
  }
};

// Listar modelos vinculados a um produto
exports.listarModelosProduto = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT m.modcod, m.moddes, m.modmarcascod
       FROM promod pm
       JOIN modelo m ON pm.promodmodcod = m.modcod
       WHERE pm.promodprocod = $1
       ORDER BY m.moddes`,
      [id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar modelos do produto" });
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
      `select procod, prodes, provl, tipodes, corcod, case when cornome is null then '' else cornome end as cornome, procorsemest from pro
        join tipo on tipocod = protipocod
        left join procor on procorprocod = procod
        left join cores on corcod = procorcorescod 
        where procod  = $1 `,
      [id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar cores" });
  }
};

exports.inserirProdutoCoresDisponiveis = async (req, res) => {
  const { id } = req.params;
  const procorsemest = req.query.procorsemest || 'N';  // Default to 'N' if not provided

  try {
    const result = await pool.query(
      `insert into procor values($1,$2,$3) RETURNING *`,
      [id, req.query.corescod, procorsemest]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao inserir cores" });
  }
};

exports.deletarProdutoCoresDisponiveis = async (req, res) => {
  const { id } = req.params;
  //const { marca, modelo } = req.query;

  try {
    const result = await pool.query(
      `delete from procor where procorprocod = $1 and procorcorescod = $2 RETURNING *`,
      [id, req.query.corescod]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao inserir cores" });
  }
};

exports.alterarProdutoCoresDisponiveis = async (req, res) => {
  const { id } = req.params;
  //const { marca, modelo } = req.query;
  console.log("Alterar cores:", { id, query: req.query });

  try {
    const result = await pool.query(
      `update procor set procorcorescod = $1, procorsemest = $2 where procorprocod = $3 and procorcorescod = $4 RETURNING *`,
      [
        req.query.corescodnovo,
        req.query.procorsemestnovo,
        id,
        req.query.corescod,
      ]
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
      `select distinct
        procod,
        prodes,
        marcasdes,
        (
          SELECT string_agg(m.moddes, ', ' ORDER BY m.moddes)
          FROM promod pm
          JOIN modelo m ON pm.promodmodcod = m.modcod
          WHERE pm.promodprocod = pro.procod
        ) as moddes,
        tipodes,
        coalesce(cornome, 'Sem Cor') as cordes,
        case when procorcorescod is null then proqtde else procorqtde end as qtde,
        procorcorescod
        from pro
        join marcas on marcascod = promarcascod 
        join tipo on tipocod = protipocod
        left join procor on procod = procorprocod
        left join cores on corcod = procorcorescod
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
      `select distinct
        procod,
        prodes,
        marcasdes,
        (
          SELECT string_agg(m.moddes, ', ' ORDER BY m.moddes)
          FROM promod pm
          JOIN modelo m ON pm.promodmodcod = m.modcod
          WHERE pm.promodprocod = pro.procod
        ) as moddes,
        tipodes,
        coalesce(cornome, 'Sem Cor') as cordes,
        case when procorcorescod is null then proqtde else procorqtde end as qtde,
        procorcorescod
        from pro
        join marcas on marcascod = promarcascod 
        join tipo on tipocod = protipocod
        left join procor on procod = procorprocod
        left join cores on corcod = procorcorescod
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
      await pool.query("UPDATE pro SET proqtde = $1 WHERE procod = $2", [
        quantidade,
        id,
      ]);
    }

    res.json({ sucesso: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar estoque" });
  }
};
