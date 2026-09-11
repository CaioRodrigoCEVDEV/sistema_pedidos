const pool = require("../config/db");
const {
  onlyDigits,
  validarCliente,
} = require("../utils/clienteValidacao");

const parseId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Sinal aplicado ao saldo devedor do cliente:
//   positivo -> aumenta o que o cliente deve
//   negativo -> reduz o que o cliente deve (crédito/pagamento/estorno)
const SINAL_MOVIMENTO = {
  DEBITO: 1,
  COBRANCA: 1,
  PAGAMENTO: -1,
  CREDITO: -1,
  ESTORNO: -1,
  AJUSTE: 1,
};

const TIPOS_MOVIMENTO = Object.keys(SINAL_MOVIMENTO);

// Registra uma movimentação e atualiza o saldo dentro da MESMA transação.
// O saldo nunca é sobrescrito sem o respectivo lançamento no histórico.
async function registrarMovimentacao(client, { parcod, tipo, valor, descricao, ref, usucod }) {
  const sinal = SINAL_MOVIMENTO[tipo];
  const magnit = Number(valor);
  const delta = Number((Math.abs(magnit) * sinal).toFixed(2));

  const contaResult = await client.query(
    `INSERT INTO public.cli_conta (cliparcod, contasaldo)
     VALUES ($1, 0)
     ON CONFLICT (cliparcod) DO NOTHING
     RETURNING cliparcod`,
    [parcod]
  );
  void contaResult;

  const atual = await client.query(
    `SELECT contasaldo FROM public.cli_conta WHERE cliparcod = $1 FOR UPDATE`,
    [parcod]
  );
  const saldoAnterior = Number(atual.rows[0]?.contasaldo || 0);
  const saldoNovo = Number((saldoAnterior + delta).toFixed(2));

  const mov = await client.query(
    `INSERT INTO public.cli_mov
       (movparcod, movtipo, movvalor, movsaldo, movdesc, movref, movusucod)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [parcod, tipo, delta, saldoNovo, descricao || null, ref || null, usucod || null]
  );

  await client.query(
    `UPDATE public.cli_conta
     SET contasaldo = $1, contadtua = now()
     WHERE cliparcod = $2`,
    [saldoNovo, parcod]
  );

  return mov.rows[0];
}

// CREATE: insere em par + cli + cli_conta (transação)
exports.create = async (req, res) => {
  const { ok, errors, data } = validarCliente(req.body || {});
  if (!ok) return res.status(400).json({ error: errors.join(" ") });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertPar = `
      INSERT INTO public.par
        (parcnpjcpf, parierg, pardes, parfan, parrua, parbai, parmuncod, parcep, parfone, paremail, parsit)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`;
    const { rows: r1 } = await client.query(insertPar, [
      data.parcnpjcpf,
      data.parierg ?? null,
      data.pardes,
      data.parfan ?? null,
      data.parrua ?? null,
      data.parbai ?? null,
      data.parmuncod ?? null,
      data.parcep ?? null,
      data.parfone,
      data.paremail ?? null,
      data.parsit ?? "A",
    ]);
    const par = r1[0];

    await client.query(
      `INSERT INTO public.cli (cliparcod, clibloq, clilim) VALUES ($1, false, 0)`,
      [par.parcod]
    );
    await client.query(
      `INSERT INTO public.cli_conta (cliparcod, contasaldo) VALUES ($1, 0)`,
      [par.parcod]
    );

    await client.query("COMMIT");
    return res.status(201).json({ ...par, clibloq: false, clilim: 0, contasaldo: 0 });
  } catch (e) {
    await client.query("ROLLBACK");
    if (e.code === "23505") return res.status(409).json({ error: "CPF/CNPJ já cadastrado." });
    if (e.code === "23503") return res.status(400).json({ error: "Município inválido." });
    console.error(e);
    return res.status(500).json({ error: "Erro ao criar cliente." });
  } finally {
    client.release();
  }
};

// LIST: paginação + busca por nome/fantasia/doc/telefone
exports.list = async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 200);
  const q = (req.query.q || "").trim();
  const off = (page - 1) * pageSize;

  const params = [];
  let where = "";
  if (q) {
    const like = `%${q}%`;
    params.push(like, like);
    const doc = onlyDigits(q);
    params.push(doc ? doc : null);
    const phone = onlyDigits(q);
    params.push(phone ? `%${phone}%` : null);
    where = `WHERE (
      p.pardes ILIKE $1 OR
      COALESCE(p.parfan, '') ILIKE $2 OR
      ($3::text IS NOT NULL AND p.parcnpjcpf = $3) OR
      ($4::text IS NOT NULL AND regexp_replace(COALESCE(p.parfone, ''), '\\D', '', 'g') LIKE $4)
    )`;
  }

  const base = `
    FROM public.par p
    JOIN public.cli c ON c.cliparcod = p.parcod
    LEFT JOIN public.cli_conta ct ON ct.cliparcod = p.parcod
    LEFT JOIN public.mun m ON m.muncod = p.parmuncod
    LEFT JOIN public.uf u  ON u.ufsigla = m.munufsigla
  `;

  try {
    const countSql = `SELECT COUNT(*) ${base} ${where}`;
    const { rows: rc } = await pool.query(countSql, params);
    const total = parseInt(rc[0].count, 10);

    const dataSql = `
      SELECT p.parcod, p.pardes, p.parfan, p.parcnpjcpf, p.parrua, p.parbai, p.parcep, p.parfone, p.paremail,
             p.parmuncod, m.mundes, u.ufsigla,
             c.clibloq, c.clilim, COALESCE(ct.contasaldo, 0) AS contasaldo,
             COALESCE((SELECT SUM(cb.cobvalor) FROM public.cli_cobranca cb
                       WHERE cb.cobparcod = p.parcod AND cb.cobsta = 'A'), 0) AS em_aberto,
             p.pardcad, p.pardua, p.parsit,
             (SELECT COUNT(*) FROM public.pv
               WHERE pv.pvparcod = p.parcod AND COALESCE(pv.pvsta, 'A') <> 'X') AS pedidos_vinculados
      ${base} ${where}
      ORDER BY p.pardes ASC
      LIMIT ${pageSize} OFFSET ${off}`;
    const { rows } = await pool.query(dataSql, params);

    return res.json({ page, pageSize, total, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao listar clientes." });
  }
};

// GET by ID
exports.getById = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "id inválido" });

  const sql = `
    SELECT p.parcod, p.pardes, p.parfan, p.parcnpjcpf, p.parrua, p.parbai, p.parcep, p.parfone, p.paremail,
           p.parierg, p.parmuncod, m.mundes, u.ufsigla,
           c.clibloq, c.clilim, COALESCE(ct.contasaldo, 0) AS contasaldo,
           p.pardcad, p.pardua, p.parsit
    FROM public.par p
    JOIN public.cli c ON c.cliparcod = p.parcod
    LEFT JOIN public.cli_conta ct ON ct.cliparcod = p.parcod
    LEFT JOIN public.mun m ON m.muncod = p.parmuncod
    LEFT JOIN public.uf u  ON u.ufsigla = m.munufsigla
    WHERE p.parcod = $1
  `;
  try {
    const { rows } = await pool.query(sql, [id]);
    if (!rows.length) return res.status(404).json({ error: "Cliente não encontrado." });
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao buscar cliente." });
  }
};

// UPDATE: atualiza PAR/CLI (campos legados clibloq/clilim continuam aceitos)
exports.update = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "id inválido" });

  const { ok, errors, data } = validarCliente(req.body || {}, { partial: true });
  if (!ok) return res.status(400).json({ error: errors.join(" ") });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const fields = [];
    const values = [];
    const push = (col, val) => {
      values.push(val);
      fields.push(`${col} = $${values.length}`);
    };

    for (const [col, val] of Object.entries({
      parcnpjcpf: data.parcnpjcpf,
      parierg: data.parierg,
      pardes: data.pardes,
      parfan: data.parfan,
      parrua: data.parrua,
      parbai: data.parbai,
      parmuncod: data.parmuncod,
      parcep: data.parcep,
      parfone: data.parfone,
      paremail: data.paremail,
      parsit: data.parsit,
    })) {
      if (Object.prototype.hasOwnProperty.call(data, col)) push(col, val);
    }

    if (fields.length) {
      fields.push(`pardua = now()`);
      values.push(id);
      await client.query(
        `UPDATE public.par SET ${fields.join(", ")} WHERE parcod = $${values.length}`,
        values
      );
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "clibloq")) {
      await client.query(`UPDATE public.cli SET clibloq = $1 WHERE cliparcod = $2`, [
        !!req.body.clibloq,
        id,
      ]);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "clilim")) {
      await client.query(`UPDATE public.cli SET clilim = $1 WHERE cliparcod = $2`, [
        Number(req.body.clilim) || 0,
        id,
      ]);
    }

    await client.query("COMMIT");
    return exports.getById(req, res);
  } catch (e) {
    await client.query("ROLLBACK");
    if (e.code === "23505") return res.status(409).json({ error: "CPF/CNPJ já cadastrado." });
    if (e.code === "23503") return res.status(400).json({ error: "Município inválido." });
    console.error(e);
    return res.status(500).json({ error: "Erro ao atualizar cliente." });
  } finally {
    client.release();
  }
};

// DELETE: inativa (soft delete). ?hard=1 remove definitivamente se não houver vínculos.
exports.remove = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "id inválido" });

  const hard = req.query.hard === "1" || req.query.hard === "true";

  try {
    if (!hard) {
      const { rowCount } = await pool.query(
        `UPDATE public.par SET parsit = 'I', pardua = now() WHERE parcod = $1`,
        [id]
      );
      if (!rowCount) return res.status(404).json({ error: "Cliente não encontrado." });
      return res.json({ ok: true, inativado: true });
    }

    const vinculos = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM public.pv WHERE pvparcod = $1) AS pedidos,
         (SELECT COUNT(*) FROM public.cli_mov WHERE movparcod = $1) AS movimentacoes,
         (SELECT COUNT(*) FROM public.cli_cobranca WHERE cobparcod = $1) AS cobrancas`,
      [id]
    );
    const v = vinculos.rows[0];
    if (Number(v.pedidos) || Number(v.movimentacoes) || Number(v.cobrancas)) {
      return res.status(409).json({
        error: "Cliente possui vínculos (pedidos, movimentações ou cobranças). Inative em vez de excluir.",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM public.cli_mov WHERE movparcod = $1`, [id]);
      await client.query(`DELETE FROM public.cli WHERE cliparcod = $1`, [id]);
      await client.query(`DELETE FROM public.par WHERE parcod = $1`, [id]);
      await client.query("COMMIT");
      return res.json({ ok: true, excluido: true });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    if (e.code === "23503") {
      return res.status(409).json({ error: "Cliente possui vínculos e não pode ser removido." });
    }
    console.error(e);
    return res.status(500).json({ error: "Erro ao remover cliente." });
  }
};

// ---------------------------------------------------------------------------
// Pedidos vinculados
// ---------------------------------------------------------------------------

exports.listarPedidosCliente = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "id inválido" });

  try {
    const { rows } = await pool.query(
      `SELECT pv.pvcod, pv.pvdtcad, pv.pvcanal, pv.pvsta, pv.pvconfirmado,
              COALESCE(pv.pvvl, 0) AS pvvl,
              COALESCE(SUM(COALESCE(i.pviqtde, 0) * COALESCE(i.pvivl, 0)), 0) AS total_itens
       FROM public.pv
       LEFT JOIN public.pvi i ON i.pvipvcod = pv.pvcod
       WHERE pv.pvparcod = $1
       GROUP BY pv.pvcod
       ORDER BY pv.pvcod DESC`,
      [id]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao listar pedidos do cliente." });
  }
};

exports.listarPedidosDisponiveis = async (req, res) => {
  const q = (req.query.q || "").trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  try {
    const params = [];
    let filtro = "";
    if (q) {
      const like = `%${q}%`;
      params.push(like);
      params.push(onlyDigits(q) || null);
      filtro = `AND (
        COALESCE(pv.pvobs, '') ILIKE $1 OR
        ($2::text IS NOT NULL AND pv.pvcod = $2::int)
      )`;
    }
    params.push(limit);
    const { rows } = await pool.query(
      `SELECT pv.pvcod, pv.pvdtcad, pv.pvcanal, pv.pvconfirmado, pv.pvsta,
              COALESCE(pv.pvvl, 0) AS pvvl
       FROM public.pv
       WHERE pv.pvparcod IS NULL
         ${filtro}
       ORDER BY pv.pvcod DESC
       LIMIT $${params.length}`,
      params
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao listar pedidos disponíveis." });
  }
};

exports.vincularPedido = async (req, res) => {
  const id = parseId(req.params.id);
  const pvcod = parseId(req.params.pvcod);
  if (!id || !pvcod) return res.status(400).json({ error: "Parâmetros inválidos." });

  try {
    const pedido = await pool.query(`SELECT pvparcod FROM public.pv WHERE pvcod = $1`, [pvcod]);
    if (!pedido.rows.length) return res.status(404).json({ error: "Pedido não encontrado." });
    if (pedido.rows[0].pvparcod && Number(pedido.rows[0].pvparcod) !== id) {
      return res.status(409).json({ error: "Pedido já vinculado a outro cliente." });
    }

    const { rows } = await pool.query(
      `UPDATE public.pv SET pvparcod = $1 WHERE pvcod = $2 RETURNING pvcod, pvparcod`,
      [id, pvcod]
    );
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao vincular pedido." });
  }
};

exports.desvincularPedido = async (req, res) => {
  const id = parseId(req.params.id);
  const pvcod = parseId(req.params.pvcod);
  if (!id || !pvcod) return res.status(400).json({ error: "Parâmetros inválidos." });

  try {
    const { rowCount } = await pool.query(
      `UPDATE public.pv SET pvparcod = NULL WHERE pvcod = $1 AND pvparcod = $2`,
      [pvcod, id]
    );
    if (!rowCount) return res.status(404).json({ error: "Vínculo não encontrado." });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao desvincular pedido." });
  }
};

// ---------------------------------------------------------------------------
// Conta do cliente
// ---------------------------------------------------------------------------

exports.resumoConta = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "id inválido" });

  try {
    // Crédito é o saldo do extrato do cliente. Lançamentos gerados por
    // cobranças (ref "COB:*") NÃO entram aqui para não compensar crédito
    // com cobrança automaticamente.
    const creditoMov = await pool.query(
      `SELECT COALESCE(SUM(movvalor), 0) AS saldo
       FROM public.cli_mov
       WHERE movparcod = $1
         AND COALESCE(movref, '') NOT LIKE 'COB:%'`,
      [id]
    );
    const saldoCredito = Number(creditoMov.rows[0]?.saldo || 0);

    const conta = await pool.query(
      `SELECT contadtua FROM public.cli_conta WHERE cliparcod = $1`,
      [id]
    );
    const pedidos = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(COALESCE(pvvl, 0)), 0) AS valor
       FROM public.pv
       WHERE pvparcod = $1 AND COALESCE(pvsta, 'A') <> 'X'`,
      [id]
    );
    const cobrancas = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE cobsta = 'A')::int AS abertas,
         COALESCE(SUM(cobvalor) FILTER (WHERE cobsta = 'A'), 0) AS valor_aberto
       FROM public.cli_cobranca WHERE cobparcod = $1`,
      [id]
    );

    const emAberto = Number(cobrancas.rows[0]?.valor_aberto || 0);

    return res.json({
      // "Em aberto" = cobranças pendentes, auditável na aba Cobranças.
      em_aberto: emAberto,
      cobrancas_abertas: cobrancas.rows[0]?.abertas || 0,
      // "Crédito" = saldo a favor, independente das cobranças.
      credito: Math.max(-saldoCredito, 0),
      saldo_conta: saldoCredito,
      contadtua: conta.rows[0]?.contadtua || null,
      pedidos_vinculados: pedidos.rows[0]?.total || 0,
      valor_pedidos: Number(pedidos.rows[0]?.valor || 0),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao carregar conta do cliente." });
  }
};

exports.listarMovimentacoes = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "id inválido" });
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);

  try {
    // Extrato de crédito: cobranças têm sua própria aba, então lançamentos
    // gerados por elas não aparecem aqui.
    const { rows } = await pool.query(
      `SELECT movcod, movtipo, movvalor, movsaldo, movdesc, movref, movdtcad
       FROM public.cli_mov
       WHERE movparcod = $1
         AND COALESCE(movref, '') NOT LIKE 'COB:%'
       ORDER BY movcod DESC
       LIMIT $2`,
      [id, limit]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao listar movimentações." });
  }
};

// Lançamento manual. tipo define o efeito no saldo de crédito do extrato.
exports.criarMovimentacao = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "id inválido" });

  const { tipo, valor, descricao, ref } = req.body || {};
  if (!TIPOS_MOVIMENTO.includes(tipo)) {
    return res.status(400).json({ error: `Tipo inválido. Use: ${TIPOS_MOVIMENTO.join(", ")}.` });
  }
  const num = Number(valor);
  if (!Number.isFinite(num) || num === 0) {
    return res.status(400).json({ error: "Valor inválido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const mov = await registrarMovimentacao(client, {
      parcod: id,
      tipo,
      valor: num,
      descricao,
      ref,
      usucod: req.token?.usucod,
    });
    await client.query("COMMIT");
    return res.status(201).json(mov);
  } catch (e) {
    await client.query("ROLLBACK");
    if (e.code === "23503") return res.status(404).json({ error: "Cliente não encontrado." });
    console.error(e);
    return res.status(500).json({ error: "Erro ao registrar movimentação." });
  } finally {
    client.release();
  }
};

// ---------------------------------------------------------------------------
// Cobranças
// ---------------------------------------------------------------------------

exports.listarCobrancas = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "id inválido" });

  try {
    const { rows } = await pool.query(
      `SELECT c.cobcod, c.cobpvcod, c.cobvalor, c.cobvenc, c.cobsta,
              c.cobobs, c.cobdtcad, c.cobdtpg
       FROM public.cli_cobranca c
       WHERE c.cobparcod = $1
       ORDER BY c.cobsta = 'A' DESC, c.cobcod DESC`,
      [id]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao listar cobranças." });
  }
};

exports.criarCobranca = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "id inválido" });

  const { cobpvcod, cobvalor, cobvenc, cobobs } = req.body || {};
  const valor = Number(cobvalor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return res.status(400).json({ error: "Valor da cobrança inválido." });
  }
  const pvcod = parseId(cobpvcod);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Cobrança é um título a receber: altera o "Em aberto", mas NÃO o
    // crédito do cliente (sem compensação automática).
    const insert = await client.query(
      `INSERT INTO public.cli_cobranca
         (cobparcod, cobpvcod, cobvalor, cobvenc, cobobs, cobusucod)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [id, pvcod, valor, cobvenc || null, cobobs || null, req.token?.usucod || null]
    );

    await client.query("COMMIT");
    return res.status(201).json(insert.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    if (e.code === "23503") return res.status(400).json({ error: "Cliente ou pedido inválido." });
    console.error(e);
    return res.status(500).json({ error: "Erro ao criar cobrança." });
  } finally {
    client.release();
  }
};

async function carregarCobranca(client, id, cobcod) {
  const { rows } = await client.query(
    `SELECT * FROM public.cli_cobranca WHERE cobcod = $1 AND cobparcod = $2 FOR UPDATE`,
    [cobcod, id]
  );
  return rows[0] || null;
}

exports.baixarCobranca = async (req, res) => {
  const id = parseId(req.params.id);
  const cobcod = parseId(req.params.cobcod);
  if (!id || !cobcod) return res.status(400).json({ error: "Parâmetros inválidos." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cobranca = await carregarCobranca(client, id, cobcod);
    if (!cobranca) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Cobrança não encontrada." });
    }
    if (cobranca.cobsta !== "A") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Cobrança não está aberta." });
    }

    await client.query(
      `UPDATE public.cli_cobranca
       SET cobsta = 'P', cobdtpg = now()
       WHERE cobcod = $1`,
      [cobcod]
    );

    await client.query("COMMIT");
    return res.json({ ok: true, cobcod, cobsta: "P" });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return res.status(500).json({ error: "Erro ao baixar cobrança." });
  } finally {
    client.release();
  }
};

exports.cancelarCobranca = async (req, res) => {
  const id = parseId(req.params.id);
  const cobcod = parseId(req.params.cobcod);
  if (!id || !cobcod) return res.status(400).json({ error: "Parâmetros inválidos." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cobranca = await carregarCobranca(client, id, cobcod);
    if (!cobranca) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Cobrança não encontrada." });
    }
    if (cobranca.cobsta !== "A") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Somente cobranças abertas podem ser canceladas.",
      });
    }

    await client.query(`UPDATE public.cli_cobranca SET cobsta = 'C' WHERE cobcod = $1`, [cobcod]);

    await client.query("COMMIT");
    return res.json({ ok: true, cobcod, cobsta: "C" });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return res.status(500).json({ error: "Erro ao cancelar cobrança." });
  } finally {
    client.release();
  }
};
