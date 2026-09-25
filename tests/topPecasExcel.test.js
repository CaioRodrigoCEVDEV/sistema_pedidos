const assert = require("node:assert/strict");
const { test } = require("node:test");
const ExcelJS = require("exceljs");
const { formatarTopPecasExcel } = require("../src/utils/topPecasExcel");

for (const groupBy of ["peca", "grupo"]) {
  test(`Excel ${groupBy}: preserva dados numericos, ordem, filtros e formatacao ao reabrir`, async () => {
    const workbook = new ExcelJS.Workbook();
    formatarTopPecasExcel(workbook, [
      { tipo: "Bateria", marca: "Samsung", peca: "A01", qtde_vendida: "33", custo: "128.50", grupo: "Grupo A", modelo: "A01" },
      { tipo: "Tela", marca: "Apple", peca: "Peça longa ".repeat(10), qtde_vendida: "0", custo: "0" },
    ], { groupBy, dataInicio: "2026-09-01", dataFim: "2026-09-25" });
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = reopened.getWorksheet("Top Peças");
    assert.deepEqual(sheet.getRow(6).values.slice(1), ["Tipo", "Marca", "Peça", "Qtde vendida", "Modelo", "Grupo", "Custo"]);
    assert.equal(sheet.getCell("A7").value, "Bateria");
    assert.equal(sheet.getCell("A8").value, "Tela");
    assert.equal(sheet.getCell("D7").value, 33);
    assert.equal(sheet.getCell("G7").value, 128.5);
    assert.equal(sheet.getCell("G8").value, 0);
    assert.equal(sheet.getCell("G7").numFmt, '"R$" #,##0.00');
    assert.equal(sheet.autoFilter, "A6:G8");
    assert.equal(sheet.views[0].ySplit, 6);
    assert.equal(sheet.getCell("A6").fill.fgColor.argb, "FF2563EB");
    assert.ok(sheet.getRow(8).height > 30);
    assert.match(sheet.getCell("A2").value, /01\/09\/2026 a 25\/09\/2026/);
  });
}

test("Excel vazio mantem cabecalho e informa ausencia de resultados", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = formatarTopPecasExcel(workbook, []);
  assert.match(sheet.getCell("A7").value, /Nenhum registro/);
  assert.equal(sheet.pageSetup.printArea, "A1:G7");
  await workbook.xlsx.writeBuffer();
});
