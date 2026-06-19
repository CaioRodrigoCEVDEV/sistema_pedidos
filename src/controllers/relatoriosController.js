const relatoriosModels = require("../models/relatoriosModels");
const ExcelJS = require("exceljs");
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

    // Cria documento PDF
    const doc = new PDFDocument({ margin: 50 });

    // Define headers para download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="top-pecas.pdf"',
    );

    // Pipe o PDF para a resposta
    doc.pipe(res);

    // Título
    doc.fontSize(18).text("Relatório: Top Peças", { align: "center" });
    doc.moveDown();

    // Informações do filtro
    doc.fontSize(10);
    if (dataInicio) doc.text(`Data Início: ${dataInicio}`);
    if (dataFim) doc.text(`Data Fim: ${dataFim}`);
    if (marca) doc.text(`Marca: ${marca}`);
    doc.text(`Agrupamento: ${groupBy === "grupo" ? "Por Grupo" : "Por Peça"}`);
    doc.moveDown();

    const tableColumns =
      groupBy === "grupo"
        ? [
            { header: "Grupo", key: "grupo", width: 95, align: "left" },
            {
              header: "Qtde Vendida",
              key: "qtde_vendida",
              width: 70,
              align: "center",
            },
            { header: "Modelo", key: "modelo", width: 110, align: "left" },
            { header: "Peça", key: "peca", width: 160, align: "left" },
            { header: "Custo", key: "custo", width: 60, align: "right" },
          ]
        : [
            { header: "Peça", key: "peca", width: 160, align: "left" },
            {
              header: "Qtde Vendida",
              key: "qtde_vendida",
              width: 70,
              align: "center",
            },
            { header: "Modelo", key: "modelo", width: 110, align: "left" },
            { header: "Grupo", key: "grupo", width: 95, align: "left" },
            { header: "Custo", key: "custo", width: 60, align: "right" },
          ];
    const ROW_PADDING_Y = 4;
    const tableX = doc.page.margins.left;

    function getRowHeight(values, fontName = "Helvetica", fontSize = 10) {
      doc.font(fontName).fontSize(fontSize);
      return Math.max(
        ...values.map((value, index) =>
          doc.heightOfString(String(value), {
            width: tableColumns[index].width,
            align: tableColumns[index].align,
          }),
        ),
      );
    }

    function drawRow(values, y, fontName = "Helvetica", fontSize = 10) {
      doc.font(fontName).fontSize(fontSize);
      let currentX = tableX;

      values.forEach((value, index) => {
        const column = tableColumns[index];
        doc.text(String(value), currentX, y, {
          width: column.width,
          align: column.align,
        });
        currentX += column.width;
      });
    }

    const headerValues = tableColumns.map((column) => column.header);
    const headerHeight = getRowHeight(headerValues, "Helvetica-Bold", 10);
    const startY = doc.y;

    drawRow(headerValues, startY, "Helvetica-Bold", 10);
    doc.y = startY + headerHeight + ROW_PADDING_Y;

    // Dados
    data.forEach((row) => {
      const qtde = Number(row.qtde_vendida);
      const custoFormatado =
        row.custo != null
          ? Number(row.custo).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })
          : "-";

      const rowValues =
        groupBy === "grupo"
          ? [
              row.grupo || "-",
              Number.isFinite(qtde) ? String(Math.trunc(qtde)) : "0",
              row.modelo || "-",
              row.peca || "-",
              custoFormatado,
            ]
          : [
              row.peca || "-",
              Number.isFinite(qtde) ? String(Math.trunc(qtde)) : "0",
              row.modelo || "-",
              row.grupo || "-",
              custoFormatado,
            ];

      const rowHeight = getRowHeight(rowValues);

      if (doc.y + rowHeight > PDF_PAGE_BREAK_Y) {
        doc.addPage();
        const headerY = doc.y;
        drawRow(headerValues, headerY, "Helvetica-Bold", 10);
        doc.y = headerY + headerHeight + ROW_PADDING_Y;
      }

      const currentY = doc.y;
      drawRow(rowValues, currentY);
      doc.y = currentY + rowHeight + ROW_PADDING_Y;
    });

    // Finaliza o documento
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
    const worksheet = workbook.addWorksheet("Top Peças");

    // Define colunas baseado no tipo de agrupamento
    if (groupBy === "grupo") {
      worksheet.columns = [
        { header: "Grupo", key: "grupo", width: 30 },
        { header: "Qtde Vendida", key: "qtde_vendida", width: 15 },
        { header: "Modelo", key: "modelo", width: 30 },
        { header: "Peça", key: "peca", width: 30 },
        { header: "Custo", key: "custo", width: 15 },
      ];
    } else {
      worksheet.columns = [
        { header: "Peça", key: "peca", width: 30 },
        { header: "Qtde Vendida", key: "qtde_vendida", width: 15 },
        { header: "Modelo", key: "modelo", width: 30 },
        { header: "Grupo", key: "grupo", width: 20 },
        { header: "Custo", key: "custo", width: 15 },
      ];
    }

    // Estiliza o cabeçalho
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };

    // Adiciona os dados
    data.forEach((row) => {
      worksheet.addRow(row);
    });

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
    const colX = { num: 40, marca: 65, modelo: 165, tipo: 255, peca: 325, preco: 430, custo: 480, estoque: 535 };
    const ROW_PADDING_Y = 3;

    function drawTableHeader(d, y) {
      d.fontSize(8).font("Helvetica-Bold");
      d.rect(40, y - 2, 515, 14).fill("#DDDDDD");
      d.fillColor("black");
      d.text("#", colX.num, y, { width: 20 });
      d.text("Marca", colX.marca, y, { width: 95 });
      d.text("Modelo", colX.modelo, y, { width: 85 });
      d.text("Tipo", colX.tipo, y, { width: 65 });
      d.text("Peça", colX.peca, y, { width: 100 });
      d.text("Preço", colX.preco, y, { width: 45 });
      d.text("Custo", colX.custo, y, { width: 45 });
      d.text("Estoque", colX.estoque, y, { width: 45 });
      d.moveDown(0.8);
      d.font("Helvetica").fontSize(7);
    }

    drawTableHeader(doc, doc.y);

    let rowNum = 1;
    for (const row of data) {
      const precoFmt = Number(row.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const custoFmt = Number(row.custo).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

      // Calculate dynamic row height so wrapped text never overlaps the next row
      const rowHeight = Math.max(
        doc.heightOfString(String(rowNum), { width: 20 }),
        doc.heightOfString(String(row.marca || "-"), { width: 95 }),
        doc.heightOfString(String(row.modelo || "-"), { width: 85 }),
        doc.heightOfString(String(row.tipo || "-"), { width: 65 }),
        doc.heightOfString(String(row.peca || "-"), { width: 100 }),
        doc.heightOfString(precoFmt, { width: 45 }),
        doc.heightOfString(custoFmt, { width: 45 }),
        doc.heightOfString(String(row.estoque ?? 0), { width: 45 }),
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
      doc.text(String(row.peca || "-"), colX.peca, y, { width: 100 });
      doc.text(precoFmt, colX.preco, y, { width: 45, align: "right" });
      doc.text(custoFmt, colX.custo, y, { width: 45, align: "right" });
      doc.text(String(row.estoque ?? 0), colX.estoque, y, { width: 45, align: "center" });

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
