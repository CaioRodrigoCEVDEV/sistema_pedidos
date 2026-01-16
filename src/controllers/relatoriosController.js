const pool = require("../config/db");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

/**
 * Controller para relatórios administrativos
 * Implementa endpoints para relatório de Top Peças (peças mais vendidas)
 */

/**
 * Busca dados do relatório Top Peças com filtros
 * @param {Object} filters - { dataInicio, dataFim, marca, groupBy }
 * @returns {Array} Lista de peças/grupos com quantidade vendida
 */
async function getTopPecasData(filters) {
  const { dataInicio, dataFim, marca, groupBy } = filters;
  const params = [];
  const whereClauses = ["pv.pvsta = 'A'", "pv.pvconfirmado = 'S'"];

  // Filtro de data
  if (dataInicio) {
    params.push(dataInicio);
    whereClauses.push(`pv.pvdtcad >= $${params.length}`);
  }
  if (dataFim) {
    params.push(dataFim);
    whereClauses.push(`pv.pvdtcad <= $${params.length}`);
  }

  // Filtro de marca
  if (marca && marca !== "todas") {
    params.push(marca);
    whereClauses.push(`pro.promarcascod = $${params.length}`);
  }

  const whereClause = whereClauses.join(" AND ");

  let query;
  if (groupBy === "grupo") {
    // Agrupamento por grupo de compatibilidade
    query = `
      SELECT 
        COALESCE(pg.name, 'Sem Grupo') as grupo,
        COALESCE(pg.id::text, '') as grupo_id,
        COUNT(DISTINCT pro.procod) as qtde_pecas_no_grupo,
        SUM(pvi.pviqtde) as qtde_vendida,
        string_agg(DISTINCT marcas.marcasdes, ', ' ORDER BY marcas.marcasdes) as marcas,
        string_agg(DISTINCT 
          (SELECT string_agg(m.moddes, ', ' ORDER BY m.moddes)
           FROM promod pm
           JOIN modelo m ON pm.promodmodcod = m.modcod
           WHERE pm.promodprocod = pro.procod
           LIMIT 1), 
          ', '
        ) as modelos
      FROM pvi
      JOIN pv ON pv.pvcod = pvi.pvipvcod
      JOIN pro ON pro.procod = pvi.pviprocod
      JOIN marcas ON marcas.marcascod = pro.promarcascod
      LEFT JOIN part_groups pg ON pg.id = pro.part_group_id
      WHERE ${whereClause}
      GROUP BY pg.id, pg.name
      ORDER BY qtde_vendida DESC
    `;
  } else {
    // Sem agrupamento - lista de peças individuais
    query = `
      SELECT 
        pro.procod,
        pro.prodes as peca,
        SUM(pvi.pviqtde) as qtde_vendida,
        marcas.marcasdes as marca,
        (
          SELECT string_agg(m.moddes, ', ' ORDER BY m.moddes)
          FROM promod pm
          JOIN modelo m ON pm.promodmodcod = m.modcod
          WHERE pm.promodprocod = pro.procod
        ) as modelo,
        COALESCE(pg.name, '') as grupo
      FROM pvi
      JOIN pv ON pv.pvcod = pvi.pvipvcod
      JOIN pro ON pro.procod = pvi.pviprocod
      JOIN marcas ON marcas.marcascod = pro.promarcascod
      LEFT JOIN part_groups pg ON pg.id = pro.part_group_id
      WHERE ${whereClause}
      GROUP BY pro.procod, pro.prodes, marcas.marcasdes, pg.name
      ORDER BY qtde_vendida DESC
    `;
  }

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * GET /v2/relatorios/top-pecas
 * Retorna JSON com dados do relatório
 */
exports.getTopPecas = async (req, res) => {
  try {
    const { dataInicio, dataFim, marca, groupBy } = req.query;
    const data = await getTopPecasData({
      dataInicio,
      dataFim,
      marca,
      groupBy: groupBy || "peca",
    });
    res.status(200).json(data);
  } catch (error) {
    console.error("Erro ao buscar top peças:", error);
    res.status(500).json({ error: "Erro ao buscar relatório de top peças" });
  }
};

/**
 * GET /v2/relatorios/top-pecas/pdf
 * Gera e retorna PDF do relatório
 */
exports.getTopPecasPDF = async (req, res) => {
  try {
    const { dataInicio, dataFim, marca, groupBy } = req.query;
    const data = await getTopPecasData({
      dataInicio,
      dataFim,
      marca,
      groupBy: groupBy || "peca",
    });

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    
    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=top-pecas-${Date.now()}.pdf`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Title
    doc.fontSize(18).text("Relatório - Top Peças", { align: "center" });
    doc.moveDown();

    // Filters info
    doc.fontSize(10);
    if (dataInicio || dataFim) {
      const periodo = `Período: ${dataInicio || "início"} até ${dataFim || "hoje"}`;
      doc.text(periodo);
    }
    if (marca && marca !== "todas") {
      doc.text(`Marca: ${marca}`);
    }
    doc.text(`Agrupamento: ${groupBy === "grupo" ? "Por Grupo" : "Por Peça"}`);
    doc.moveDown();

    // Table headers
    doc.fontSize(9).font("Helvetica-Bold");
    const startY = doc.y;
    
    if (groupBy === "grupo") {
      doc.text("Grupo", 50, startY, { width: 200 });
      doc.text("Qtde Vendida", 260, startY, { width: 80 });
      doc.text("Modelos", 350, startY, { width: 180 });
    } else {
      doc.text("Peça", 50, startY, { width: 180 });
      doc.text("Qtde Vendida", 240, startY, { width: 80 });
      doc.text("Modelo", 330, startY, { width: 120 });
      doc.text("Grupo", 460, startY, { width: 80 });
    }
    
    doc.moveDown();
    doc.font("Helvetica").fontSize(8);

    // Table data
    data.forEach((row) => {
      const currentY = doc.y;
      
      // Check if we need a new page
      if (currentY > 700) {
        doc.addPage();
      }
      
      if (groupBy === "grupo") {
        doc.text(row.grupo || "Sem Grupo", 50, doc.y, { width: 200 });
        doc.text(row.qtde_vendida.toString(), 260, currentY, { width: 80 });
        doc.text(row.modelos || "-", 350, currentY, { width: 180 });
      } else {
        doc.text(row.peca || "-", 50, doc.y, { width: 180 });
        doc.text(row.qtde_vendida.toString(), 240, currentY, { width: 80 });
        doc.text(row.modelo || "-", 330, currentY, { width: 120 });
        doc.text(row.grupo || "-", 460, currentY, { width: 80 });
      }
      
      doc.moveDown(0.5);
    });

    // Finalize PDF
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
 * Gera e retorna Excel do relatório
 */
exports.getTopPecasXLS = async (req, res) => {
  try {
    const { dataInicio, dataFim, marca, groupBy } = req.query;
    const data = await getTopPecasData({
      dataInicio,
      dataFim,
      marca,
      groupBy: groupBy || "peca",
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Top Peças");

    // Add title and filters
    worksheet.mergeCells("A1:D1");
    worksheet.getCell("A1").value = "Relatório - Top Peças";
    worksheet.getCell("A1").font = { bold: true, size: 16 };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    let row = 3;
    if (dataInicio || dataFim) {
      worksheet.getCell(`A${row}`).value = `Período: ${dataInicio || "início"} até ${dataFim || "hoje"}`;
      row++;
    }
    if (marca && marca !== "todas") {
      worksheet.getCell(`A${row}`).value = `Marca: ${marca}`;
      row++;
    }
    worksheet.getCell(`A${row}`).value = `Agrupamento: ${groupBy === "grupo" ? "Por Grupo" : "Por Peça"}`;
    row += 2;

    // Add headers
    const headerRow = worksheet.getRow(row);
    headerRow.font = { bold: true };
    
    if (groupBy === "grupo") {
      headerRow.values = ["Grupo", "Qtde Vendida", "Modelos", "Marcas"];
      worksheet.columns = [
        { key: "grupo", width: 30 },
        { key: "qtde_vendida", width: 15 },
        { key: "modelos", width: 40 },
        { key: "marcas", width: 30 },
      ];
    } else {
      headerRow.values = ["Peça", "Qtde Vendida", "Modelo", "Grupo"];
      worksheet.columns = [
        { key: "peca", width: 30 },
        { key: "qtde_vendida", width: 15 },
        { key: "modelo", width: 40 },
        { key: "grupo", width: 20 },
      ];
    }
    
    row++;

    // Add data
    data.forEach((item) => {
      const dataRow = worksheet.getRow(row);
      if (groupBy === "grupo") {
        dataRow.values = [
          item.grupo || "Sem Grupo",
          item.qtde_vendida,
          item.modelos || "-",
          item.marcas || "-",
        ];
      } else {
        dataRow.values = [
          item.peca || "-",
          item.qtde_vendida,
          item.modelo || "-",
          item.grupo || "-",
        ];
      }
      row++;
    });

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=top-pecas-${Date.now()}.xlsx`
    );

    // Send workbook
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Erro ao gerar Excel:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro ao gerar Excel" });
    }
  }
};
