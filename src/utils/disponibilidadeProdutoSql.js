// No catalogo, o estoque do grupo de compatibilidade e a fonte da verdade.
// Para produtos com variacoes, o produto fica disponivel se ao menos uma
// variacao estiver disponivel. Variacoes fora de grupo preservam o controle
// manual existente por procorsemest.
const disponibilidadePorCorSql = `CASE WHEN EXISTS (
        SELECT 1
        FROM procor pc_disponivel
        WHERE pc_disponivel.procorprocod = pro.procod
          AND (
            EXISTS (
              SELECT 1
              FROM part_group_items pgi_disponivel
              JOIN part_groups pg_disponivel
                ON pg_disponivel.id = pgi_disponivel.group_id
              WHERE pgi_disponivel.procorid = pc_disponivel.procorid
                AND COALESCE(pg_disponivel.stock_quantity, 0) > 0
            )
            OR (
              NOT EXISTS (
                SELECT 1 FROM part_group_items pgi_vinculo
                WHERE pgi_vinculo.procorid = pc_disponivel.procorid
              )
              AND COALESCE(TRIM(pc_disponivel.procorsemest), 'N') <> 'S'
            )
          )
      ) THEN 'N' ELSE 'S' END`;

// Modo manual: pecas simples usam a flag salva no cadastro (pro.prosemest).
const disponibilidadeProdutoSql = `
  CASE
    WHEN EXISTS (
      SELECT 1 FROM procor pc_existente
      WHERE pc_existente.procorprocod = pro.procod
    ) THEN
      ${disponibilidadePorCorSql}
    ELSE COALESCE(TRIM(pro.prosemest), 'N')
  END
`;

// Saldo vendavel: cada grupo entra uma vez, mesmo que varias cores da peca
// compartilhem esse grupo. Cores independentes somam seus proprios saldos.
// Sem cores reais nem grupo, a baixa do pedido usa pro.proqtde, inclusive
// quando existe um cadastro auxiliar de procor com cor NULL/0.
const fontesEstoqueProdutoSql = `
    SELECT DISTINCT 'grupo' AS origem, pg.id AS id, pg.stock_quantity AS quantidade
    FROM procor pc
    JOIN part_group_items pgi ON pgi.procorid = pc.procorid
    JOIN part_groups pg ON pg.id = pgi.group_id
    WHERE pc.procorprocod = pro.procod
    UNION ALL
    SELECT 'cor', pc.procorid, pc.procorqtde
    FROM procor pc
    WHERE pc.procorprocod = pro.procod
      AND COALESCE(pc.procorcorescod, 0) <> 0
      AND NOT EXISTS (
        SELECT 1 FROM part_group_items pgi WHERE pgi.procorid = pc.procorid
      )
    UNION ALL
    SELECT 'produto', pro.procod, pro.proqtde
    WHERE NOT EXISTS (
      SELECT 1 FROM procor pc
      WHERE pc.procorprocod = pro.procod
        AND COALESCE(pc.procorcorescod, 0) <> 0
    ) AND NOT EXISTS (
      SELECT 1 FROM procor pc
      JOIN part_group_items pgi ON pgi.procorid = pc.procorid
      WHERE pc.procorprocod = pro.procod
    )
`;

const estoqueEfetivoProdutoSql = `COALESCE((
  SELECT SUM(GREATEST(COALESCE(saldos.quantidade, 0), 0))
  FROM (${fontesEstoqueProdutoSql}) saldos
), 0)`;

// Uma opcao com saldo baixo precisa ser sinalizada mesmo quando outra tem
// estoque alto. Opcoes zeradas nao geram "acabando".
const menorSaldoDisponivelProdutoSql = `COALESCE((
  SELECT MIN(saldos.quantidade) FILTER (WHERE saldos.quantidade > 0)
  FROM (${fontesEstoqueProdutoSql}) saldos
), 0)`;

// Sem estoque geral somente quando nenhuma opcao tem saldo positivo.
const disponibilidadeProdutoAutoSql =
  `CASE WHEN ${estoqueEfetivoProdutoSql} <= 0 THEN 'S' ELSE 'N' END`;

module.exports = {
  disponibilidadeProdutoSql,
  disponibilidadeProdutoAutoSql,
  estoqueEfetivoProdutoSql,
  menorSaldoDisponivelProdutoSql,
};
