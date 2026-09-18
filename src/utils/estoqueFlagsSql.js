const { disponibilidadeProdutoSql } = require("./disponibilidadeProdutoSql");

// Monta as expressoes SQL das flags de estoque efetivas para a empresa.
//
// - Empresa que controla estoque (empusaest = 'S'):
//     prosemest  -> disponibilidade real (cor/grupo), como ja existia;
//     proacabando -> 'S' quando o estoque geral (pro.proqtde) esta entre 1 e
//                    a quantidade minima configurada em emp.empestoqmin.
// - Empresa que nao controla estoque (empusaest = 'N'): ambas ficam 'N', ou
//   seja, tudo e exibido como disponivel e sem aviso de ultimas unidades.
function buildFlagsEstoqueSql({ usaEstoque, estoqueMin } = {}) {
  if (!usaEstoque) {
    return {
      disponibilidadeSql: "'N'",
      acabandoSql: "'N'",
    };
  }

  const min = Number.isInteger(Number(estoqueMin)) && Number(estoqueMin) >= 0
    ? Number(estoqueMin)
    : 5;

  return {
    disponibilidadeSql: disponibilidadeProdutoSql,
    acabandoSql:
      `CASE WHEN COALESCE(pro.proqtde, 0) > 0 AND COALESCE(pro.proqtde, 0) <= ${min} ` +
      `THEN 'S' ELSE 'N' END`,
  };
}

module.exports = { buildFlagsEstoqueSql };
