#!/usr/bin/env node
/**
 * Auditoria de planos do PostgreSQL — SOMENTE LEITURA.
 *
 * Roda EXPLAIN (ANALYZE, BUFFERS) das queries reais dos endpoints e coleta
 * estatísticas de tabelas/índices. Não cria índices nem altera dados.
 *
 * Uso:
 *   node scripts/explain-audit.js
 *   NO_ANALYZE=1 node scripts/explain-audit.js   # só EXPLAIN (sem executar)
 */

require("dotenv").config();

const pool = require("../src/config/db");
const { getEstoqueConfig } = require("../src/utils/estoqueConfig");
const { buildFlagsGestao } = require("../src/utils/estoqueFlagsSql");
const { precoPromocionalSql } = require("../src/utils/promocaoSql");

const ANALYZE = process.env.NO_ANALYZE !== "1";
const EXPLAIN_OPTS = ANALYZE ? "ANALYZE, BUFFERS, FORMAT TEXT" : "BUFFERS, FORMAT TEXT";

const TABLES = [
  "pv",
  "pvi",
  "pro",
  "promod",
  "modelo",
  "marcas",
  "tipo",
  "cores",
  "procor",
  "part_groups",
  "part_group_items",
  "promocoes",
  "emp",
  "system_releases",
];

function header(title) {
  console.log("\n" + "=".repeat(78));
  console.log(title);
  console.log("=".repeat(78));
}

async function explain(label, sql, params = []) {
  header("EXPLAIN — " + label);
  try {
    const result = await pool.query(`EXPLAIN (${EXPLAIN_OPTS}) ${sql}`, params);
    console.log(result.rows.map((r) => r["QUERY PLAN"]).join("\n"));
  } catch (error) {
    console.log("ERRO: " + error.message);
  }
}

async function collectStats() {
  header("Configuração (emp) / parâmetros do PostgreSQL");
  try {
    const emp = await pool.query(
      "SELECT COALESCE(TRIM(empusaest),'N') AS empusaest, COALESCE(empestoqmin,5) AS empestoqmin FROM emp ORDER BY empcod LIMIT 1"
    );
    console.log("emp:", emp.rows[0]);
    const settings = await pool.query("SHOW statement_timeout");
    console.log("statement_timeout:", settings.rows[0]);
  } catch (error) {
    console.log("ERRO config:", error.message);
  }

  header("Tamanho das tabelas (pg_stat_user_tables)");
  try {
    const result = await pool.query(
      `SELECT relname, n_live_tup, n_dead_tup, last_analyze, last_autoanalyze
         FROM pg_stat_user_tables
        WHERE relname = ANY($1::text[])
        ORDER BY n_live_tup DESC`,
      [TABLES]
    );
    console.table(result.rows);
  } catch (error) {
    console.log("ERRO stats:", error.message);
  }

  header("Índices existentes (pg_indexes)");
  try {
    const result = await pool.query(
      `SELECT tablename, indexname, indexdef
         FROM pg_indexes
        WHERE tablename = ANY($1::text[])
        ORDER BY tablename, indexname`,
      [TABLES]
    );
    result.rows.forEach((r) => console.log(`[${r.tablename}] ${r.indexdef}`));
  } catch (error) {
    console.log("ERRO indexes:", error.message);
  }

  header("Uso dos índices (pg_stat_user_indexes) — idx_scan = quantas vezes foi usado");
  try {
    const result = await pool.query(
      `SELECT relname, indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
         FROM pg_stat_user_indexes
        WHERE relname = ANY($1::text[])
        ORDER BY idx_scan ASC, relname`,
      [TABLES]
    );
    console.table(result.rows);
  } catch (error) {
    console.log("ERRO index stats:", error.message);
  }
}

async function main() {
  await collectStats();

  const config = await getEstoqueConfig();
  const flags = buildFlagsGestao(config);
  console.log("\nmodo de estoque:", config);

  // 1) /marcas
  await explain("/marcas", "select * from marcas where marcassit = 'A' order by marcasordem");

  // 2) /tipos
  await explain("/tipos", "select tipocod, tipodes from tipo");

  // 3) /modelos (default)
  await explain("/modelos (default)", "select * from vw_modelos");

  // 4) /emp
  await explain("/emp", "SELECT * FROM emp ORDER BY empcod LIMIT 1");

  // 5) /pros — count + dados (paginado)
  const proFrom = `
    from pro
    join tipo on tipocod = protipocod
    join marcas on promarcascod = marcascod and marcassit = 'A'`;
  const proSelect = `
    select
      procod,
      tipodes,
      marcasdes,
      case when prodes is null then '' else prodes end as prodes,
      case when provl is null then 0 else provl end as provl,
      case when procusto is null then 0 else procusto end as procusto,
      ${precoPromocionalSql("pro")} as provlpromo,
      ${flags.disponibilidadeSql} as prosemest,
      ${flags.acabandoSql} as proacabando,
      (
        SELECT string_agg(m.moddes, ', ' ORDER BY m.moddes)
        FROM promod pm
        JOIN modelo m ON pm.promodmodcod = m.modcod
        WHERE pm.promodprocod = pro.procod
      ) as modelos
      ${proFrom}`;

  await explain("/pros count(*)", `select count(*) ${proFrom}`);
  await explain(
    "/pros dados (limit 20 offset 0)",
    `${proSelect} order by procod desc limit 20 offset 0`
  );
  await explain(
    "/pros dados filtro q ILIKE",
    `${proSelect} where prodes ILIKE '%tela%' order by procod desc limit 20 offset 0`
  );

  // 6) /v2/top/marcas/mes
  const topMarcasFrom = `
    from pvi
    join pv on pvcod = pvipvcod
    join pro on pviprocod = procod
    join modelo on modcod = promodcod
    join tipo on tipocod = protipocod
    join marcas on marcascod = promarcascod`;
  const topMarcasSelect = `
    select marcasdes, sum(pvivl * pviqtde) as valor
    ${topMarcasFrom}
    where pvsta = 'A'`;
  await explain(
    "/v2/top/marcas/mes (default 29 dias)",
    `${topMarcasSelect} and pvdtcad >= CURRENT_DATE - interval '29 days' group by marcasdes order by marcasdes asc limit 10`
  );
  await explain(
    "/v2/top/marcas/mes (datas explícitas)",
    `${topMarcasSelect} and pvdtcad between DATE '2026-08-22' and DATE '2026-09-20' group by marcasdes order by marcasdes asc limit 10`
  );

  // 7) /v2/pedidos/total
  await explain(
    "/v2/pedidos/total (sem filtro)",
    `select count(pvcod) as total_pedido, pvconfirmado, pvcanal, sum(pvvl) as vl_total
       from pv
      group by pv.pvconfirmado, pv.pvcanal
      order by pv.pvcanal`
  );
  await explain(
    "/v2/pedidos/total (datas explícitas)",
    `select count(pvcod) as total_pedido, pvconfirmado, pvcanal, sum(pvvl) as vl_total
       from pv
      where pvdtcad between DATE '2026-08-22' and DATE '2026-09-20'
      group by pv.pvconfirmado, pv.pvcanal
      order by pv.pvcanal`
  );

  // 8) /v2/pedidos/total/anual — ANTES x DEPOIS
  await explain(
    "/v2/pedidos/total/anual ANTES (extract year)",
    `select extract(month from pvdtcad) as mes, count(pvcod) as total_pedido_mes, pvconfirmado, pvcanal, sum(pvvl) as vl_total_mes
       from pv
      where extract(year from pvdtcad) = extract(year from current_date)
      group by pv.pvconfirmado, pv.pvcanal, extract(month from pvdtcad)
      order by extract(month from pvdtcad), pv.pvcanal`
  );
  await explain(
    "/v2/pedidos/total/anual DEPOIS (date_trunc, sargável)",
    `select extract(month from pvdtcad) as mes, count(pvcod) as total_pedido_mes, pvconfirmado, pvcanal, sum(pvvl) as vl_total_mes
       from pv
      where pvdtcad >= date_trunc('year', current_date)
      group by pv.pvconfirmado, pv.pvcanal, extract(month from pvdtcad)
      order by extract(month from pvdtcad), pv.pvcanal`
  );

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
