const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildFlagsEstoqueSql } = require("../src/utils/estoqueFlagsSql");
const { normalizar } = require("../src/utils/estoqueConfig");

test("Empresa sem controle de estoque usa as flags manuais salvas", () => {
  const flags = buildFlagsEstoqueSql({ usaEstoque: false, estoqueMin: 5 });
  assert.match(flags.disponibilidadeSql, /pro\.prosemest/);
  assert.match(flags.acabandoSql, /pro\.proacabando/);
  assert.doesNotMatch(flags.acabandoSql, /pro\.proqtde/);
});

test("Empresa com controle calcula as flags pelo estoque", () => {
  const flags = buildFlagsEstoqueSql({ usaEstoque: true, estoqueMin: 3 });
  assert.match(flags.disponibilidadeSql, /pro\.proqtde/);
  assert.match(flags.acabandoSql, /pro\.proqtde/);
  assert.match(flags.acabandoSql, /<= 3/);
  assert.doesNotMatch(flags.acabandoSql, /pro\.proacabando/);
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
