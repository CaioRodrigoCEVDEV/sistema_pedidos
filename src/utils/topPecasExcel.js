function formatarTopPecasExcel(workbook, data, filters = {}) {
  const sheet = workbook.addWorksheet("Top Peças", {
    views: [{ state: "frozen", ySplit: 6, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true,
      fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:6" },
  });
  const columns = [
    { header: "Tipo", key: "tipo", width: 22 },
    { header: "Marca", key: "marca", width: 22 },
    { header: "Peça", key: "peca", width: 48 },
    { header: "Qtde vendida", key: "qtde_vendida", width: 17 },
    { header: "Modelo", key: "modelo", width: 30 },
    { header: "Grupo", key: "grupo", width: 42 },
    { header: "Custo", key: "custo", width: 19 },
  ];
  sheet.columns = columns.map(({ key, width }) => ({ key, width }));
  const blue = "FF2563EB", ink = "FF162033", muted = "FF64748B";
  const date = (value) => value ? String(value).split("-").reverse().join("/") : null;
  const period = filters.dataInicio || filters.dataFim
    ? `${date(filters.dataInicio) || "Início"} a ${date(filters.dataFim) || "Hoje"}` : "Todo o período";
  const headings = [
    "Top Peças",
    `Período: ${period} | ${filters.groupBy === "grupo" ? "Por grupo" : "Por peça"}${filters.marca ? ` | Marca: ${filters.marca}` : ""}`,
    "Ordenação: tipo da peça / marca / peça",
    `${data.length} registros | Emitido em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
  ];
  headings.forEach((text, i) => {
    sheet.mergeCells(i + 1, 1, i + 1, 7);
    const cell = sheet.getCell(i + 1, 1);
    cell.value = text;
    cell.font = { name: "Calibri", size: i === 0 ? 22 : 11, bold: i === 0,
      color: { argb: i === 0 ? "FFFFFFFF" : muted } };
    cell.alignment = { vertical: "middle", wrapText: true, indent: 1 };
    if (i === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: blue } };
    sheet.getRow(i + 1).height = i === 0 ? 42 : 25;
  });
  sheet.getRow(5).height = 10;
  const header = sheet.getRow(6);
  header.values = columns.map((column) => column.header);
  header.height = 30;
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: blue } };
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", wrapText: true, indent: 1 };
  });
  data.forEach((record, index) => {
    const row = sheet.addRow(columns.map(({ key }) => {
      const value = record[key];
      if (key === "qtde_vendida" || key === "custo") {
        return value == null || value === "" ? null : Number(value);
      }
      return value || "-";
    }));
    row.height = Math.min(409, Math.max(30, ...columns.map(({ key, width }) =>
      Math.ceil(String(record[key] ?? "").length / (width - 4)) * 16 + 12)));
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { name: "Calibri", size: 11, color: { argb: ink } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 ? "FFF1F5FB" : "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", wrapText: true, horizontal: col === 4 || col === 7 ? "right" : "left", indent: 1 };
      cell.border = { bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
    });
    row.getCell(4).numFmt = "#,##0.####";
    row.getCell(7).numFmt = '"R$" #,##0.00';
  });
  sheet.autoFilter = { from: "A6", to: `G${Math.max(6, data.length + 6)}` };
  if (!data.length) {
    sheet.mergeCells("A7:G7");
    sheet.getCell("A7").value = "Nenhum registro encontrado para os filtros selecionados.";
    sheet.getCell("A7").font = { name: "Calibri", size: 11, color: { argb: muted } };
    sheet.getRow(7).height = 30;
  }
  sheet.pageSetup.printArea = `A1:G${Math.max(7, data.length + 6)}`;
  sheet.headerFooter.oddFooter = "&LTop Peças&R Página &P de &N";
  return sheet;
}

module.exports = { formatarTopPecasExcel };
