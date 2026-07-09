const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const dbModulePath = path.join(repoRoot, "src/config/db.js");
const modelModulePath = path.join(repoRoot, "src/models/relatoriosModels.js");
const controllerModulePath = path.join(
  repoRoot,
  "src/controllers/relatoriosController.js",
);
const pdfkitModulePath = require.resolve("pdfkit");

async function testGetPecasCadastradasQuery() {
  delete require.cache[modelModulePath];

  const pool = require(dbModulePath);
  const originalQuery = pool.query;
  let capturedQuery;
  let capturedParams;

  pool.query = async (query, params) => {
    capturedQuery = query;
    capturedParams = params;
    return { rows: [] };
  };

  try {
    const relatoriosModels = require(modelModulePath);
    await relatoriosModels.getPecasCadastradas({
      marca: 10,
      modelo: 20,
      peca: "Tela",
      tipo: 30,
    });
  } finally {
    pool.query = originalQuery;
    delete require.cache[modelModulePath];
  }

  assert.ok(capturedQuery, "A consulta deve ser executada");
  assert.ok(
    !capturedQuery.includes("as custo"),
    "A consulta não deve selecionar a coluna custo",
  );
  assert.ok(
    !capturedQuery.includes("as estoque"),
    "A consulta não deve selecionar a coluna estoque",
  );
  assert.ok(
    /ORDER BY\s+pro\.prodes,\s+marcas\.marcasdes,\s+COALESCE\(modelo\.moddes, ''\),\s+pro\.procod/.test(
      capturedQuery,
    ),
    "A consulta deve ordenar alfabeticamente pela peça",
  );
  assert.deepStrictEqual(capturedParams, [10, 20, "%Tela%", 30]);
}

class FakePDFDocument {
  constructor() {
    FakePDFDocument.lastInstance = this;
    this.y = 40;
    this.page = { margins: { left: 40 } };
    this.textCalls = [];
  }

  pipe() {
    return this;
  }

  setHeader() {
    return this;
  }

  fontSize() {
    return this;
  }

  font() {
    return this;
  }

  fill() {
    return this;
  }

  fillColor() {
    return this;
  }

  rect() {
    return this;
  }

  moveDown(lines = 1) {
    this.y += lines * 10;
    return this;
  }

  addPage() {
    this.y = 40;
    return this;
  }

  heightOfString(value) {
    return String(value).length > 20 ? 16 : 8;
  }

  text(value, x, y, options) {
    this.textCalls.push({ value: String(value), x, y, options });
    if (typeof y === "number") {
      this.y = y;
    }
    return this;
  }

  end() {
    return this;
  }
}

async function testPecasCadastradasPdfLayout() {
  const relatoriosModels = require(path.join(repoRoot, "src/models/relatoriosModels"));
  const originalGetPecasCadastradas = relatoriosModels.getPecasCadastradas;
  const originalPdfkitExport = require.cache[pdfkitModulePath]?.exports;

  relatoriosModels.getPecasCadastradas = async () => [
    {
      procod: 1,
      peca: "Bateria",
      marca: "Marca A",
      modelo: "Modelo X",
      tipo: "Componente",
      preco: 199.9,
      prosemest: "N",
    },
  ];

  require.cache[pdfkitModulePath] = {
    id: pdfkitModulePath,
    filename: pdfkitModulePath,
    loaded: true,
    exports: FakePDFDocument,
  };

  delete require.cache[controllerModulePath];
  const relatoriosController = require(controllerModulePath);

  const res = {
    headers: {},
    headersSent: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  try {
    await relatoriosController.getPecasCadastradasPDF({ query: {} }, res);
  } finally {
    relatoriosModels.getPecasCadastradas = originalGetPecasCadastradas;
    if (originalPdfkitExport) {
      require.cache[pdfkitModulePath] = {
        ...require.cache[pdfkitModulePath],
        exports: originalPdfkitExport,
      };
    } else {
      delete require.cache[pdfkitModulePath];
    }
    delete require.cache[controllerModulePath];
  }

  const docInstance = FakePDFDocument.lastInstance;
  const renderedTexts = docInstance.textCalls.map(({ value }) => value);

  assert.ok(
    renderedTexts.includes("Peças Cadastradas"),
    "O PDF deve manter o título do relatório",
  );
  assert.ok(
    renderedTexts.includes("Preço"),
    "O PDF deve manter a coluna de preço",
  );
  assert.ok(
    !renderedTexts.includes("Custo"),
    "O PDF não deve renderizar a coluna custo",
  );
  assert.ok(
    !renderedTexts.includes("Estoque"),
    "O PDF não deve renderizar a coluna estoque",
  );
}

async function run() {
  FakePDFDocument.lastInstance = null;
  try {
    await testGetPecasCadastradasQuery();
    await testPecasCadastradasPdfLayout();
    console.log("✅ relatoriosPecasCadastradas.test.js passou");
  } catch (error) {
    console.error("❌ relatoriosPecasCadastradas.test.js falhou");
    console.error(error);
    process.exitCode = 1;
  } finally {
    delete require.cache[pdfkitModulePath];
  }
}

run();
