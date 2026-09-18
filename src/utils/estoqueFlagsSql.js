const {
  disponibilidadeProdutoSql,
  disponibilidadeProdutoAutoSql,
} = require("./disponibilidadeProdutoSql");

// Monta as expressoes SQL das flags de estoque efetivas para a empresa.
//
// - Empresa que controla estoque (empusaest = 'S'): flags automaticas.
//     prosemest  -> disponibilidade calculada em tempo real (estoque de cor/
//                    grupo e, para pecas simples, o estoque geral);
//     proacabando -> 'S' quando o estoque geral (pro.proqtde) esta entre 1 e
//                    a quantidade minima configurada em emp.empestoqmin.
// - Empresa que nao controla estoque (empusaest = 'N'): as flags manuais do
//   cadastro (pro.prosemest / pro.proacabando) continuam valendo e sao
//   respeitadas na loja.
function buildFlagsEstoqueSql({ usaEstoque, estoqueMin } = {}) {
  const min = Number.isInteger(Number(estoqueMin)) && Number(estoqueMin) >= 0
    ? Number(estoqueMin)
    : 5;

  if (!usaEstoque) {
    return {
      disponibilidadeSql: disponibilidadeProdutoSql,
      acabandoSql: "COALESCE(UPPER(TRIM(pro.proacabando)), 'N')",
    };
  }

  return {
    disponibilidadeSql: disponibilidadeProdutoAutoSql,
    acabandoSql:
      `CASE WHEN COALESCE(pro.proqtde, 0) > 0 AND COALESCE(pro.proqtde, 0) <= ${min} ` +
      "THEN 'S' ELSE 'N' END",
  };
}

module.exports = { buildFlagsEstoqueSql };
