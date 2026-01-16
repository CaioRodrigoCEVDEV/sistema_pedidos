const pool = require("../config/db");

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
  const { dataInicio, dataFim, marca, groupBy = 'peca' } = filters;
  
  let whereClauses = ["pvconfirmado = 'S'"]; // Apenas pedidos confirmados
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

  const whereClause = whereClauses.join(' AND ');

  if (groupBy === 'grupo') {
    // Agrupado por part_group
    const query = `
      SELECT 
        pg.name as grupo,
        SUM(pviqtde) as qtde_vendida,
        STRING_AGG(DISTINCT m.moddes, ', ' ORDER BY m.moddes) as modelo,
        STRING_AGG(DISTINCT p.prodes, ', ' ORDER BY p.prodes) as peca
      FROM pvi
      JOIN pv ON pvcod = pvipvcod
      JOIN pro p ON pviprocod = p.procod
      LEFT JOIN part_groups pg ON p.part_group_id = pg.id
      LEFT JOIN modelo m ON m.modcod = p.promodcod
      WHERE ${whereClause}
        AND p.part_group_id IS NOT NULL
      GROUP BY pg.id, pg.name
      ORDER BY qtde_vendida DESC
    `;
    
    const result = await pool.query(query, params);
    return result.rows;
  } else {
    // Agrupado por peça individual
    const query = `
      SELECT 
        p.prodes as peca,
        SUM(pviqtde) as qtde_vendida,
        m.moddes as modelo,
        COALESCE(pg.name, '-') as grupo
      FROM pvi
      JOIN pv ON pvcod = pvipvcod
      JOIN pro p ON pviprocod = p.procod
      LEFT JOIN modelo m ON m.modcod = p.promodcod
      LEFT JOIN part_groups pg ON p.part_group_id = pg.id
      WHERE ${whereClause}
      GROUP BY p.procod, p.prodes, m.moddes, pg.name
      ORDER BY qtde_vendida DESC
    `;
    
    const result = await pool.query(query, params);
    return result.rows;
  }
}

module.exports = {
  getTopPecas
};
