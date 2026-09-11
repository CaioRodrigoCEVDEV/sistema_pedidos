const pool = require("../config/db");
const catalogoCache = require("../utils/catalogoCache");

function parsePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeColor(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    String(value).toLowerCase() === "null"
  ) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : NaN;
}

exports.buscarItensVendidos = async (req, res) => {
  const q = String(req.query.q || "").trim();
  const dataInicio = String(req.query.dataInicio || "").trim();
  const dataFim = String(req.query.dataFim || "").trim();
  const params = [];
  const filters = [];

  if (q) {
    params.push(`%${q}%`);
    filters.push(`(
      CAST(v.pvipvcod AS TEXT) ILIKE $${params.length}
      OR CAST(v.pviprocod AS TEXT) ILIKE $${params.length}
      OR p.prodes ILIKE $${params.length}
      OR COALESCE(c.cornome, 'Sem cor') ILIKE $${params.length}
    )`);
  }
  if (dataInicio) {
    params.push(dataInicio);
    filters.push(`pv.pvdtcad >= $${params.length}::DATE`);
  }
  if (dataFim) {
    params.push(dataFim);
    filters.push(`pv.pvdtcad <= $${params.length}::DATE`);
  }

  params.push(100);
  const where = filters.length ? `AND ${filters.join(" AND ")}` : "";

  try {
    const result = await pool.query(
      `WITH vendidos AS (
         SELECT i.pvipvcod, i.pviprocod, i.pviprocorid,
                SUM(COALESCE(i.pviqtde, 0))::INTEGER AS quantidade_vendida,
                MAX(COALESCE(i.pvivl, 0)) AS valor_unitario
         FROM pvi i
         GROUP BY i.pvipvcod, i.pviprocod, i.pviprocorid
       ), devolvidos AS (
         SELECT d.devpvcod, di.deviprocod, di.deviprocorid,
                SUM(di.deviqtde)::INTEGER AS quantidade_devolvida
         FROM devolucoes d
         JOIN devolucao_itens di ON di.devidevcod = d.devcod
         WHERE d.devsta = 'A'
         GROUP BY d.devpvcod, di.deviprocod, di.deviprocorid
       )
       SELECT v.pvipvcod AS pvcod,
              pv.pvdtcad,
              pv.pvcanal,
              COALESCE(u.usunome, 'Sem vendedor') AS vendedor,
              v.pviprocod AS procod,
              p.prodes,
              v.pviprocorid,
              COALESCE(c.cornome, 'Sem cor') AS cornome,
              v.valor_unitario,
              v.quantidade_vendida,
              COALESCE(d.quantidade_devolvida, 0) AS quantidade_devolvida,
              (v.quantidade_vendida - COALESCE(d.quantidade_devolvida, 0))::INTEGER
                AS quantidade_disponivel
       FROM vendidos v
       JOIN pv ON pv.pvcod = v.pvipvcod
       JOIN pro p ON p.procod = v.pviprocod
       LEFT JOIN cores c ON c.corcod = v.pviprocorid
       LEFT JOIN usu u ON u.usucod = pv.pvrcacod
       LEFT JOIN devolvidos d
         ON d.devpvcod = v.pvipvcod
        AND d.deviprocod = v.pviprocod
        AND d.deviprocorid IS NOT DISTINCT FROM v.pviprocorid
       WHERE TRIM(pv.pvconfirmado) = 'S'
         AND TRIM(pv.pvsta) = 'A'
         AND v.quantidade_vendida > COALESCE(d.quantidade_devolvida, 0)
         ${where}
       ORDER BY pv.pvdtcad DESC, v.pvipvcod DESC, p.prodes
       LIMIT $${params.length}`,
      params,
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar itens para devolucao:", error);
    res.status(500).json({ error: "Erro ao buscar itens vendidos" });
  }
};

exports.listarHistorico = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.devcod, d.devpvcod AS pvcod, d.devdtcad,
              d.devmotivo, d.devobs,
              COALESCE(u.usunome, 'Sem usuario') AS usuario,
              di.deviprocod AS procod, di.deviprodes AS prodes,
              COALESCE(di.devicornome, 'Sem cor') AS cornome,
              di.deviqtde AS quantidade, di.devivl AS valor_unitario,
              di.devirepor_estoque AS repor_estoque
       FROM devolucoes d
       JOIN devolucao_itens di ON di.devidevcod = d.devcod
       LEFT JOIN usu u ON u.usucod = d.devusucod
       WHERE d.devsta = 'A'
       ORDER BY d.devdtcad DESC, d.devcod DESC
       LIMIT 100`,
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Erro ao listar devolucoes:", error);
    res.status(500).json({ error: "Erro ao listar devolucoes" });
  }
};

exports.registrarDevolucao = async (req, res) => {
  const pvcod = parsePositiveInteger(req.body.pvcod);
  const procod = parsePositiveInteger(req.body.procod);
  const quantidade = parsePositiveInteger(req.body.quantidade);
  const pviprocorid = normalizeColor(req.body.pviprocorid);
  const motivo = String(req.body.motivo || "").trim();
  const observacao = String(req.body.observacao || "").trim();
  const reporEstoque = req.body.reporEstoque !== false;

  if (!pvcod || !procod || !quantidade) {
    return res.status(400).json({ error: "Pedido, peca e quantidade sao obrigatorios" });
  }
  if (Number.isNaN(pviprocorid)) {
    return res.status(400).json({ error: "Cor invalida" });
  }
  if (!motivo) {
    return res.status(400).json({ error: "Informe o motivo da devolucao" });
  }
  if (motivo.length > 80 || observacao.length > 254) {
    return res.status(400).json({ error: "Motivo ou observacao excede o tamanho permitido" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const pedidoResult = await client.query(
      `SELECT pvcod, pvconfirmado, pvsta
       FROM pv WHERE pvcod = $1 FOR UPDATE`,
      [pvcod],
    );
    if (pedidoResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Pedido nao encontrado" });
    }
    const pedido = pedidoResult.rows[0];
    if (String(pedido.pvconfirmado).trim() !== "S" || String(pedido.pvsta).trim() !== "A") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Somente pedidos finalizados e ativos podem receber devolucao" });
    }

    const itemResult = await client.query(
      `SELECT SUM(COALESCE(i.pviqtde, 0))::INTEGER AS quantidade_vendida,
              MAX(COALESCE(i.pvivl, 0)) AS valor_unitario,
              MAX(p.prodes) AS prodes,
              MAX(COALESCE(c.cornome, 'Sem cor')) AS cornome
       FROM pvi i
       JOIN pro p ON p.procod = i.pviprocod
       LEFT JOIN cores c ON c.corcod = i.pviprocorid
       WHERE i.pvipvcod = $1
         AND i.pviprocod = $2
         AND i.pviprocorid IS NOT DISTINCT FROM $3::INTEGER`,
      [pvcod, procod, pviprocorid],
    );
    const itemVendido = itemResult.rows[0];
    const quantidadeVendida = Number(itemVendido?.quantidade_vendida || 0);
    if (quantidadeVendida <= 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Peca nao encontrada neste pedido" });
    }

    const devolvidosResult = await client.query(
      `SELECT di.deviqtde
       FROM devolucoes d
       JOIN devolucao_itens di ON di.devidevcod = d.devcod
       WHERE d.devsta = 'A'
         AND d.devpvcod = $1
         AND di.deviprocod = $2
         AND di.deviprocorid IS NOT DISTINCT FROM $3::INTEGER
       FOR UPDATE OF di`,
      [pvcod, procod, pviprocorid],
    );
    const quantidadeJaDevolvida = devolvidosResult.rows.reduce(
      (total, row) => total + Number(row.deviqtde || 0),
      0,
    );
    const quantidadeDisponivel = quantidadeVendida - quantidadeJaDevolvida;
    if (quantidade > quantidadeDisponivel) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: `Quantidade superior ao disponivel para devolucao. Disponivel: ${quantidadeDisponivel}`,
        tipo: "quantidade_devolucao_excedida",
      });
    }

    const devolucaoResult = await client.query(
      `INSERT INTO devolucoes (devpvcod, devusucod, devmotivo, devobs)
       VALUES ($1, $2, $3, NULLIF($4, ''))
       RETURNING devcod, devdtcad`,
      [pvcod, req.token?.usucod || null, motivo, observacao],
    );
    const devolucao = devolucaoResult.rows[0];

    await client.query(
      `INSERT INTO devolucao_itens
         (devidevcod, deviprocod, deviprocorid, deviqtde, devivl,
          deviprodes, devicornome, devirepor_estoque)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        devolucao.devcod,
        procod,
        pviprocorid,
        quantidade,
        itemVendido.valor_unitario,
        itemVendido.prodes,
        itemVendido.cornome,
        reporEstoque,
      ],
    );

    let estoque = { tipo: "nao_reposto", quantidade: null };
    if (reporEstoque) {
      const grupoResult = await client.query(
        `SELECT pg.id, pg.name, pg.stock_quantity
         FROM procor pc
         JOIN part_group_items pgi ON pgi.procorid = pc.procorid
         JOIN part_groups pg ON pg.id = pgi.group_id
         WHERE pc.procorprocod = $1
           AND (
             pc.procorcorescod IS NOT DISTINCT FROM $2::INTEGER
             OR ($2::INTEGER IS NULL AND pc.procorcorescod = 0)
           )
         ORDER BY
           CASE WHEN pc.procorcorescod IS NOT DISTINCT FROM $2::INTEGER THEN 0 ELSE 1 END,
           pg.id
         LIMIT 1
         FOR UPDATE OF pg`,
        [procod, pviprocorid],
      );

      if (grupoResult.rows.length > 0) {
        const grupo = grupoResult.rows[0];
        const novoEstoque = Number(grupo.stock_quantity) + quantidade;
        await client.query(
          `UPDATE part_groups
           SET stock_quantity = $1, updated_at = NOW()
           WHERE id = $2`,
          [novoEstoque, grupo.id],
        );
        await client.query(
          `INSERT INTO part_group_audit (part_group_id, change, reason, reference_id)
           VALUES ($1, $2, 'Devolucao', $3)`,
          [grupo.id, quantidade, `Pedido ${pvcod} / Devolucao ${devolucao.devcod}`],
        );
        estoque = { tipo: "grupo", grupoId: grupo.id, quantidade: novoEstoque };
      } else if (pviprocorid !== null) {
        const corResult = await client.query(
          `UPDATE procor
           SET procorqtde = COALESCE(procorqtde, 0) + $1
           WHERE procorprocod = $2 AND procorcorescod = $3
           RETURNING procorqtde`,
          [quantidade, procod, pviprocorid],
        );
        if (corResult.rows.length === 0) {
          throw new Error("A cor vendida nao existe mais no cadastro da peca");
        }
        estoque = { tipo: "cor", quantidade: Number(corResult.rows[0].procorqtde) };
      } else {
        const produtoResult = await client.query(
          `UPDATE pro
           SET proqtde = COALESCE(proqtde, 0) + $1
           WHERE procod = $2
           RETURNING proqtde`,
          [quantidade, procod],
        );
        if (produtoResult.rows.length === 0) {
          throw new Error("Peca nao existe mais no cadastro");
        }
        estoque = { tipo: "peca", quantidade: Number(produtoResult.rows[0].proqtde) };
      }
    }

    await client.query("COMMIT");
    catalogoCache.invalidate();
    return res.status(201).json({
      message: "Devolucao registrada com sucesso",
      devolucao: {
        codigo: devolucao.devcod,
        pedido: pvcod,
        quantidade,
        quantidadeRestante: quantidadeDisponivel - quantidade,
        reporEstoque,
      },
      estoque,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erro ao registrar devolucao:", error);
    res.status(500).json({ error: error.message || "Erro ao registrar devolucao" });
  } finally {
    client.release();
  }
};
