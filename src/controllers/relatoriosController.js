const relatoriosModels = require("../models/relatoriosModels");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

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
      marca: marca ? parseInt(marca) : null,
      groupBy: groupBy || 'peca'
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
      marca: marca ? parseInt(marca) : null,
      groupBy: groupBy || 'peca'
    };

    const data = await relatoriosModels.getTopPecas(filters);

    // Cria documento PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Define headers para download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="top-pecas.pdf"');
    
    // Pipe o PDF para a resposta
    doc.pipe(res);

    // Título
    doc.fontSize(18).text('Relatório: Top Peças', { align: 'center' });
    doc.moveDown();

    // Informações do filtro
    doc.fontSize(10);
    if (dataInicio) doc.text(`Data Início: ${dataInicio}`);
    if (dataFim) doc.text(`Data Fim: ${dataFim}`);
    if (marca) doc.text(`Marca: ${marca}`);
    doc.text(`Agrupamento: ${groupBy === 'grupo' ? 'Por Grupo' : 'Por Peça'}`);
    doc.moveDown();

    // Cabeçalho da tabela
    doc.fontSize(12).font('Helvetica-Bold');
    const startY = doc.y;
    
    if (groupBy === 'grupo') {
      doc.text('Grupo', 50, startY, { width: 150, continued: false });
      doc.text('Qtde Vendida', 210, startY, { width: 100, continued: false });
      doc.text('Modelo', 320, startY, { width: 120, continued: false });
      doc.text('Peça', 450, startY, { width: 100, continued: false });
    } else {
      doc.text('Peça', 50, startY, { width: 180, continued: false });
      doc.text('Qtde Vendida', 240, startY, { width: 100, continued: false });
      doc.text('Modelo', 350, startY, { width: 120, continued: false });
      doc.text('Grupo', 480, startY, { width: 80, continued: false });
    }
    
    doc.moveDown();
    doc.font('Helvetica').fontSize(10);

    // Dados
    data.forEach((row) => {
      const currentY = doc.y;
      
      // Verifica se precisa de nova página
      if (currentY > PDF_PAGE_BREAK_Y) {
        doc.addPage();
      }
      
      if (groupBy === 'grupo') {
        doc.text(row.grupo || '-', 50, currentY, { width: 150, continued: false });
        doc.text(row.qtde_vendida || '0', 210, currentY, { width: 100, continued: false });
        doc.text(row.modelo || '-', 320, currentY, { width: 120, continued: false });
        doc.text(row.peca || '-', 450, currentY, { width: 100, continued: false });
      } else {
        doc.text(row.peca || '-', 50, currentY, { width: 180, continued: false });
        doc.text(row.qtde_vendida || '0', 240, currentY, { width: 100, continued: false });
        doc.text(row.modelo || '-', 350, currentY, { width: 120, continued: false });
        doc.text(row.grupo || '-', 480, currentY, { width: 80, continued: false });
      }
      
      doc.moveDown(0.5);
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
      marca: marca ? parseInt(marca) : null,
      groupBy: groupBy || 'peca'
    };

    const data = await relatoriosModels.getTopPecas(filters);

    // Cria workbook do Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Top Peças');

    // Define colunas baseado no tipo de agrupamento
    if (groupBy === 'grupo') {
      worksheet.columns = [
        { header: 'Grupo', key: 'grupo', width: 30 },
        { header: 'Qtde Vendida', key: 'qtde_vendida', width: 15 },
        { header: 'Modelo', key: 'modelo', width: 30 },
        { header: 'Peça', key: 'peca', width: 30 }
      ];
    } else {
      worksheet.columns = [
        { header: 'Peça', key: 'peca', width: 30 },
        { header: 'Qtde Vendida', key: 'qtde_vendida', width: 15 },
        { header: 'Modelo', key: 'modelo', width: 30 },
        { header: 'Grupo', key: 'grupo', width: 20 }
      ];
    }

    // Estiliza o cabeçalho
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };

    // Adiciona os dados
    data.forEach((row) => {
      worksheet.addRow(row);
    });

    // Define headers para download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="top-pecas.xlsx"'
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
