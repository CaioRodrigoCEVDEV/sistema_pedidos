const relatoriosModels = require("../models/relatoriosModels");
const { criarTopPecasPdf } = require("../utils/topPecasPdf");
const ExcelJS = require("exceljs");
const { formatarTopPecasExcel } = require("../utils/topPecasExcel");
const PDFDocument = require("pdfkit");
const { parseIntegerParam } = require("../utils/parseIntegerParam");

// Constants
const PDF_PAGE_BREAK_Y = 700;

/**
 * Controlador de Relatórios
 *
 * Endpoints para gerar relatórios de vendas com múltiplos formatos de exportação
 */

/**
 * GET /v2/relatorios/top-pecas
 * Retorna dados JSON do relatório Top Peças
 */
exports.getTopPecasJSON = async (req, res) => {
  try {
    const { dataInicio, dataFim, marca, groupBy } = req.query;

    const filters = {
      dataInicio,
      dataFim,
      marca: parseIntegerParam(marca),
      groupBy: groupBy || "peca",
    };

    const result = await relatoriosModels.getTopPecas(filters);
    res.status(200).json(result);
  } catch (error) {
    console.error("Erro ao buscar top peças:", error);
    res.status(500).json({ error: "Erro ao buscar relatório de top peças" });
  }
};

/**
 * GET /v2/relatorios/top-pecas/pdf
 * Exporta relatório em formato PDF
 */
exports.getTopPecasPDF = async (req, res) => {
  try {
    const { dataInicio, dataFim, marca, groupBy } = req.query;

    const filters = {
      dataInicio,
      dataFim,
      marca: parseIntegerParam(marca),
      groupBy: groupBy || "peca",
    };

    const data = await relatoriosModels.getTopPecas(filters);

    const doc = criarTopPecasPdf(data, filters);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="top-pecas.pdf"');
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro ao gerar PDF" });
    }
  }
};

/**
 * GET /v2/relatorios/top-pecas/xls
 * Exporta relatório em formato Excel (XLSX)
 */
exports.getTopPecasXLS = async (req, res) => {
  try {
    const { dataInicio, dataFim, marca, groupBy } = req.query;

    const filters = {
      dataInicio,
      dataFim,
      marca: parseIntegerParam(marca),
      groupBy: groupBy || "peca",
    };

    const data = await relatoriosModels.getTopPecas(filters);

    // Cria workbook do Excel
    const workbook = new ExcelJS.Workbook();
    formatarTopPecasExcel(workbook, data, filters);

    // Define headers para download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="top-pecas.xlsx"',
    );

    // Escreve o Excel na resposta
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Erro ao gerar Excel:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro ao gerar Excel" });
    }
  }
};

/**
 * GET /v2/relatorios/estoque-grupos
 * Retorna grupos de compatibilidade vinculados às peças mais vendidas
 * com estoque atual e quantidade ideal
 */
exports.getEstoqueGruposJSON = async (req, res) => {
  try {
    const { dataInicio, dataFim, marca } = req.query;

    const filters = {
      dataInicio,
      dataFim,
      marca: parseIntegerParam(marca),
    };

    const result = await relatoriosModels.getEstoqueGruposTopPecas(filters);
    res.status(200).json(result);
  } catch (error) {
    console.error("Erro ao buscar estoque de grupos:", error);
    res.status(500).json({ error: "Erro ao buscar estoque de grupos" });
  }
};
exports.getPecasCadastradasJSON = async (req, res) => {
  try {
    const { marca, modelo, peca, tipo } = req.query;
    const filters = {
      marca: parseIntegerParam(marca),
      modelo: parseIntegerParam(modelo),
      peca: peca || null,
      tipo: parseIntegerParam(tipo),
    };
    const result = await relatoriosModels.getPecasCadastradas(filters);
    res.status(200).json(result);
  } catch (error) {
    console.error("Erro ao buscar peças cadastradas:", error);
    res.status(500).json({ error: "Erro ao buscar peças cadastradas" });
  }
};

/**
 * GET /v2/relatorios/pecas-cadastradas/pdf
 * Exporta peças cadastradas em PDF com filtros opcionais
 */
exports.getPecasCadastradasPDF = async (req, res) => {
  try {
    const { marca, modelo, peca, tipo } = req.query;
    const filters = {
      marca: parseIntegerParam(marca),
      modelo: parseIntegerParam(modelo),
      peca: peca || null,
      tipo: parseIntegerParam(tipo),
    };

    const data = await relatoriosModels.getPecasCadastradas(filters);

    const doc = new PDFDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="pecas-cadastradas.pdf"',
    );

    doc.pipe(res);

    // Cabeçalho
    doc.fontSize(16).font("Helvetica-Bold").text("Peças Cadastradas", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica");

    // Filtros aplicados
    const filtrosTexto = [];
    if (marca) filtrosTexto.push(`Marca ID: ${marca}`);
    if (modelo) filtrosTexto.push(`Modelo ID: ${modelo}`);
    if (peca) filtrosTexto.push(`Peça: ${peca}`);
    if (tipo) {
      const tipoNome = data.length > 0 && data[0].tipo ? data[0].tipo : `ID: ${tipo}`;
      filtrosTexto.push(`Tipo: ${tipoNome}`);
    }
    if (filtrosTexto.length > 0) {
      doc.text(`Filtros: ${filtrosTexto.join(" | ")}`, { align: "center" });
    }
    doc.text(`Total de peças: ${data.length} | Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, { align: "center" });
    doc.moveDown(0.5);

    // Cabeçalho da tabela
    const colX = { num: 40, marca: 65, modelo: 165, tipo: 255, peca: 325, preco: 475 };
    const ROW_PADDING_Y = 3;

    function drawTableHeader(d, y) {
      d.fontSize(8).font("Helvetica-Bold");
      d.rect(40, y - 2, 515, 14).fill("#DDDDDD");
      d.fillColor("black");
      d.text("#", colX.num, y, { width: 20 });
      d.text("Marca", colX.marca, y, { width: 95 });
      d.text("Modelo", colX.modelo, y, { width: 85 });
      d.text("Tipo", colX.tipo, y, { width: 65 });
      d.text("Peça", colX.peca, y, { width: 145 });
      d.text("Preço", colX.preco, y, { width: 80 });
      d.moveDown(0.8);
      d.font("Helvetica").fontSize(7);
    }

    drawTableHeader(doc, doc.y);

    let rowNum = 1;
    for (const row of data) {
      const precoFmt = Number(row.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

      // Calculate dynamic row height so wrapped text never overlaps the next row
      const rowHeight = Math.max(
        doc.heightOfString(String(rowNum), { width: 20 }),
        doc.heightOfString(String(row.marca || "-"), { width: 95 }),
        doc.heightOfString(String(row.modelo || "-"), { width: 85 }),
        doc.heightOfString(String(row.tipo || "-"), { width: 65 }),
        doc.heightOfString(String(row.peca || "-"), { width: 145 }),
        doc.heightOfString(precoFmt, { width: 80 }),
      );

      if (doc.y + rowHeight > PDF_PAGE_BREAK_Y) {
        doc.addPage();
        drawTableHeader(doc, doc.y);
      }

      const y = doc.y;
      doc.text(String(rowNum), colX.num, y, { width: 20 });
      doc.text(String(row.marca || "-"), colX.marca, y, { width: 95 });
      doc.text(String(row.modelo || "-"), colX.modelo, y, { width: 85 });
      doc.text(String(row.tipo || "-"), colX.tipo, y, { width: 65 });
      doc.text(String(row.peca || "-"), colX.peca, y, { width: 145 });
      doc.text(precoFmt, colX.preco, y, { width: 80, align: "right" });

      // Advance by the tallest cell so no row ever overlaps the next
      doc.y = y + rowHeight + ROW_PADDING_Y;
      rowNum++;
    }

    doc.end();
  } catch (error) {
    console.error("Erro ao gerar PDF de peças:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro ao gerar PDF de peças" });
    }
  }
};
