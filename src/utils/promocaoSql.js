// Expressão SQL do preço promocional efetivo de um produto.
//
// Retorna NULL quando o produto não tem promoção ativa/válida na data atual e o
// preço promocional (com piso em 0) quando tem. Deve ser usada com o alias do
// produto que contém `procod` e `provl` (padrão: "pro").
//
// Centraliza a regra de desconto (percentual ou valor fixo) para que listagens,
// carrinho e checkout compartilhem exatamente o mesmo cálculo.
function precoPromocionalSql(proAlias = "pro") {
  const pro = proAlias;
  return `(
    SELECT CASE
      WHEN p.promocaotipo = 'P'
        THEN GREATEST(COALESCE(${pro}.provl, 0) - (COALESCE(${pro}.provl, 0) * p.promocaovalor / 100), 0)
      ELSE GREATEST(COALESCE(${pro}.provl, 0) - p.promocaovalor, 0)
    END
    FROM public.promocoes p
    WHERE p.procod = ${pro}.procod
      AND p.promocaoativo = TRUE
      AND (p.promocaodtinicio IS NULL OR p.promocaodtinicio <= CURRENT_DATE)
      AND (p.promocaodtfim IS NULL OR p.promocaodtfim >= CURRENT_DATE)
    ORDER BY p.promocaocod DESC
    LIMIT 1
  )`;
}

module.exports = { precoPromocionalSql };
