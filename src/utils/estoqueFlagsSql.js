const {
  disponibilidadeProdutoAutoSql,
  menorSaldoDisponivelProdutoSql,
} = require("./disponibilidadeProdutoSql");

// Monta as expressoes SQL das flags de estoque efetivas para a empresa.
//
// - Empresa que controla estoque (empusaest = 'S'): flags automaticas.
//     prosemest  -> disponibilidade calculada em tempo real (estoque de cor/
//                    grupo e, para pecas simples, o estoque geral);
//     proacabando -> 'S' quando alguma fonte (grupo/cor/produto) esta entre 1 e
//                    a quantidade minima configurada em emp.empestoqmin.
// - Empresa que nao controla estoque (empusaest = 'N'): toda validacao de
//   estoque e ignorada na loja. Todos os produtos ficam disponiveis e nenhum
//   aparece como "acabando", independentemente das flags do cadastro.
const FLAGS_SEM_CONTROLE = Object.freeze({
  disponibilidadeSql: "'N'",
  acabandoSql: "'N'",
});

function buildFlagsEstoqueSql({ usaEstoque, estoqueMin } = {}) {
  const min = Number.isInteger(Number(estoqueMin)) && Number(estoqueMin) >= 0
    ? Number(estoqueMin)
    : 5;

  if (!usaEstoque) {
    return { ...FLAGS_SEM_CONTROLE };
  }

  return {
    disponibilidadeSql: disponibilidadeProdutoAutoSql,
    acabandoSql:
      `CASE WHEN ${menorSaldoDisponivelProdutoSql} > 0 AND ${menorSaldoDisponivelProdutoSql} <= ${min} ` +
      "THEN 'S' ELSE 'N' END",
  };
}

// A gestão (listagem, filtros e KPIs do painel) mostra as marcações manuais do
// cadastro quando a empresa não controla estoque, sem calcular estoque por
// cor/grupo. Com o controle de estoque ativo, valem as flags automáticas.
function buildFlagsGestao(config) {
  if (config && config.usaEstoque) {
    return buildFlagsEstoqueSql(config);
  }
  return {
    disponibilidadeSql: "COALESCE(UPPER(TRIM(pro.prosemest)), 'N')",
    acabandoSql: "COALESCE(UPPER(TRIM(pro.proacabando)), 'N')",
  };
}

module.exports = { buildFlagsEstoqueSql, buildFlagsGestao };
