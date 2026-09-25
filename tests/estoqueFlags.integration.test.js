// Executa o SQL real com dados sinteticos em CTEs, sem alterar tabelas ou saldos.
// Uso: node --test tests/estoqueFlags.integration.test.js
const assert = require("node:assert/strict");
const { test } = require("node:test");
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });
const pool = require("../src/config/db");
const { buildFlagsGestao } = require("../src/utils/estoqueFlagsSql");

test("Flags reais no PostgreSQL respeitam grupo, cores e estoque simples", async (t) => {
  const client = await pool.connect();
  // id, saldo geral, sem estoque manual, acabando manual
  const products = [
    [1, 10, "S", "S"], [2, 0, "N", "S"], [3, 3, "S", "N"],
    [4, 0, "S", "N"], [5, 100, "N", "S"], [6, 0, "S", "N"],
    [7, 0, "N", "S"], [8, 50, "N", "N"], [9, 0, "S", "N"],
    [10, 0, "S", "N"], [11, 0, "S", "N"], [12, 8, "S", "N"],
    [13, 0, "N", "N"], [14, null, "N", "S"], [15, -2, "N", "S"],
    [16, 0, "N", "N"],
  ].map(([procod, proqtde, prosemest, proacabando]) => ({ procod, proqtde, prosemest, proacabando }));
  const colors = [
    [41, 4, null, 0, "S"], [51, 5, 0, 100, "N"],
    [61, 6, 1, 4, "S"], [71, 7, 1, 0, "N"],
    [81, 8, 1, 0, "N"], [82, 8, 2, 0, "N"],
    [91, 9, 1, 0, "S"], [92, 9, 2, 8, "S"],
    [101, 10, 1, 3, "N"], [102, 10, 2, 3, "N"],
    [111, 11, 1, 0, "S"], [112, 11, 2, 0, "S"],
    [121, 12, null, 0, "S"], [131, 13, 0, 20, "N"],
    [161, 16, 1, 12, "N"], [162, 16, 16, 5, "N"],
  ].map(([procorid, procorprocod, procorcorescod, procorqtde, procorsemest]) => ({
    procorid, procorprocod, procorcorescod, procorqtde, procorsemest,
  }));
  const groups = [{ id: 1, stock_quantity: 2 }, { id: 2, stock_quantity: 0 },
    { id: 3, stock_quantity: 3 }, { id: 4, stock_quantity: 3 },
    { id: 5, stock_quantity: 12 }, { id: 6, stock_quantity: 5 }];
  const links = [[1, 41], [2, 51], [3, 101], [3, 102], [3, 111], [4, 112], [5, 161], [6, 162]]
    .map(([group_id, procorid]) => ({ group_id, procorid }));
  const fixture = `WITH
    pro AS (SELECT * FROM jsonb_to_recordset($1::jsonb)
      AS x(procod int, proqtde numeric, prosemest text, proacabando text)),
    procor AS (SELECT * FROM jsonb_to_recordset($2::jsonb)
      AS x(procorid int, procorprocod int, procorcorescod int, procorqtde numeric, procorsemest text)),
    part_groups AS (SELECT * FROM jsonb_to_recordset($3::jsonb)
      AS x(id int, stock_quantity numeric)),
    part_group_items AS (SELECT * FROM jsonb_to_recordset($4::jsonb)
      AS x(group_id int, procorid int))`;
  const params = [products, colors, groups, links].map((value) => JSON.stringify(value));
  async function calculate(config) {
    const flags = buildFlagsGestao(config);
    return (await client.query(`${fixture} SELECT pro.procod,
      ${flags.disponibilidadeSql} AS sem, ${flags.acabandoSql} AS acabando
      FROM pro ORDER BY pro.procod`, params)).rows;
  }
  try {
    await client.query("BEGIN READ ONLY");
    const rows = await calculate({ usaEstoque: true, estoqueMin: 5 });
    const cases = [
      ["simples ignora flags manuais", "N", "N"],
      ["simples zerado", "S", "N"],
      ["simples acabando", "N", "S"],
      ["grupo positivo com produto zerado", "N", "S"],
      ["grupo zerado prevalece sobre copia positiva", "S", "N"],
      ["cor positiva ignora flag manual sem estoque", "N", "S"],
      ["cor zerada ignora flag manual disponivel", "S", "N"],
      ["todas as cores zeradas ignoram saldo geral", "S", "N"],
      ["uma cor positiva mantem disponibilidade geral", "N", "N"],
      ["grupo compartilhado nao duplica saldo", "N", "S"],
      ["grupos distintos no minimo geram aviso mesmo com total maior", "N", "S"],
      ["cadastro auxiliar sem cor usa saldo geral", "N", "N"],
      ["cor zero sem grupo nao substitui saldo geral", "S", "N"],
      ["saldo nulo", "S", "N"],
      ["saldo negativo", "S", "N"],
      ["dourado 5 e preto 12 mostra acabando", "N", "S"],
    ];
    for (const [index, [name, sem, acabando]] of cases.entries()) {
      await t.test(name, () => assert.deepEqual(rows[index], { procod: index + 1, sem, acabando }));
    }
    await t.test("minimo inclusivo e configuravel", async () => {
      assert.equal((await calculate({ usaEstoque: true, estoqueMin: 3 }))[2].acabando, "S");
      assert.equal((await calculate({ usaEstoque: true, estoqueMin: 2 }))[2].acabando, "N");
      assert.ok((await calculate({ usaEstoque: true, estoqueMin: 0 })).every((row) => row.acabando === "N"));
    });
    await t.test("desativado preserva marcacoes manuais na gestao", async () => {
      const manual = await calculate({ usaEstoque: false, estoqueMin: 5 });
      assert.deepEqual(manual, products.map((p) => ({ procod: p.procod, sem: p.prosemest, acabando: p.proacabando })));
    });
    await t.test("dourado 4 ainda avisa; dourado zerado com preto 12 nao indica falta geral", async () => {
      for (const [saldo, acabando] of [[4, "S"], [0, "N"], [6, "N"]]) {
        params[2] = JSON.stringify(groups.map((g) => g.id === 6 ? { ...g, stock_quantity: saldo } : g));
        assert.deepEqual((await calculate({ usaEstoque: true, estoqueMin: 5 }))[15],
          { procod: 16, sem: "N", acabando });
      }
    });
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
