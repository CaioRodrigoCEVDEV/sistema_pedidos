const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildFlagsEstoqueSql } = require("../src/utils/estoqueFlagsSql");
const { normalizar } = require("../src/utils/estoqueConfig");

test("Empresa sem controle de estoque zera as flags", () => {
  const flags = buildFlagsEstoqueSql({ usaEstoque: false, estoqueMin: 5 });
  assert.equal(flags.disponibilidadeSql, "'N'");
  assert.equal(flags.acabandoSql, "'N'");
});

test("Empresa com controle calcula acabando pelo minimo configurado", () => {
  const flags = buildFlagsEstoqueSql({ usaEstoque: true, estoqueMin: 3 });
  assert.match(flags.disponibilidadeSql, /pro\.prosemest/);
  assert.match(flags.acabandoSql, /pro\.proqtde/);
  assert.match(flags.acabandoSql, /<= 3/);
});

test("A quantidade minima invalida cai para o padrao 5", () => {
  const flags = buildFlagsEstoqueSql({ usaEstoque: true, estoqueMin: -1 });
  assert.match(flags.acabandoSql, /<= 5/);
});

test("normalizar valida as entradas", () => {
  assert.deepEqual(normalizar("s", 2), {
    usaEstoque: true,
    empusaest: "S",
    estoqueMin: 2,
  });
  assert.equal(normalizar("x", -1).estoqueMin, 5);
  assert.equal(normalizar(null, null).usaEstoque, false);
});
