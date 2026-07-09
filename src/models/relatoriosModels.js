const pool = require("../config/db");

// Constants
const CONFIRMED_ORDER_STATUS = "S";

/**
 * Modelo de Relatórios
 *
 * Funções para gerar relatórios de vendas e análises
 */

/**
 * Busca top peças vendidas com filtros
 * @param {Object} filters - Filtros para a consulta
 * @param {string} filters.dataInicio - Data inicial (YYYY-MM-DD)
 * @param {string} filters.dataFim - Data final (YYYY-MM-DD)
 * @param {number} filters.marca - ID da marca (opcional)
 * @param {string} filters.groupBy - 'peca' ou 'grupo' (default: 'peca')
 * @returns {Array} Lista de peças/grupos vendidos
 */
async function getTopPecas(filters = {}) {
  const { dataInicio, dataFim, marca, groupBy = "peca" } = filters;

  let whereClauses = [`pvconfirmado = '${CONFIRMED_ORDER_STATUS}'`]; // Apenas pedidos confirmados
  let params = [];
  let paramIndex = 1;

  // Filtro de data início
  if (dataInicio) {
    whereClauses.push(`pvdtcad >= $${paramIndex}`);
    params.push(dataInicio);
    paramIndex++;
  }

  // Filtro de data fim
  if (dataFim) {
    whereClauses.push(`pvdtcad <= $${paramIndex}`);
    params.push(dataFim);
    paramIndex++;
  }

  // Filtro de marca
  if (marca) {
    whereClauses.push(`promarcascod = $${paramIndex}`);
    params.push(marca);
    paramIndex++;
  }

  const whereClause = whereClauses.join(" AND ");

  if (groupBy === "grupo") {
    // Agrupado por part_group — busca o vínculo de grupo pela peça (qualquer variante de cor),
    // evitando que vendas sem cor ou com cor diferente da cadastrada no grupo sejam excluídas.
    const query = `
      SELECT
        pg.name AS grupo,
        SUM(pviqtde) AS qtde_vendida,
        STRING_AGG(DISTINCT m.moddes, ', ' ORDER BY m.moddes) AS modelo,
        STRING_AGG(DISTINCT p.prodes, ', ' ORDER BY p.prodes) AS peca,
        COALESCE(MAX(p.procusto), 0) AS custo
      FROM pvi
      JOIN pv ON pvcod = pvipvcod
      JOIN pro p ON pviprocod = p.procod
      LEFT JOIN modelo m ON m.modcod = p.promodcod
      JOIN (
        SELECT DISTINCT pc2.procorprocod, pgi2.group_id
        FROM procor pc2
        JOIN part_group_items pgi2 ON pgi2.procorid = pc2.procorid
      ) grp ON grp.procorprocod = p.procod
      JOIN part_groups pg ON pg.id = grp.group_id
      WHERE ${whereClause}
      GROUP BY pg.id, pg.name
      ORDER BY qtde_vendida DESC
    `;

    const result = await pool.query(query, params);
    return result.rows;
  } else {
    // Agrupado por peça individual — grupo via part_group_items, sem depender de pro.part_group_id
    const query = `
      SELECT 
        p.prodes as peca,
        SUM(pviqtde) as qtde_vendida,
        m.moddes as modelo,
        COALESCE(pg.name, '-') as grupo,
        case when procusto is null then 0 else procusto end as custo
      FROM pvi
      JOIN pv ON pvcod = pvipvcod
      JOIN pro p ON pviprocod = p.procod
      LEFT JOIN modelo m ON m.modcod = p.promodcod
      LEFT JOIN procor pc ON pc.procorprocod = p.procod
        AND (
          (pvi.pviprocorid IS NOT NULL AND pc.procorcorescod = pvi.pviprocorid)
          OR (pvi.pviprocorid IS NULL AND pc.procorcorescod IS NULL)
        )
      LEFT JOIN part_group_items pgi ON pgi.procorid = pc.procorid
      LEFT JOIN part_groups pg ON pg.id = pgi.group_id
      WHERE ${whereClause}
      GROUP BY p.procod, p.prodes, m.moddes, pg.name, procusto
      ORDER BY qtde_vendida DESC
    `;

    const result = await pool.query(query, params);
    return result.rows;
  }
}

/**
 * Busca todas as peças cadastradas com filtros opcionais
 * @param {Object} filters - Filtros para a consulta
 * @param {number} filters.marca - ID da marca (opcional)
 * @param {number} filters.modelo - ID do modelo (opcional)
 * @param {string} filters.peca - Texto da peça para filtrar (opcional)
 * @param {number} filters.tipo - ID do tipo de peça (opcional)
 * @returns {Array} Lista de peças cadastradas
 */
async function getPecasCadastradas(filters = {}) {
  const { marca, modelo, peca, tipo } = filters;

  let whereClauses = ["marcassit = 'A'"];
  let params = [];
  let paramIndex = 1;

  if (marca) {
    whereClauses.push(`pro.promarcascod = $${paramIndex}`);
    params.push(marca);
    paramIndex++;
  }

  if (modelo) {
    whereClauses.push(`(pro.promodcod = $${paramIndex} OR EXISTS (SELECT 1 FROM promod pm WHERE pm.promodprocod = pro.procod AND pm.promodmodcod = $${paramIndex}))`);
    params.push(modelo);
    paramIndex++;
  }

  if (peca) {
    whereClauses.push(`LOWER(pro.prodes) LIKE LOWER($${paramIndex})`);
    params.push(`%${peca}%`);
    paramIndex++;
  }

  if (tipo) {
    whereClauses.push(`pro.protipocod = $${paramIndex}`);
    params.push(tipo);
    paramIndex++;
  }

  const whereClause = whereClauses.join(" AND ");

  const query = `
    SELECT 
      pro.procod,
      pro.prodes as peca,
      marcas.marcasdes as marca,
      modelo.moddes as modelo,
      tipo.tipodes as tipo,
      COALESCE(pro.provl, 0) as preco,
      pro.prosemest
    FROM pro
    JOIN marcas ON marcas.marcascod = pro.promarcascod
    LEFT JOIN modelo ON modelo.modcod = pro.promodcod
    LEFT JOIN tipo ON tipo.tipocod = pro.protipocod
    WHERE ${whereClause}
    ORDER BY
      LOWER(TRIM(pro.prodes)),
      LOWER(TRIM(marcas.marcasdes)),
      LOWER(TRIM(COALESCE(modelo.moddes, ''))),
      pro.procod
  `;

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Busca grupos de compatibilidade vinculados às peças mais vendidas (Top Peças)
 * com estoque atual e quantidade ideal para controle de estoque
 * @param {Object} filters - Filtros para a consulta (mesmos do getTopPecas)
 * @param {string} filters.dataInicio - Data inicial (YYYY-MM-DD)
 * @param {string} filters.dataFim - Data final (YYYY-MM-DD)
 * @param {number} filters.marca - ID da marca (opcional)
 * @returns {Array} Lista de grupos com estoque atual, qtde_ideal e qtde_vendida
 */
async function getEstoqueGruposTopPecas(filters = {}) {
  const { dataInicio, dataFim, marca } = filters;

  let whereClauses = [`pvconfirmado = $1`];
  let params = [CONFIRMED_ORDER_STATUS];
  let paramIndex = 2;

  if (dataInicio) {
    whereClauses.push(`pvdtcad >= $${paramIndex}`);
    params.push(dataInicio);
    paramIndex++;
  }

  if (dataFim) {
    whereClauses.push(`pvdtcad <= $${paramIndex}`);
    params.push(dataFim);
    paramIndex++;
  }

  if (marca) {
    whereClauses.push(`promarcascod = $${paramIndex}`);
    params.push(marca);
    paramIndex++;
  }

  const whereClause = whereClauses.join(" AND ");

  const query = `
    SELECT
      pg.id,
      pg.name AS grupo,
      COALESCE(pg.stock_quantity, 0) AS estoque_atual,
      pg.qtde_ideal,
      SUM(pviqtde) AS qtde_vendida
    FROM pvi
    JOIN pv ON pvcod = pvipvcod
    JOIN pro p ON pviprocod = p.procod
    JOIN procor pc ON pc.procorprocod = p.procod
      AND (
        (pvi.pviprocorid IS NOT NULL AND pc.procorcorescod = pvi.pviprocorid)
        OR (pvi.pviprocorid IS NULL AND pc.procorcorescod IS NULL)
      )
    JOIN part_group_items pgi ON pgi.procorid = pc.procorid
    JOIN part_groups pg ON pg.id = pgi.group_id
    WHERE ${whereClause}
    GROUP BY pg.id, pg.name, pg.stock_quantity, pg.qtde_ideal
    ORDER BY qtde_vendida DESC
  `;

  const result = await pool.query(query, params);
  return result.rows;
}

module.exports = {
  getTopPecas,
  getPecasCadastradas,
  getEstoqueGruposTopPecas,
};
