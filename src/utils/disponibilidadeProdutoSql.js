// No catalogo, o estoque do grupo de compatibilidade e a fonte da verdade.
// Para produtos com variacoes, o produto fica disponivel se ao menos uma
// variacao estiver disponivel. Variacoes fora de grupo preservam o controle
// manual existente por procorsemest.
const disponibilidadeProdutoSql = `
  CASE
    WHEN EXISTS (
      SELECT 1 FROM procor pc_existente
      WHERE pc_existente.procorprocod = pro.procod
    ) THEN
      CASE WHEN EXISTS (
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
      ) THEN 'N' ELSE 'S' END
    ELSE COALESCE(TRIM(pro.prosemest), 'N')
  END
`;

module.exports = { disponibilidadeProdutoSql };
