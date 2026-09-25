const PDFDocument = require("pdfkit");

// Mesmo conjunto e ordem de registros da consulta exibida na tela.
function criarTopPecasPdf(data, filters = {}) {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, bufferPages: true });
  doc.info.Title = "Top Peças";
  const blue = "#2563EB", ink = "#162033", muted = "#64748B";
  const width = doc.page.width - 72;
  const columns = [
    ["Tipo", "tipo", 78], ["Marca", "marca", 76], ["Peça", "peca", 180],
    ["Qtd.", "qtde_vendida", 48], ["Modelo", "modelo", 110],
    ["Grupo", "grupo", width - 564], ["Custo", "custo", 72],
  ];
  const date = (value) => value ? String(value).split("-").reverse().join("/") : null;
  const period = [date(filters.dataInicio) || "Início", date(filters.dataFim) || "Hoje"].join(" a ");
  const issued = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  let y;
  function heading() {
    doc.rect(0, 0, doc.page.width, 7).fill(blue);
    doc.fillColor(blue).font("Helvetica-Bold").fontSize(9).text("RELATÓRIOS / VENDAS", 36, 27);
    doc.fillColor(ink).fontSize(24).text("Top Peças", 36, 46);
    doc.font("Helvetica").fontSize(9).fillColor(muted)
      .text(`Período: ${filters.dataInicio || filters.dataFim ? period : "Todo o período"}   |   ${filters.groupBy === "grupo" ? "Por grupo" : "Por peça"}${filters.marca ? `   |   Marca: ${filters.marca}` : ""}`, 36, 81, { width });
    doc.text("Ordenação: tipo da peça / marca / peça", 36, 98);
    doc.font("Helvetica-Bold").fillColor(ink).text(`${data.length} registros`, 36, 117);
    y = 140;
    doc.rect(36, y, width, 27).fill(blue);
    let x = 36;
    columns.forEach(([label, , w]) => {
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9).text(label, x + 8, y + 8, { width: w - 16 });
      x += w;
    });
    y += 27;
  }
  // Quebra inclusive nomes muito longos, sem cortar dados ou invadir o rodape.
  function lines(value, w) {
    const result = [];
    let line = "";
    for (const word of String(value ?? "-").split(/\s+/)) {
      if (line && doc.widthOfString(`${line} ${word}`) > w) { result.push(line); line = ""; }
      for (const char of (line ? " " : "") + word) {
        if (doc.widthOfString(line + char) > w && line) { result.push(line); line = ""; }
        line += char;
      }
    }
    result.push(line || "-");
    return result;
  }
  heading();
  data.forEach((row, index) => {
    doc.font("Helvetica").fontSize(9);
    const cells = columns.map(([, key, w]) => {
      const value = key === "custo" ? (row.custo == null ? "-" : Number(row.custo).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))
        : key === "qtde_vendida" ? Number(row[key] || 0).toLocaleString("pt-BR") : row[key] || "-";
      return lines(value, w - 16);
    });
    let offset = 0;
    const count = Math.max(...cells.map((cell) => cell.length));
    const bottom = doc.page.height - 48;
    if (y + count * 12 + 16 > bottom && count * 12 + 16 <= bottom - 167) { doc.addPage(); heading(); }
    while (offset < count) {
      let available = Math.floor((bottom - y - 16) / 12);
      if (available < 1) { doc.addPage(); heading(); available = Math.floor((bottom - y - 16) / 12); }
      const take = Math.min(available, count - offset), height = take * 12 + 16;
      doc.rect(36, y, width, height).fill(index % 2 ? "#F1F5FB" : "#FFFFFF");
      let x = 36;
      columns.forEach(([, key, w], col) => {
        doc.font("Helvetica").fontSize(9).fillColor(ink);
        cells[col].slice(offset, offset + take).forEach((line, i) => {
          doc.text(line, x + 8, y + 8 + i * 12, { width: w - 16, lineBreak: false, align: ["custo", "qtde_vendida"].includes(key) ? "right" : "left" });
        });
        x += w;
      });
      y += height;
      doc.moveTo(36, y).lineTo(36 + width, y).strokeColor("#E2E8F0").lineWidth(.5).stroke();
      offset += take;
    }
  });
  if (!data.length) doc.fillColor(muted).font("Helvetica").fontSize(11).text("Nenhum registro encontrado para os filtros selecionados.", 44, y + 20);
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const marginBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const bottom = doc.page.height - 32;
    doc.fillColor(muted).font("Helvetica").fontSize(8)
      .text(`Emitido em ${issued}`, 36, bottom, { lineBreak: false })
      .text(`Página ${i + 1} de ${range.count}`, doc.page.width - 140, bottom, { width: 104, align: "right", lineBreak: false });
    doc.page.margins.bottom = marginBottom;
  }
  return doc;
}

module.exports = { criarTopPecasPdf };
