const pool = require("../config/db");
const { getEstoqueConfig } = require("../utils/estoqueConfig");
const { buildFlagsGestao } = require("../utils/estoqueFlagsSql");
const { MASTER_EMAIL } = require("../config/masterUser");

// Resumo do dashboard em uma única chamada.
// Antes: 12 endpoints (5 counts de pedidos, 2 de produto, 3 listas completas e
// 2 listas completas de estoque). Agora: 4 queries agregadas em paralelo, sem
// devolver listas inteiras — apenas os números usados pelos KPIs e o top de
// marcas com estoque usado pelo gráfico.
exports.resumo = async (req, res) => {
  try {
    const config = await getEstoqueConfig();
    const flags = buildFlagsGestao(config);

    const [pedidosR, produtosR, estoqueR, listasR] = await Promise.all([
      pool.query(
        `select
           count(*) filter (where pvconfirmado = 'N' and pvsta = 'A' and pvdtcad = CURRENT_DATE) as pendentes_hoje,
           count(*) filter (where pvconfirmado = 'S' and pvsta = 'A' and pvdtcad = CURRENT_DATE) as confirmados_hoje,
           count(*) filter (where pvcanal = 'BALCAO' and pvsta = 'A' and pvdtcad = CURRENT_DATE) as balcao_hoje,
           count(*) filter (where pvcanal = 'ENTREGA' and pvsta = 'A' and pvdtcad = CURRENT_DATE) as entrega_hoje,
           count(*) filter (where pvcanal = 'VENDA' and pvsta = 'A' and pvdtcad = CURRENT_DATE) as venda_hoje
         from pv`
      ),
      pool.query(
        `select
           count(*) filter (where ${flags.disponibilidadeSql} = 'S') as em_falta,
           count(*) filter (where ${flags.acabandoSql} = 'S') as acabando
         from pro`
      ),
      pool.query(
        `select
           count(*) filter (where case when pc.procorcorescod is null then p.proqtde else pc.procorqtde end > 0) as com_estoque,
           count(*) filter (where case when pc.procorcorescod is null then p.proqtde else coalesce(pc.procorqtde, 0) end <= 0) as sem_estoque,
           (
             select json_agg(t)
             from (
               select coalesce(ma.marcasdes, '—') as marcasdes, count(*)::int as total
                 from pro p2
                 join marcas ma on ma.marcascod = p2.promarcascod
                 left join procor pc2 on p2.procod = pc2.procorprocod
                where p2.prosit = 'A'
                  and case when pc2.procorcorescod is null then p2.proqtde else pc2.procorqtde end > 0
                group by ma.marcasdes
                order by count(*) desc, ma.marcasdes
                limit 5
             ) t
           ) as top_marcas
         from pro p
         left join procor pc on p.procod = pc.procorprocod
        where p.prosit = 'A'`
      ),
      pool.query(
        `select
           (select count(*) from cli) as clientes,
           (select count(*) from usu
             where ususta in ('A', 'I') and usurca = 'S'
               and usuemail <> $1) as vendedores,
           (select count(*) from marcas where marcassit = 'A') as marcas`,
        [MASTER_EMAIL]
      ),
    ]);

    const pedidos = pedidosR.rows[0] || {};
    const produtos = produtosR.rows[0] || {};
    const estoque = estoqueR.rows[0] || {};
    const listas = listasR.rows[0] || {};

    res.status(200).json({
      pedidos: {
        pendentes: Number(pedidos.pendentes_hoje) || 0,
        confirmados: Number(pedidos.confirmados_hoje) || 0,
        balcao: Number(pedidos.balcao_hoje) || 0,
        entrega: Number(pedidos.entrega_hoje) || 0,
        venda: Number(pedidos.venda_hoje) || 0,
      },
      produtos: {
        emFalta: Number(produtos.em_falta) || 0,
        acabando: Number(produtos.acabando) || 0,
      },
      estoque: {
        comEstoque: Number(estoque.com_estoque) || 0,
        semEstoque: Number(estoque.sem_estoque) || 0,
        topMarcas: Array.isArray(estoque.top_marcas) ? estoque.top_marcas : [],
      },
      listas: {
        clientes: Number(listas.clientes) || 0,
        vendedores: Number(listas.vendedores) || 0,
        marcas: Number(listas.marcas) || 0,
      },
    });
  } catch (error) {
    console.error("Erro ao carregar resumo do dashboard:", error);
    res.status(500).json({ error: "Erro ao carregar resumo do dashboard" });
  }
};
