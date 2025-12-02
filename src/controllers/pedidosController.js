const pool = require("../config/db");
const partGroupModels = require("../models/partGroupModels");
const stockService = require("../services/stock");

exports.sequencia = async (req, res) => {
  try {
    const result = await pool.query("SELECT nextval('pv_seq')");
    res.status(200).json({ nextval: result.rows[0].nextval });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao gerar sequência" });
  }
};

/**
 * Middleware que valida o carrinho antes de criar o pedido.
 * 
 * IMPORTANTE: O estoque NÃO é movimentado neste momento.
 * A movimentação de estoque ocorre SOMENTE na confirmação do pedido
 * (ver função confirmarPedido).
 * 
 * Esta função apenas:
 * - Valida que o carrinho não está vazio
 * - Valida que os IDs das peças são válidos
 * - Passa o controle para a criação do pedido com status pendente
 */
exports.validarEDecrementarEstoque = async (req, res, next) => {
  const { cart } = req.body;

  if (!Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: "Carrinho vazio ou inválido" });
  }

  try {
    // Valida os itens do carrinho (sem movimentar estoque)
    for (const item of cart) {
      const procod = item.id;
      // O ID pode vir no formato "123-cor" ou apenas "123"
      const codigoInteiro = parseInt(String(procod).split("-")[0], 10);
      const quantidade = parseInt(item.qt, 10) || 1;

      // Valida que o ID da peça é um número válido
      if (isNaN(codigoInteiro) || codigoInteiro <= 0) {
        return res.status(400).json({
          error: `ID de peça inválido: ${procod}`,
          tipo: "item_invalido",
        });
      }

      // Valida que a quantidade é válida
      if (quantidade <= 0) {
        return res.status(400).json({
          error: `Quantidade inválida para peça ${procod}`,
          tipo: "quantidade_invalida",
        });
      }
    }

    console.log(
      `[Pedidos] Carrinho validado com sucesso. Itens: ${cart.length}. ` +
      `Estoque será movimentado apenas na confirmação do pedido.`
    );

    // Continua para a criação do pedido (com status pendente)
    next();
  } catch (error) {
    console.error("[Pedidos] Erro ao validar carrinho:", error);

    return res.status(400).json({
      error: "Erro ao validar carrinho. Por favor, tente novamente.",
      tipo: "erro_validacao",
    });
  }
};

exports.inserirPv = async (req, res, next) => {
  const { pvcod, total, obs, canal, status, confirmado, codigoVendedor } =
    req.body;

  try {
    const result = await pool.query(
      "INSERT INTO pv (pvcod, pvvl, pvobs, pvcanal, pvsta, pvconfirmado, pvrcacod) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [pvcod, total, obs, canal, status, confirmado, codigoVendedor]
    );

    // guarda o pvcod e o total para o próximo passo
    req.pvcod = pvcod;
    req.cart = req.body.cart;

    next(); // 👈 vai para inserirPvi
  } catch (error) {
    console.error("Erro ao inserir pedido:", error);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
};

exports.inserirPvi = async (req, res) => {
  const { pvcod, cart } = req.body;

  if (!Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: "Carrinho vazio ou inválido" });
  }

  try {
    const results = [];

    for (const item of cart) {
      const { id: procod, qt, preco, idCorSelecionada } = item;
      const pviprocorid = idCorSelecionada || null;
      const codigoInteiro = parseInt(procod.split("-")[0]);
      console.log("Inserindo item:", {
        pvcod,
        codigoInteiro,
        qt,
        preco,
        pviprocorid,
      });

      const result = await pool.query(
        "INSERT INTO pvi (pvipvcod, pviprocod, pviqtde, pvivl,pviprocorid) VALUES ($1, $2, $3, $4,$5) RETURNING *",
        [pvcod, codigoInteiro, qt, preco, pviprocorid]
      );

      results.push(result.rows[0]);
    }

    res.status(200).json({
      message: "Pedido e itens inseridos com sucesso!",
      pvcod,
      itens: results,
    });
  } catch (error) {
    console.error("Erro ao inserir itens:", error);
    res.status(500).json({ error: "Erro ao inserir itens do pedido" });
  }
};

exports.listarPv = async (req, res) => {
  const usucod = req.token.usucod;
  try {
    const result = await pool.query(
      `       
        select 
            pvcod,
            pvvl,
            pvobs,
            pvcanal,
            pvconfirmado,
            pvsta,
            pvipvcod,
            pvrcacod,
            sum(pvivl) as pvvltotal,
            usunome
            from pv 
            left join pvi on pvipvcod = pvcod
            left join usu on usucod = pvrcacod
            where pvconfirmado = 'N' 
            and (pvrcacod = $1 or pvrcacod is null )
            and pvsta = 'A' 
            and pviprocod is not null 
            group by 
            pvcod,
            pvvl,
            pvobs,
            pvcanal,
            pvconfirmado,
            pvsta,
            pvipvcod,
            usunome
            order by pvcod desc`,
      [usucod]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro buscar pedidos" });
  }
};

exports.listarPvPendentesCount = async (req, res) => {
  try {
    const result = await pool.query(
      "select count(*) from pv where pvconfirmado = 'N' and pvsta = 'A' "
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro buscar pedidos" });
  }
};

exports.listarPvPendentesCountNow = async (req, res) => {
  try {
    const result = await pool.query(
      "select count(*) from pv where pvconfirmado = 'N' and pvsta = 'A' and pvdtcad = 'now()'"
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro buscar pedidos hoje" });
  }
};

exports.listarPvBalcao = async (req, res) => {
  try {
    const result = await pool.query(
      "select count(*) from pv where pvcanal = 'BALCAO' and pvsta = 'A' "
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro buscar pedidos" });
  }
};

exports.listarPvEntregaNow = async (req, res) => {
  try {
    const result = await pool.query(
      "select count(*) from pv where pvcanal = 'ENTREGA' and pvsta = 'A' and pvdtcad = 'now()'"
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro buscar pedidos" });
  }
};


exports.listarPvBalcaoNow = async (req, res) => {
  try {
    const result = await pool.query(
      "select count(*) from pv where pvcanal = 'BALCAO' and pvsta = 'A' and pvdtcad = 'now()'"
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro buscar pedidos" });
  }
};

exports.listarPvEntrega = async (req, res) => {
  try {
    const result = await pool.query(
      "select count(*) from pv where pvcanal = 'ENTREGA' and pvsta = 'A' "
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro buscar pedidos" });
  }
};

exports.listarTotalPvConfirmados = async (req, res) => {
  try {
    const result = await pool.query(
      "select count(*) from pv where pvconfirmado = 'S' and pvsta = 'A' "
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro buscar pedidos" });
  }
};

exports.listarTotalPvConfirmadosNow = async (req, res) => {
  try {
    const result = await pool.query(
      "select count(*) from pv where pvconfirmado = 'S' and pvsta = 'A' and pvdtcad = 'now()'"
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro buscar pedidos" });
  }
};

exports.listarPvConfirmados = async (req, res) => {
  const usucod = req.token.usucod;
  const usuadm = req.token.usuadm;
  let { dataInicio, dataFim } = req.query || {};

  if (!dataInicio) dataInicio = "1900-01-01";
  if (!dataFim) dataFim = "2999-12-31";

  try {
    const result = await pool.query(
      ` SELECT 
        pv.pvcod,
        pv.pvvl,
        pv.pvobs,
        pv.pvcanal,
        pv.pvconfirmado,
        pv.pvsta,
        pvipvcod,
        pv.pvrcacod,
        SUM(pvi.pvivl) AS pvvltotal,
        usu.usunome
    FROM pv
    LEFT JOIN pvi ON pvipvcod = pvcod
    LEFT JOIN usu ON usu.usucod = pv.pvrcacod
    WHERE pv.pvconfirmado = 'S'
    AND (
          -- se for admin, vê tudo
          ($1 = 'S')
          -- caso contrário, só vê registros do usuário ou NULL
          OR (pv.pvrcacod = $2 OR pv.pvrcacod IS NULL)
        )
    AND pv.pvsta = 'A'
    AND pviprocod IS NOT NULL
    AND pv.pvdtcad BETWEEN $3 AND $4
    GROUP BY 
    pv.pvcod,
    pv.pvvl,
    pv.pvobs,
    pv.pvcanal,
    pv.pvconfirmado,
    pv.pvsta,
    pvipvcod,
    pv.pvrcacod,
    usu.usunome
    ORDER BY pv.pvcod DESC;
      
        `,
      [usuadm, usucod, dataInicio, dataFim]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro buscar pedidos" });
  }
};

exports.listarPvPendentes = async (req, res) => {
  const usucod = req.token.usucod;
  const usuadm = req.token.usuadm;
  let { dataInicio, dataFim } = req.query || {};

  if (!dataInicio) dataInicio = "1900-01-01";
  if (!dataFim) dataFim = "2999-12-31";

  try {
    const result = await pool.query(
      ` SELECT 
        pv.pvcod,
        pv.pvvl,
        pv.pvobs,
        pv.pvcanal,
        pv.pvconfirmado,
        pv.pvsta,
        pvipvcod,
        pv.pvrcacod,
        SUM(pvi.pvivl) AS pvvltotal,
        usu.usunome
    FROM pv
    LEFT JOIN pvi ON pvipvcod = pvcod
    LEFT JOIN usu ON usu.usucod = pv.pvrcacod
    WHERE pv.pvconfirmado = 'N'
    AND (
          -- se for admin, vê tudo
          ($1 = 'S')
          -- caso contrário, só vê registros do usuário ou NULL
          OR (pv.pvrcacod = $2 OR pv.pvrcacod IS NULL)
        )
    AND pv.pvsta = 'A'
    AND pviprocod IS NOT NULL
    AND pv.pvdtcad BETWEEN $3 AND $4
    GROUP BY 
    pv.pvcod,
    pv.pvvl,
    pv.pvobs,
    pv.pvcanal,
    pv.pvconfirmado,
    pv.pvsta,
    pvipvcod,
    pv.pvrcacod,
    usu.usunome
    ORDER BY pv.pvcod DESC;
      
        `,
      [usuadm, usucod, dataInicio, dataFim]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro buscar pedidos" });
  }
};

/**
 * Confirma um pedido e movimenta o estoque.
 * 
 * IMPORTANTE: Esta é a ÚNICA função onde o estoque é movimentado.
 * O fluxo é:
 * 1. Abre uma transação
 * 2. Carrega os itens do pedido (pvi)
 * 3. Consome o estoque usando stockService.consumirEstoqueParaPedido
 * 4. Marca o pedido como confirmado (pvconfirmado = 'S', pvdtconfirmado = NOW())
 * 5. Commit da transação
 * 6. APÓS o commit, envia resposta de sucesso (WhatsApp/notificações ocorrem no frontend)
 * 
 * Em caso de erro (ex: estoque insuficiente), faz rollback e retorna erro.
 */
exports.confirmarPedido = async (req, res) => {
  const pvcod = req.params.pvcod;
  const pvrcacod = req.body.pvrcacod;

  console.log(`[Pedidos] Confirmando pedido ${pvcod}...`);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Verifica se o pedido existe e não está confirmado
    const pedidoResult = await client.query(
      `SELECT pvcod, pvconfirmado, pvsta 
       FROM pv 
       WHERE pvcod = $1 
       FOR UPDATE`,
      [pvcod]
    );

    if (pedidoResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    const pedido = pedidoResult.rows[0];

    if (pedido.pvconfirmado === "S") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Pedido já está confirmado" });
    }

    if (pedido.pvsta === "X") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Pedido está cancelado" });
    }

    // 2. Carrega os itens do pedido
    const itensResult = await client.query(
      `SELECT pviprocod as procod, pviqtde as quantidade 
       FROM pvi 
       WHERE pvipvcod = $1 AND pviqtde > 0`,
      [pvcod]
    );

    if (itensResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Pedido não possui itens válidos" });
    }

    // 3. Prepara lista de itens para consumo de estoque
    const itensParaConsumo = itensResult.rows.map(item => ({
      partId: item.procod,
      quantidade: item.quantidade
    }));

    console.log(`[Pedidos] Consumindo estoque para ${itensParaConsumo.length} itens do pedido ${pvcod}`);

    // 4. Consome o estoque usando o serviço de estoque (passando o client externo)
    await stockService.consumirEstoqueParaPedido(
      itensParaConsumo,
      "sale",
      String(pvcod),
      client  // Passa o client externo para usar a mesma transação
    );

    // 5. Marca o pedido como confirmado
    const updateResult = await client.query(
      `UPDATE pv 
       SET pvconfirmado = 'S', pvrcacod = $2, pvdtconfirmado = NOW()
       WHERE pvcod = $1 
       RETURNING *`,
      [pvcod, pvrcacod]
    );

    // 6. Commit da transação
    await client.query("COMMIT");

    console.log(`[Pedidos] Pedido ${pvcod} confirmado com sucesso!`);

    res.status(200).json({
      success: true,
      message: "Pedido confirmado com sucesso!",
      pedido: updateResult.rows[0],
      itensProcessados: itensParaConsumo.length
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`[Pedidos] Erro ao confirmar pedido ${pvcod}:`, error);

    // Retorna erro amigável para o frontend
    const mensagemErro = error.message.includes("insuficiente")
      ? error.message
      : "Erro ao confirmar pedido. Por favor, tente novamente.";

    res.status(400).json({ 
      error: mensagemErro,
      tipo: error.message.includes("insuficiente") ? "estoque_insuficiente" : "erro_confirmacao"
    });
  } finally {
    client.release();
  }
};

exports.cancelarPedido = async (req, res) => {
  const pvcod = req.params.pvcod;

  console.log(pvcod);

  try {
    const result = await pool.query(
      "update pv set pvsta = 'X' where pvcod = $1 RETURNING *",
      [pvcod]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "erro ao cancelar pedido" });
  }
};

exports.listarPedidosPendentesDetalhe = async (req, res) => {
  const pvcod = req.params.pvcod;

  try {
    const result = await pool.query(
      `select 
       pvcod,
       prodes,
       pvvl,
       pviprocod,
       pvivl,
       pviqtde,
       pvobs
       from pv
       join pvi on pvipvcod = pvcod
       join pro on procod = pviprocod
       where pvcod = $1 and pvsta = 'A'`,
      [pvcod]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro buscar pedidos pendentes" });
  }
};

exports.cancelarItemPv = async (req, res) => {
  const { procod } = req.body;
  const pvcod = req.params.pvcod;

  try {
    const result = await pool.query(
      "update pvi set pviqtde = 0 where pviprocod = $1 and pvipvcod = $2 RETURNING *",
      [procod, pvcod]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "erro ao cancelar pedido" });
  }
};

exports.confirmarItemPv = async (req, res) => {
  const { procod, pviqtde } = req.body;
  const pvcod = req.params.pvcod;

  console.log({ procod, pviqtde, pvcod });

  try {
    const result = await pool.query(
      "update pvi set pviqtde = $1 where pviprocod = $2 and pvipvcod = $3 RETURNING *",
      [pviqtde, procod, pvcod]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "erro ao confirmar itens pedidos pedido" });
  }
};
