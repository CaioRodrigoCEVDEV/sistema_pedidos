const pool = require("../config/db");

exports.sequencia = async (req, res) => {
  try {
    const result = await pool.query("SELECT nextval('pv_seq')");
    res.status(200).json({ nextval: result.rows[0].nextval });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao gerar sequência" });
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
      console.log("Inserindo item:", { pvcod, codigoInteiro, qt, preco,pviprocorid });

      const result = await pool.query(
        "INSERT INTO pvi (pvipvcod, pviprocod, pviqtde, pvivl,pviprocorid) VALUES ($1, $2, $3, $4,$5) RETURNING *",
        [pvcod, codigoInteiro, qt, preco,pviprocorid]
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
      [ usuadm,usucod,dataInicio, dataFim]
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
      [ usuadm,usucod,dataInicio, dataFim]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro buscar pedidos" });
  }
};

exports.confirmarPedido = async (req, res) => {
  const pvcod = req.params.pvcod;

  console.log(pvcod);

  try {
    const result = await pool.query(
      "update pv set pvconfirmado = 'S' where pvcod = $1 RETURNING *",
      [pvcod]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "erro ao confirmar pedido" });
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
