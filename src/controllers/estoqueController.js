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

/**
 * Valida se há estoque suficiente para uma lista de itens do carrinho,
 * considerando a lógica de sincronização de grupos de peças.
 * 
 * Requisitos funcionais:
 * 1) Peça sem grupo: valida apenas o estoque da peça
 * 2) Peça com grupo que tem estoque definido: valida estoque do grupo
 * 3) Peça com grupo sem estoque definido: valida estoque de todas as peças do grupo
 * 
 * Retorna { valido: true } ou { valido: false, erro: "mensagem" }
 */
exports.validarEstoqueCarrinho = async (req, res) => {
  const { cart } = req.body;

  if (!Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ valido: false, erro: "Carrinho vazio ou inválido" });
  }

  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    for (const item of cart) {
      const procod = parseInt(String(item.id).split("-")[0]);
      const quantidade = item.qt || 1;
      const idCorSelecionada = item.idCorSelecionada || null;

      // Se tem cor selecionada, valida o estoque da cor
      if (idCorSelecionada !== null) {
        const corResult = await client.query(
          `SELECT procorqtde FROM procor 
           WHERE procorprocod = $1 AND procorcorescod = $2 
           FOR UPDATE`,
          [procod, idCorSelecionada]
        );

        if (corResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({ 
            valido: false, 
            erro: `Cor não encontrada para o produto ${item.nome || procod}` 
          });
        }

        const estoqueDisponivel = corResult.rows[0].procorqtde || 0;
        if (estoqueDisponivel < quantidade) {
          await client.query("ROLLBACK");
          return res.status(400).json({ 
            valido: false, 
            erro: `Estoque insuficiente para ${item.nome || "produto"} (cor). Disponível: ${estoqueDisponivel}, Solicitado: ${quantidade}` 
          });
        }
        continue;
      }

      // Busca produto e verifica se pertence a um grupo
      const produtoResult = await client.query(
        `SELECT procod, proqtde, progrupcod FROM pro WHERE procod = $1 FOR UPDATE`,
        [procod]
      );

      if (produtoResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ 
          valido: false, 
          erro: `Produto não encontrado: ${item.nome || procod}` 
        });
      }

      const produto = produtoResult.rows[0];

      // Verifica se tem variações de cor (procor)
      const temCores = await client.query(
        `SELECT 1 FROM procor WHERE procorprocod = $1 LIMIT 1`,
        [procod]
      );

      if (temCores.rows.length > 0) {
        // Produto tem cores mas não foi selecionada uma cor - erro
        await client.query("ROLLBACK");
        return res.status(400).json({ 
          valido: false, 
          erro: `Selecione uma cor para o produto ${item.nome || procod}` 
        });
      }

      // Caso 1: Produto NÃO pertence a nenhum grupo
      if (produto.progrupcod === null) {
        if ((produto.proqtde || 0) < quantidade) {
          await client.query("ROLLBACK");
          return res.status(400).json({ 
            valido: false, 
            erro: `Estoque insuficiente para ${item.nome || "produto"}. Disponível: ${produto.proqtde || 0}, Solicitado: ${quantidade}` 
          });
        }
        continue;
      }

      // Busca grupo com lock
      const grupoResult = await client.query(
        `SELECT grupcod, grupdes, estoque FROM part_grups WHERE grupcod = $1 FOR UPDATE`,
        [produto.progrupcod]
      );

      if (grupoResult.rows.length === 0) {
        // Grupo não existe, comportamento como produto sem grupo
        if ((produto.proqtde || 0) < quantidade) {
          await client.query("ROLLBACK");
          return res.status(400).json({ 
            valido: false, 
            erro: `Estoque insuficiente para ${item.nome || "produto"}. Disponível: ${produto.proqtde || 0}, Solicitado: ${quantidade}` 
          });
        }
        continue;
      }

      const grupo = grupoResult.rows[0];

      // Caso 2a: Grupo TEM estoque definido
      if (grupo.estoque !== null) {
        if (grupo.estoque < quantidade) {
          await client.query("ROLLBACK");
          return res.status(400).json({ 
            valido: false, 
            erro: `Estoque do grupo "${grupo.grupdes}" insuficiente. Disponível: ${grupo.estoque}, Solicitado: ${quantidade}` 
          });
        }
        continue;
      }

      // Caso 2b: Grupo NÃO tem estoque definido - valida todas as peças do grupo
      const pecasGrupo = await client.query(
        `SELECT procod, prodes, proqtde FROM pro WHERE progrupcod = $1 FOR UPDATE`,
        [produto.progrupcod]
      );

      for (const peca of pecasGrupo.rows) {
        if ((peca.proqtde || 0) < quantidade) {
          await client.query("ROLLBACK");
          return res.status(400).json({ 
            valido: false, 
            erro: `Estoque insuficiente em uma das peças do grupo "${grupo.grupdes}". Peça "${peca.prodes}" tem apenas ${peca.proqtde || 0} unidades disponíveis.` 
          });
        }
      }
    }

    await client.query("COMMIT");
    return res.status(200).json({ valido: true });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erro na validação de estoque:", error);
    return res.status(500).json({ valido: false, erro: "Erro ao validar estoque" });
  } finally {
    client.release();
  }
};
