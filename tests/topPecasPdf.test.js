const assert = require("node:assert/strict");
const { test } = require("node:test");
const { criarTopPecasPdf } = require("../src/utils/topPecasPdf");

test("Rodapes nao acrescentam paginas extras ao relatorio", () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({ tipo: "Tela", marca: "Marca", peca: `Peça ${i}`, qtde_vendida: 1 }));
  const doc = criarTopPecasPdf(rows);
  // Cabecalho ate 167pt; area util ate 547pt; cada linha curta ocupa 28pt.
  assert.equal(doc.bufferedPageRange().count, 4);
  doc.resume();
  doc.end();
});

test("Relatorio vazio tem apenas uma pagina", () => {
  const doc = criarTopPecasPdf([]);
  assert.equal(doc.bufferedPageRange().count, 1);
  doc.resume();
  doc.end();
});

test("Descricao maior que uma pagina e dividida sem travar a exportacao", () => {
  const doc = criarTopPecasPdf([{ peca: "Descrição extensa ".repeat(250), qtde_vendida: 2 }]);
  const pages = doc.bufferedPageRange().count;
  assert.ok(pages > 1 && pages < 20);
  doc.resume();
  doc.end();
});
