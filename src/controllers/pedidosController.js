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
  const { pvcod, total, obs, canal, status, confirmado } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO pv (pvcod, pvvl, pvobs, pvcanal, pvsta, pvconfirmado) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [pvcod, total, obs, canal, status, confirmado]
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
      const { id: procod, qt, preco } = item;
      const codigoInteiro = parseInt(procod.split("-")[0]);
      console.log("Inserindo item:", { pvcod, codigoInteiro, qt, preco });

      const result = await pool.query(
        "INSERT INTO pvi (pvipvcod, pviprocod, pviqtde, pvivl) VALUES ($1, $2, $3, $4) RETURNING *",
        [pvcod, codigoInteiro, qt, preco]
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
  try {
    const result = await pool.query(
      "select * from pv where pvconfirmado = 'N' and pvsta = 'A' order by pvcod desc"
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro buscar pedidos" });
  }
};

exports.listarPvPendentes = async (req, res) => {
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
  try {
    const result = await pool.query(
      "select * from pv where pvconfirmado = 'S' and pvsta = 'A' order by pvcod desc"
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
