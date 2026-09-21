const pool = require("../config/db");
const {
  disponibilidadeProdutoAutoSql,
} = require("../utils/disponibilidadeProdutoSql");
const { precoPromocionalSql } = require("../utils/promocaoSql");

// As vitrines são fixas por enquanto: Destaques é manual e Mais vendidos /
// Novidades são montadas automaticamente. O limite de itens das automáticas
// é validado no controller (MAX_MAX_ITEMS).
const MAX_MAX_ITEMS = 50;

// Select padrão dos produtos exibidos nos cards das vitrines. Mantém os
// mesmos campos usados pelo catálogo (proController/proModels), além do
// modelo principal (promodcod legado ou primeiro vínculo em promod).
const PRODUTO_SELECT = `
  pro.procod,
  COALESCE(pro.prodes, '') AS prodes,
  COALESCE(pro.provl, 0) AS provl,
  ${precoPromocionalSql("pro")} AS provlpromo,
  pro.protipocod,
  pro.promarcascod,
  pro.prosit,
  tipo.tipodes,
  marcas.marcasdes,
  COALESCE(pro.prosemest, 'N') AS prosemest,
  ${disponibilidadeProdutoAutoSql} AS prosemest_auto,
  COALESCE(pro.proacabando, 'N') AS proacabando,
  COALESCE(pro.proqtde, 0) AS proqtde,
  pro.prodtcad,
  modelo.modcod,
  modelo.moddes
`;

const PRODUTO_JOIN_TABLES = `
  JOIN tipo ON tipo.tipocod = pro.protipocod
  JOIN marcas ON marcas.marcascod = pro.promarcascod
    AND COALESCE(marcas.marcassit, 'A') = 'A'
  LEFT JOIN modelo ON modelo.modcod = COALESCE(
    pro.promodcod,
    (SELECT MIN(pm.promodmodcod) FROM promod pm WHERE pm.promodprocod = pro.procod)
  )
`;

const PRODUTO_JOINS = `FROM pro ${PRODUTO_JOIN_TABLES}`;

// Disponibilidade efetiva usada pelas vitrines automáticas, espelhando o que
// mapearItemPublico() expõe: com controle de estoque ativo (empusaest = 'S')
// valem as flags automáticas; sem ele, a flag manual do cadastro. Produtos sem
// disponibilidade ('S') são descartados na própria consulta, de modo que o
// LIMIT preencha a vitrine com os próximos itens disponíveis.
function disponibilidadeVitrineSql(config) {
  if (config && config.usaEstoque) {
    return disponibilidadeProdutoAutoSql;
  }
  return "COALESCE(UPPER(TRIM(pro.prosemest)), 'N')";
}

async function listarShowcases({ somenteAtivas = true } = {}) {
  const where = somenteAtivas ? "WHERE active = TRUE" : "";
  const result = await pool.query(
    `SELECT id, type, title, active, position, max_items
     FROM home_showcases
     ${where}
     ORDER BY position, id`
  );
  return result.rows;
}

async function buscarShowcasePorId(id) {
  const result = await pool.query(
    `SELECT id, type, title, active, position, max_items
     FROM home_showcases
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function buscarShowcasePorTipo(type) {
  const result = await pool.query(
    `SELECT id, type, title, active, position, max_items
     FROM home_showcases
     WHERE type = $1`,
    [type]
  );
  return result.rows[0] || null;
}

// Itens manuais (Destaques) com os dados do produto. `somenteAtivos` filtra
// produtos inativos na leitura pública; o painel enxerga todos.
async function listarItensShowcases({ somenteAtivos = true } = {}) {
  const result = await pool.query(
    `SELECT i.showcase_id,
            i.id AS item_id,
            i.position,
            ${PRODUTO_SELECT}
     FROM home_showcase_items i
     JOIN pro ON pro.procod = i.procod
     ${PRODUTO_JOIN_TABLES}
     WHERE ($1::boolean IS FALSE OR pro.prosit = 'A')
     ORDER BY i.showcase_id, i.position, i.id`,
    [somenteAtivos]
  );
  return result.rows;
}

async function listarItensShowcase(showcaseId, { somenteAtivos = true, config } = {}) {
  const disponibilidade = disponibilidadeVitrineSql(config);
  const result = await pool.query(
    `SELECT i.id AS item_id,
            i.position,
            ${PRODUTO_SELECT}
     FROM home_showcase_items i
     JOIN pro ON pro.procod = i.procod
     ${PRODUTO_JOIN_TABLES}
     WHERE i.showcase_id = $1
       AND ($2::boolean IS FALSE OR (pro.prosit = 'A' AND (${disponibilidade}) <> 'S'))
     ORDER BY i.position, i.id`,
    [showcaseId, somenteAtivos]
  );
  return result.rows;
}

// Mais vendidos: regra consolidada de venda do sistema (mesma usada em
// devolucoesController.buscarItensVendidos e nos relatórios) —
// pedido confirmado ('S') e ativo ('A'), descontando devoluções ativas.
async function listarMaisVendidos(limite, config) {
  const disponibilidade = disponibilidadeVitrineSql(config);
  const result = await pool.query(
    `WITH vendas AS (
       SELECT i.pviprocod AS procod,
              SUM(COALESCE(i.pviqtde, 0)) AS quantidade
       FROM pvi i
       JOIN pv ON pv.pvcod = i.pvipvcod
       WHERE pv.pvconfirmado = 'S'
         AND pv.pvsta = 'A'
       GROUP BY i.pviprocod
     ),
     devolvidas AS (
       SELECT di.deviprocod AS procod,
              SUM(di.deviqtde) AS quantidade
       FROM devolucoes d
       JOIN devolucao_itens di ON di.devidevcod = d.devcod
       JOIN pv ON pv.pvcod = d.devpvcod
       WHERE d.devsta = 'A'
         AND pv.pvconfirmado = 'S'
         AND pv.pvsta = 'A'
       GROUP BY di.deviprocod
     )
     SELECT ${PRODUTO_SELECT},
            (vendas.quantidade - COALESCE(devolvidas.quantidade, 0)) AS quantidade_vendida
     FROM vendas
     JOIN pro ON pro.procod = vendas.procod
     ${PRODUTO_JOIN_TABLES}
     LEFT JOIN devolvidas ON devolvidas.procod = vendas.procod
     WHERE pro.prosit = 'A'
       AND (vendas.quantidade - COALESCE(devolvidas.quantidade, 0)) > 0
       AND (${disponibilidade}) <> 'S'
     ORDER BY quantidade_vendida DESC, pro.prodes
     LIMIT $1`,
    [limite]
  );
  return result.rows;
}

// Novidades: cadastro mais recente primeiro (prodtcad), nunca alfabética.
// Produtos sem disponibilidade são ignorados e a consulta "volta no tempo"
// automaticamente (LIMIT após o filtro), preenchendo a vitrine.
async function listarNovidades(limite, config) {
  const disponibilidade = disponibilidadeVitrineSql(config);
  const result = await pool.query(
    `SELECT ${PRODUTO_SELECT}
     ${PRODUTO_JOINS}
     WHERE pro.prosit = 'A'
       AND (${disponibilidade}) <> 'S'
     ORDER BY pro.prodtcad DESC NULLS LAST, pro.procod DESC
     LIMIT $1`,
    [limite]
  );
  return result.rows;
}

async function atualizarShowcase(id, { active, position, max_items } = {}) {
  const result = await pool.query(
    `UPDATE home_showcases
     SET active = COALESCE($2::boolean, active),
         position = COALESCE($3::int, position),
         max_items = COALESCE($4::int, max_items),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, type, title, active, position, max_items`,
    [
      id,
      typeof active === "boolean" ? active : null,
      Number.isInteger(position) ? position : null,
      Number.isInteger(max_items) ? max_items : null,
    ]
  );
  return result.rows[0] || null;
}

async function atualizarOrdemShowcases(ids) {
  const ordens = ids.map((_, i) => i + 1);
  await pool.query(
    `UPDATE home_showcases h
     SET position = v.ordem, updated_at = NOW()
     FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::int[]) AS ordem) AS v
     WHERE h.id = v.id`,
    [ids, ordens]
  );
}

// Adiciona um produto aos Destaques no fim da ordem atual.
async function adicionarItemDestaque(showcaseId, procod) {
  const result = await pool.query(
    `INSERT INTO home_showcase_items (showcase_id, procod, position)
     VALUES (
       $1,
       $2,
       COALESCE((
         SELECT MAX(position) + 1
         FROM home_showcase_items
         WHERE showcase_id = $1
       ), 1)
     )
     ON CONFLICT (showcase_id, procod) DO NOTHING
     RETURNING id, showcase_id, procod, position`,
    [showcaseId, procod]
  );
  return result.rows[0] || null;
}

async function removerItemDestaque(showcaseId, procod) {
  const result = await pool.query(
    `DELETE FROM home_showcase_items
     WHERE showcase_id = $1 AND procod = $2`,
    [showcaseId, procod]
  );
  return result.rowCount > 0;
}

async function atualizarOrdemItensShowcase(showcaseId, procs) {
  const ordens = procs.map((_, i) => i + 1);
  await pool.query(
    `UPDATE home_showcase_items i
     SET position = v.ordem
     FROM (SELECT UNNEST($2::int[]) AS procod, UNNEST($3::int[]) AS ordem) AS v
     WHERE i.showcase_id = $1 AND i.procod = v.procod`,
    [showcaseId, procs, ordens]
  );
}

async function buscarProduto(procod) {
  const result = await pool.query(
    `SELECT pro.procod, pro.prosit
     FROM pro
     WHERE pro.procod = $1`,
    [procod]
  );
  return result.rows[0] || null;
}

module.exports = {
  MAX_MAX_ITEMS,
  listarShowcases,
  buscarShowcasePorId,
  buscarShowcasePorTipo,
  listarItensShowcases,
  listarItensShowcase,
  listarMaisVendidos,
  listarNovidades,
  atualizarShowcase,
  atualizarOrdemShowcases,
  adicionarItemDestaque,
  removerItemDestaque,
  atualizarOrdemItensShowcase,
  buscarProduto,
};
