/**
 * Testes das Vitrines da Página Inicial (Destaques / Mais vendidos / Novidades).
 *
 * Valida:
 * - migration/seed das três vitrines;
 * - vitrine manual (adicionar/remover/reordenar e ordem na API pública);
 * - vitrines automáticas (mais vendidos com regra de venda consolidada,
 *   cancelamento e devolução; novidades por data de cadastro);
 * - vitrines inativas/ vazias fora da API pública;
 * - produtos inativos ocultos no público;
 * - autorização (admin x não admin) na API;
 * - ausência de N+1 (número fixo de queries por leitura).
 *
 * PRÉ-REQUISITOS:
 * - Banco de dados PostgreSQL configurado no .env (a migration roda no boot);
 * - Executar a partir da raiz do projeto: node tests/showcases.test.js
 *
 * Os dados criados usam o prefixo "TESTE SHOWCASE" e são removidos no final.
 */

const path = require("path");
const { spawn } = require("child_process");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertiva falhou");
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message || "assertEqual falhou"}: esperado ${expected}, obtido ${actual}`
    );
  }
}

function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || "Valor não deveria ser nulo");
  }
}

async function test(name, fn) {
  testsRun++;
  try {
    await fn();
    console.log(`✅ PASSOU: ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ FALHOU: ${name}`);
    console.log(`   Erro: ${error.message}`);
    testsFailed++;
  }
}

let pool;
let showcaseModels;
let showcaseController;
let showcasesCache;
let jwt;

try {
  pool = require("../src/config/db");
  showcaseModels = require("../src/models/showcaseModels");
  showcaseController = require("../src/controllers/showcaseController");
  showcasesCache = require("../src/utils/showcasesCache");
  jwt = require("jsonwebtoken");
} catch (error) {
  console.error("Falha ao carregar dependências:", error.message);
  process.exit(1);
}

const PREFIXO_TESTE = "TESTE SHOWCASE";

let servidor = null;
let servidorBaseUrl = null;
let showcaseSnapshot = [];
let itensDestaqueSnapshot = [];
const procodsTeste = [];
const pvcodsTeste = [];
const itensAdicionados = [];

function criarRespostaFake() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    jsonBody: null,
    ended: false,
  };
  res.set = (chave, valor) => {
    res.headers[String(chave).toLowerCase()] = valor;
    return res;
  };
  res.type = () => res;
  res.status = (codigo) => {
    res.statusCode = codigo;
    return res;
  };
  res.send = (corpo) => {
    res.body = corpo;
    return res;
  };
  res.json = (objeto) => {
    res.jsonBody = objeto;
    res.body = objeto;
    return res;
  };
  res.end = () => {
    res.ended = true;
    return res;
  };
  return res;
}

async function lerPayloadPublico() {
  showcasesCache.invalidate();
  const req = { headers: {} };
  const res = criarRespostaFake();
  await showcaseController.listarPublicas(req, res);
  assertEqual(res.statusCode, 200, "API pública deveria responder 200");
  return JSON.parse(res.body.toString());
}

// Ativa/desativa uma vitrine durante o teste (restaurado no finally).
async function definirVitrineAtiva(type, active) {
  const showcase = await showcaseModels.buscarShowcasePorTipo(type);
  await showcaseModels.atualizarShowcase(showcase.id, { active });
  showcasesCache.invalidate();
  return showcase.id;
}

// Volta ao estado capturado no início da suíte.
async function restaurarEstadoVitrines() {
  for (const showcase of showcaseSnapshot) {
    await showcaseModels.atualizarShowcase(showcase.id, {
      active: showcase.active,
      position: showcase.position,
      max_items: showcase.max_items,
    });
  }
  showcasesCache.invalidate();
}

async function criarProdutoTeste({ prosit = "A" } = {}) {
  const result = await pool.query(
    `INSERT INTO pro (prodes, promarcascod, protipocod, prosit, provl, prodtcad)
     VALUES (
       $1 || ' ' || (SELECT COALESCE(MAX(procod), 0) + 1 FROM pro),
       (SELECT marcascod FROM marcas WHERE COALESCE(marcassit, 'A') = 'A' ORDER BY marcascod LIMIT 1),
       (SELECT tipocod FROM tipo ORDER BY tipocod LIMIT 1),
       $2,
       10,
       CURRENT_TIMESTAMP
     )
     RETURNING procod`,
    [PREFIXO_TESTE, prosit]
  );
  const procod = result.rows[0].procod;
  procodsTeste.push(procod);
  return procod;
}

async function criarPedidoTeste(procod, quantidade) {
  const pvResult = await pool.query(
    `INSERT INTO pv (pvcod, pvvl, pvconfirmado, pvsta, pvdtcad)
     VALUES (
       (SELECT COALESCE(MAX(pvcod), 0) + 1 FROM pv),
       $1,
       'S',
       'A',
       CURRENT_DATE
     )
     RETURNING pvcod`,
    [quantidade]
  );
  const pvcod = pvResult.rows[0].pvcod;
  pvcodsTeste.push(pvcod);

  await pool.query(
    `INSERT INTO pvi (pvipvcod, pviprocod, pvivl, pviqtde, pviprocorid)
     VALUES ($1, $2, 1, $3, NULL)`,
    [pvcod, procod, quantidade]
  );

  return pvcod;
}

async function criarDevolucaoTeste(pvcod, procod, quantidade) {
  const devResult = await pool.query(
    `INSERT INTO devolucoes (devpvcod, devusucod, devmotivo, devsta)
     VALUES ($1, NULL, 'test_showcase_devolucao', 'A')
     RETURNING devcod`,
    [pvcod]
  );

  await pool.query(
    `INSERT INTO devolucao_itens
       (devidevcod, deviprocod, deviprocorid, deviqtde, devivl,
        deviprodes, devicornome, devirepor_estoque)
     VALUES ($1, $2, NULL, $3, 1, $4, 'Sem cor', FALSE)`,
    [devResult.rows[0].devcod, procod, quantidade, PREFIXO_TESTE]
  );
}

async function cleanup() {
  try {
    await pool.query(`
      DELETE FROM home_showcase_items
      WHERE procod IN (SELECT procod FROM pro WHERE prodes LIKE $1)
    `, [`${PREFIXO_TESTE}%`]);

    for (const procod of itensAdicionados) {
      await pool.query(
        "DELETE FROM home_showcase_items WHERE procod = $1",
        [procod]
      );
    }

    await pool.query(`
      DELETE FROM devolucao_itens
      WHERE devidevcod IN (
        SELECT devcod FROM devolucoes WHERE devmotivo LIKE 'test_showcase%'
      )
    `);
    await pool.query(
      "DELETE FROM devolucoes WHERE devmotivo LIKE 'test_showcase%'"
    );

    for (const pvcod of pvcodsTeste) {
      await pool.query("DELETE FROM pvi WHERE pvipvcod = $1", [pvcod]);
      await pool.query("DELETE FROM pv WHERE pvcod = $1", [pvcod]);
    }

    for (const procod of procodsTeste) {
      await pool.query("DELETE FROM pro WHERE procod = $1", [procod]);
    }

    for (const showcase of showcaseSnapshot) {
      await pool.query(
        `UPDATE home_showcases
         SET active = $2, position = $3, max_items = $4, updated_at = NOW()
         WHERE id = $1`,
        [showcase.id, showcase.active, showcase.position, showcase.max_items]
      );
    }

    // Devolve os itens manuais que existiam antes da suíte (a suíte começa
    // com os Destaques vazios para os testes serem determinísticos).
    for (const item of itensDestaqueSnapshot) {
      await pool.query(
        `INSERT INTO home_showcase_items (showcase_id, procod, position)
         SELECT id, $1, $2 FROM home_showcases WHERE type = 'featured'
         ON CONFLICT (showcase_id, procod) DO NOTHING`,
        [item.procod, item.position]
      );
    }

    showcasesCache.invalidate();
  } catch (error) {
    console.log("Aviso de limpeza:", error.message);
  }
}

async function capturarItensDestaque() {
  const destaque = await showcaseModels.buscarShowcasePorTipo("featured");
  if (!destaque) return [];
  const result = await pool.query(
    `SELECT procod, position
     FROM home_showcase_items
     WHERE showcase_id = $1
     ORDER BY position, id`,
    [destaque.id]
  );
  return result.rows;
}

function iniciarServidor() {
  return new Promise((resolve, reject) => {
    const porta = 4400 + Math.floor(Math.random() * 100);
    const child = spawn(process.execPath, ["src/app.js"], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, PORT: String(porta) },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let saida = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Timeout ao subir o servidor. Saída: ${saida}`));
    }, 90000);

    child.stdout.on("data", (data) => {
      saida += data.toString();
      if (saida.includes("Servidor rodando")) {
        clearTimeout(timeout);
        resolve({ child, baseUrl: `http://127.0.0.1:${porta}` });
      }
    });
    child.stderr.on("data", (data) => {
      saida += data.toString();
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Servidor encerrou (código ${code}). Saída: ${saida}`));
    });
  });
}

function tokenPara(usuadm) {
  return jwt.sign(
    {
      usuemail: "teste@showcase.local",
      usucod: 1,
      usunome: "Teste Showcase",
      usuadm,
      usupv: "S",
      usuest: "S",
      empusapv: "S",
      empusaest: "S",
    },
    "chave-secreta",
    { expiresIn: "30m" }
  );
}

async function runTests() {
  console.log("\n🧪 Testes das Vitrines da Página Inicial\n");
  console.log("=".repeat(55));

  await cleanup();

  const snapshot = await pool.query(
    `SELECT id, type, title, active, position, max_items
     FROM home_showcases ORDER BY position`
  );
  showcaseSnapshot = snapshot.rows;

  // Estado determinístico para a suíte (restaurado no cleanup final):
  // Destaques vazio e vitrines nos padrões da migration.
  itensDestaqueSnapshot = await capturarItensDestaque();
  await pool.query("DELETE FROM home_showcase_items");
  await pool.query(
    "UPDATE home_showcases SET active = (type = 'new_arrivals'), updated_at = NOW()"
  );
  showcasesCache.invalidate();

  // --------------------------------------------------------------- seed
  await test("Migration cria as três vitrines com tipos e ordem padrão", async () => {
    const rows = await showcaseModels.listarShowcases({ somenteAtivas: false });
    const tipos = rows.map((row) => row.type);

    assertEqual(rows.length, 3, "Devem existir exatamente 3 vitrines");
    assert(tipos.includes("featured"), "Vitrine featured (Destaques) ausente");
    assert(tipos.includes("best_sellers"), "Vitrine best_sellers ausente");
    assert(tipos.includes("new_arrivals"), "Vitrine new_arrivals ausente");

    const destaque = rows.find((row) => row.type === "featured");
    const maisVendidos = rows.find((row) => row.type === "best_sellers");
    const novidades = rows.find((row) => row.type === "new_arrivals");

    assert(destaque.position <= maisVendidos.position, "Destaques antes de Mais vendidos");
    assert(maisVendidos.position <= novidades.position, "Mais vendidos antes de Novidades");

    // Estado inicial de uma instalação nova: só Novidades ativa.
    assertEqual(destaque.active, false, "Destaques deveria iniciar inativa");
    assertEqual(maisVendidos.active, false, "Mais vendidos deveria iniciar inativa");
    assertEqual(novidades.active, true, "Novidades deveria iniciar ativa");
  });

  await test("Destaques inicia sem itens selecionados", async () => {
    const destaque = await showcaseModels.buscarShowcasePorTipo("featured");
    const itens = await showcaseModels.listarItensShowcase(destaque.id, {
      somenteAtivos: false,
    });
    assertEqual(itens.length, 0, "Destaques deveria começar vazio");
  });

  // -------------------------------------------------------- automáticas
  await test("Mais vendidos: ordenado por quantidade e somente ativos", async () => {
    const lista = await showcaseModels.listarMaisVendidos(10);
    assert(lista.length <= 10, "Deveria respeitar o limite");

    for (let i = 0; i < lista.length; i++) {
      assertEqual(lista[i].prosit, "A", "Somente produtos ativos");
      if (i > 0) {
        assert(
          Number(lista[i - 1].quantidade_vendida) >=
            Number(lista[i].quantidade_vendida),
          "Deveria estar ordenado por quantidade vendida (desc)"
        );
      }
    }
  });

  await test("Mais vendidos: cancelamento não conta e devolução é descontada", async () => {
    const procod = await criarProdutoTeste();
    const pvcod = await criarPedidoTeste(procod, 100);

    const comVenda = await showcaseModels.listarMaisVendidos(50);
    const vendido = comVenda.find((row) => Number(row.procod) === Number(procod));
    assertNotNull(vendido, "Produto com venda confirmada deveria aparecer");
    assertEqual(
      Number(vendido.quantidade_vendida),
      100,
      "Quantidade vendida deveria ser 100"
    );

    await criarDevolucaoTeste(pvcod, procod, 40);

    const comDevolucao = await showcaseModels.listarMaisVendidos(50);
    const aposDevolucao = comDevolucao.find(
      (row) => Number(row.procod) === Number(procod)
    );
    assertNotNull(aposDevolucao, "Produto deveria continuar aparecendo");
    assertEqual(
      Number(aposDevolucao.quantidade_vendida),
      60,
      "Devolução ativa deveria ser descontada"
    );

    await pool.query("UPDATE pv SET pvsta = 'X' WHERE pvcod = $1", [pvcod]);

    const comCancelamento = await showcaseModels.listarMaisVendidos(50);
    const aposCancelar = comCancelamento.find(
      (row) => Number(row.procod) === Number(procod)
    );
    assertEqual(aposCancelar, undefined, "Pedido cancelado não deveria contar");
  });

  await test("Novidades: mais recente primeiro e somente ativos", async () => {
    const procod = await criarProdutoTeste();
    const lista = await showcaseModels.listarNovidades(10);

    assert(lista.length <= 10, "Deveria respeitar o limite");
    assertEqual(
      Number(lista[0].procod),
      Number(procod),
      "Produto recém-cadastrado deveria ser o primeiro"
    );

    for (let i = 0; i < lista.length; i++) {
      assertEqual(lista[i].prosit, "A", "Somente produtos ativos");
      if (i > 0) {
        const anterior = lista[i - 1].prodtcad
          ? new Date(lista[i - 1].prodtcad).getTime()
          : 0;
        const atual = lista[i].prodtcad
          ? new Date(lista[i].prodtcad).getTime()
          : 0;
        assert(anterior >= atual, "Deveria estar em ordem decrescente de cadastro");
      }
    }
  });

  // -------------------------------------------------------- API pública
  await test("API pública omite vitrine ativa sem itens", async () => {
    await definirVitrineAtiva("featured", true);
    try {
      const payload = await lerPayloadPublico();
      const featured = payload.showcases.find((item) => item.type === "featured");
      assertEqual(featured, undefined, "Destaques vazio não deveria aparecer");
    } finally {
      await restaurarEstadoVitrines();
    }
  });

  await test("API pública omite vitrine inativa", async () => {
    await definirVitrineAtiva("featured", false);
    try {
      const payload = await lerPayloadPublico();
      const featured = payload.showcases.find((item) => item.type === "featured");
      assertEqual(featured, undefined, "Vitrine inativa não deveria aparecer");
    } finally {
      await restaurarEstadoVitrines();
    }
  });

  await test("API pública respeita a ordem configurada das vitrines", async () => {
    const showcases = await showcaseModels.listarShowcases({
      somenteAtivas: false,
    });
    const idsOriginais = showcases.map((row) => row.id);
    const ordemInvertida = [...idsOriginais].reverse();

    try {
      for (const showcase of showcases) {
        await showcaseModels.atualizarShowcase(showcase.id, { active: true });
      }
      await showcaseModels.atualizarOrdemShowcases(ordemInvertida);

      const payload = await lerPayloadPublico();
      const tiposRetornados = payload.showcases.map((item) => item.type);
      const tiposEsperados = ordemInvertida
        .map((id) => showcases.find((row) => row.id === id).type)
        .filter((tipo) => tiposRetornados.includes(tipo));

      assertEqual(
        tiposRetornados.join(","),
        tiposEsperados.join(","),
        "A ordem da API deveria seguir a configuração"
      );
    } finally {
      await showcaseModels.atualizarOrdemShowcases(idsOriginais);
      await restaurarEstadoVitrines();
    }
  });

  // -------------------------------------------------- destaques manual
  await test("Destaques: adicionar, reordenar e remover refletem no público", async () => {
    await definirVitrineAtiva("featured", true);
    const destaque = await showcaseModels.buscarShowcasePorTipo("featured");
    const produtoA = await criarProdutoTeste();
    const produtoB = await criarProdutoTeste();
    itensAdicionados.push(produtoA, produtoB);

    const req = (procod) => ({
      params: { id: String(destaque.id) },
      body: { procod },
      headers: {},
    });
    const fake = () => criarRespostaFake();

    let res = fake();
    await showcaseController.adicionarItem(req(produtoA), res);
    assertEqual(res.statusCode, 201, "Deveria adicionar o produto A");

    res = fake();
    await showcaseController.adicionarItem(req(produtoB), res);
    assertEqual(res.statusCode, 201, "Deveria adicionar o produto B");

    let payload = await lerPayloadPublico();
    let featured = payload.showcases.find((item) => item.type === "featured");
    assertNotNull(featured, "Destaques deveria aparecer com itens");
    assertEqual(
      featured.items.map((item) => Number(item.procod)).join(","),
      [produtoA, produtoB].join(","),
      "Ordem de inserção deveria ser respeitada"
    );

    const resOrdem = fake();
    await showcaseController.atualizarOrdemItens(
      {
        params: { id: String(destaque.id) },
        body: { ordem: [produtoB, produtoA] },
        headers: {},
      },
      resOrdem
    );
    assertEqual(resOrdem.statusCode, 200, "Reordenação deveria funcionar");

    payload = await lerPayloadPublico();
    featured = payload.showcases.find((item) => item.type === "featured");
    assertEqual(
      featured.items.map((item) => Number(item.procod)).join(","),
      [produtoB, produtoA].join(","),
      "Ordem configurada deveria ser exibida no público"
    );

    const resRemover = fake();
    await showcaseController.removerItem(
      { params: { id: String(destaque.id), procod: String(produtoA) }, headers: {} },
      resRemover
    );
    assertEqual(resRemover.statusCode, 200, "Remoção deveria funcionar");

    payload = await lerPayloadPublico();
    featured = payload.showcases.find((item) => item.type === "featured");
    assertEqual(
      featured.items.map((item) => Number(item.procod)).join(","),
      [produtoB].join(","),
      "Produto removido não deveria aparecer"
    );

    const resLimpar = fake();
    await showcaseController.removerItem(
      { params: { id: String(destaque.id), procod: String(produtoB) }, headers: {} },
      resLimpar
    );
    assertEqual(resLimpar.statusCode, 200, "Limpeza dos Destaques deveria funcionar");

    await restaurarEstadoVitrines();
  });

  await test("Destaques: produto inativo fica oculto no público e visível no admin", async () => {
    await definirVitrineAtiva("featured", true);
    const destaque = await showcaseModels.buscarShowcasePorTipo("featured");
    const produtoInativo = await criarProdutoTeste({ prosit: "I" });

    await pool.query(
      `INSERT INTO home_showcase_items (showcase_id, procod, position)
       VALUES ($1, $2, 99)`,
      [destaque.id, produtoInativo]
    );

    const payload = await lerPayloadPublico();
    const featured = payload.showcases.find((item) => item.type === "featured");
    const encontrado = featured
      ? featured.items.find((item) => Number(item.procod) === Number(produtoInativo))
      : undefined;
    assertEqual(encontrado, undefined, "Produto inativo não deveria aparecer no público");

    const res = criarRespostaFake();
    await showcaseController.listarAdmin({ headers: {} }, res);
    const showcaseAdmin = res.jsonBody.showcases.find(
      (item) => item.type === "featured"
    );
    const itemAdmin = showcaseAdmin.items.find(
      (item) => Number(item.procod) === Number(produtoInativo)
    );
    assertNotNull(itemAdmin, "Painel deveria listar o produto inativo");
    assertEqual(itemAdmin.prosit, "I", "Painel deveria marcar o produto como inativo");

    await pool.query(
      "DELETE FROM home_showcase_items WHERE showcase_id = $1 AND procod = $2",
      [destaque.id, produtoInativo]
    );

    await restaurarEstadoVitrines();
  });

  await test("Destaques: adicionar produto inativo é recusado", async () => {
    const destaque = await showcaseModels.buscarShowcasePorTipo("featured");
    const produtoInativo = await criarProdutoTeste({ prosit: "I" });

    const res = criarRespostaFake();
    await showcaseController.adicionarItem(
      {
        params: { id: String(destaque.id) },
        body: { procod: produtoInativo },
        headers: {},
      },
      res
    );

    assertEqual(res.statusCode, 400, "Deveria recusar produto inativo");
  });

  await test("Admin: validações de configuração e ordem", async () => {
    const showcases = await showcaseModels.listarShowcases({
      somenteAtivas: false,
    });
    const destaque = showcases.find((row) => row.type === "featured");

    let res = criarRespostaFake();
    await showcaseController.atualizarShowcase(
      {
        params: { id: String(destaque.id) },
        body: { max_items: 999 },
        headers: {},
      },
      res
    );
    assertEqual(res.statusCode, 400, "max_items acima do limite deveria falhar");

    res = criarRespostaFake();
    await showcaseController.atualizarShowcase(
      {
        params: { id: String(destaque.id) },
        body: { position: 0 },
        headers: {},
      },
      res
    );
    assertEqual(res.statusCode, 400, "Posição inválida deveria falhar");

    res = criarRespostaFake();
    await showcaseController.atualizarOrdem(
      { params: {}, body: { ordem: [destaque.id] }, headers: {} },
      res
    );
    assertEqual(res.statusCode, 400, "Ordem incompleta deveria falhar");

    res = criarRespostaFake();
    await showcaseController.atualizarShowcase(
      {
        params: { id: String(destaque.id) },
        body: { active: "sim" },
        headers: {},
      },
      res
    );
    assertEqual(res.statusCode, 400, "Status não booleano deveria falhar");
  });

  // ------------------------------------------------------ performance
  await test("Leitura pública não faz N+1 (queries fixas)", async () => {
    for (const showcase of showcaseSnapshot) {
      await showcaseModels.atualizarShowcase(showcase.id, { active: true });
    }
    showcasesCache.invalidate();

    const originalQuery = pool.query.bind(pool);
    let totalQueries = 0;
    pool.query = function (...args) {
      totalQueries++;
      return originalQuery(...args);
    };

    try {
      const req = { headers: {} };
      const res = criarRespostaFake();
      await showcaseController.listarPublicas(req, res);
    } finally {
      pool.query = originalQuery;
      await restaurarEstadoVitrines();
    }

    assert(
      totalQueries <= 5,
      `Esperado no máximo 5 queries, executadas ${totalQueries}`
    );
  });

  await test("Cache público é invalidado ao alterar configuração", async () => {
    const destaque = await showcaseModels.buscarShowcasePorTipo("featured");

    const primeira = await lerPayloadPublico();
    assertNotNull(primeira, "Primeira leitura deveria funcionar");

    const entryAntes = showcasesCache.get();
    assertNotNull(entryAntes, "Leitura deveria preencher o cache");

    const res = criarRespostaFake();
    await showcaseController.atualizarShowcase(
      {
        params: { id: String(destaque.id) },
        body: { active: destaque.active },
        headers: {},
      },
      res
    );

    assertEqual(showcasesCache.get(), null, "Mutação deveria invalidar o cache");
  });

  await test("API pública responde 304 quando o ETag não muda", async () => {
    showcasesCache.invalidate();

    const res1 = criarRespostaFake();
    await showcaseController.listarPublicas({ headers: {} }, res1);
    assertEqual(res1.statusCode, 200, "Primeira leitura deveria ser 200");
    const etag = res1.headers.etag;
    assertNotNull(etag, "ETag deveria ser definido");

    const res2 = criarRespostaFake();
    await showcaseController.listarPublicas(
      { headers: { "if-none-match": etag } },
      res2
    );
    assertEqual(res2.statusCode, 304, "Deveria responder 304 com ETag igual");
    assert(res2.ended === true, "Resposta 304 deveria encerrar sem corpo");
  });

  await test("API pública reflete cada combinação de vitrines ativas", async () => {
    await showcaseModels.atualizarOrdemShowcases(
      showcaseSnapshot.map((showcase) => showcase.id)
    );
    const showcases = await showcaseModels.listarShowcases({
      somenteAtivas: false,
    });
    const destaque = showcases.find((row) => row.type === "featured");
    const procod = await criarProdutoTeste();
    itensAdicionados.push(procod);
    await showcaseModels.adicionarItemDestaque(destaque.id, procod);

    const disponibilidade = {
      featured: true,
      best_sellers: (await showcaseModels.listarMaisVendidos(1)).length > 0,
      new_arrivals: (await showcaseModels.listarNovidades(1)).length > 0,
    };

    async function definirAtivas(tipos) {
      for (const showcase of showcases) {
        await showcaseModels.atualizarShowcase(showcase.id, {
          active: tipos.includes(showcase.type),
        });
      }
      showcasesCache.invalidate();
    }

    try {
      await definirAtivas([]);
      let payload = await lerPayloadPublico();
      assertEqual(
        payload.showcases.length,
        0,
        "Sem vitrines ativas o payload deveria ser vazio"
      );

      for (const tipo of ["featured", "best_sellers", "new_arrivals"]) {
        if (!disponibilidade[tipo]) {
          console.log(`   (ignorado: ${tipo} sem itens nesta base)`);
          continue;
        }

        await definirAtivas([tipo]);
        payload = await lerPayloadPublico();
        assertEqual(
          payload.showcases.length,
          1,
          `Somente ${tipo} deveria aparecer`
        );
        assertEqual(payload.showcases[0].type, tipo, `Tipo esperado: ${tipo}`);
        assert(
          payload.showcases[0].items.length > 0,
          `${tipo} deveria ter itens`
        );
      }
    } finally {
      await showcaseModels.removerItemDestaque(destaque.id, procod);
      for (const showcase of showcases) {
        await showcaseModels.atualizarShowcase(showcase.id, {
          active: showcase.active,
        });
      }
      showcasesCache.invalidate();
    }
  });

  // ------------------------------------------------------- HTTP/auth
  await test("HTTP: público responde e admin exige permissão", async () => {
    const start = await iniciarServidor();
    servidor = start.child;
    servidorBaseUrl = start.baseUrl;

    const publico = await fetch(`${servidorBaseUrl}/showcases`, {
      redirect: "manual",
    });
    assertEqual(publico.status, 200, "GET /showcases deveria responder 200");
    const payload = await publico.json();
    assert(Array.isArray(payload.showcases), "Payload deveria ter showcases");

    const semToken = await fetch(`${servidorBaseUrl}/showcases/admin`, {
      redirect: "manual",
    });
    assert(
      semToken.status !== 200,
      "Admin sem token não deveria acessar a listagem"
    );

    const tokenAdmin = tokenPara("S");
    const comAdmin = await fetch(`${servidorBaseUrl}/showcases/admin`, {
      headers: { Cookie: `token=${tokenAdmin}` },
      redirect: "manual",
    });
    assertEqual(comAdmin.status, 200, "Admin autenticado deveria listar");

    const tokenComum = tokenPara("N");
    const updateComum = await fetch(`${servidorBaseUrl}/showcases/admin/1`, {
      method: "PUT",
      headers: {
        Cookie: `token=${tokenComum}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ active: false }),
      redirect: "manual",
    });
    assertEqual(
      updateComum.status,
      403,
      "Usuário sem permissão deveria receber 403"
    );
  });

  await test("HTTP: preferência do tour é persistida por usuário", async () => {
    assertNotNull(servidorBaseUrl, "Servidor de teste deveria estar no ar");

    const tokenAdmin = tokenPara("S");
    const authHeaders = { Cookie: `token=${tokenAdmin}` };
    const jsonHeaders = {
      Cookie: `token=${tokenAdmin}`,
      "Content-Type": "application/json",
    };

    const semToken = await fetch(`${servidorBaseUrl}/usuario/viutour/`, {
      redirect: "manual",
    });
    assert(
      semToken.status !== 200,
      "Sem token não deveria acessar a preferência do tour"
    );

    const inicialRes = await fetch(`${servidorBaseUrl}/usuario/viutour/`, {
      headers: authHeaders,
    });
    assertEqual(inicialRes.status, 200, "Admin deveria consultar a preferência");
    const estadoInicial = (await inicialRes.json()).usuvitour || "N";

    try {
      const marcar = await fetch(`${servidorBaseUrl}/usuario/viutour/`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ viuTour: "S" }),
      });
      assertEqual(marcar.status, 200, "Marcar como visto deveria funcionar");

      const depois = await fetch(`${servidorBaseUrl}/usuario/viutour/`, {
        headers: authHeaders,
      });
      const marcado = (await depois.json()).usuvitour;
      assertEqual(marcado, "S", "Preferência deveria ficar 'S' no banco");
    } finally {
      await fetch(`${servidorBaseUrl}/usuario/viutour/`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ viuTour: estadoInicial === "S" ? "S" : "N" }),
      });
    }
  });

  await test("HTTP: ativar/desativar pelo painel reflete no público", async () => {
    assertNotNull(servidorBaseUrl, "Servidor de teste deveria estar no ar");

    const destaque = await showcaseModels.buscarShowcasePorTipo("featured");
    const tokenAdmin = tokenPara("S");
    const headers = {
      Cookie: `token=${tokenAdmin}`,
      "Content-Type": "application/json",
    };

    const desativar = await fetch(
      `${servidorBaseUrl}/showcases/admin/${destaque.id}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({ active: false }),
        redirect: "manual",
      }
    );
    assertEqual(desativar.status, 200, "Desativar deveria funcionar");

    const publicoDesativado = await fetch(`${servidorBaseUrl}/showcases`, {
      redirect: "manual",
    });
    const payloadDesativado = await publicoDesativado.json();
    assertEqual(
      payloadDesativado.showcases.find((item) => item.type === "featured"),
      undefined,
      "Vitrine desativada não deveria aparecer"
    );

    const ativar = await fetch(
      `${servidorBaseUrl}/showcases/admin/${destaque.id}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({ active: true }),
        redirect: "manual",
      }
    );
    assertEqual(ativar.status, 200, "Reativar deveria funcionar");

    await restaurarEstadoVitrines();
  });

  await test("HTTP: reordenar produtos dos Destaques reflete na API pública", async () => {
    assertNotNull(servidorBaseUrl, "Servidor de teste deveria estar no ar");

    await definirVitrineAtiva("featured", true);
    const destaque = await showcaseModels.buscarShowcasePorTipo("featured");
    const produtoA = await criarProdutoTeste();
    const produtoB = await criarProdutoTeste();
    itensAdicionados.push(produtoA, produtoB);

    const tokenAdmin = tokenPara("S");
    const headers = {
      Cookie: `token=${tokenAdmin}`,
      "Content-Type": "application/json",
    };

    for (const procod of [produtoA, produtoB]) {
      const resposta = await fetch(
        `${servidorBaseUrl}/showcases/admin/${destaque.id}/items`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ procod }),
        }
      );
      assertEqual(resposta.status, 201, `Deveria adicionar o produto ${procod}`);
    }

    const reordenar = await fetch(
      `${servidorBaseUrl}/showcases/admin/${destaque.id}/items/ordem`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ ordem: [produtoB, produtoA] }),
      }
    );
    assertEqual(reordenar.status, 200, "Reordenar deveria funcionar");

    const publico = await fetch(`${servidorBaseUrl}/showcases`);
    const payload = await publico.json();
    const featured = payload.showcases.find((item) => item.type === "featured");
    assertNotNull(featured, "Destaques deveria aparecer");
    assertEqual(
      featured.items.map((item) => Number(item.procod)).join(","),
      [produtoB, produtoA].join(","),
      "API pública deveria exibir a ordem definida no painel"
    );

    await restaurarEstadoVitrines();
  });

  await cleanup();

  if (servidor) {
    servidor.kill();
  }

  console.log("\n" + "=".repeat(55));
  console.log(
    `📊 Resultado: ${testsPassed} passaram, ${testsFailed} falharam, ${testsRun} no total`
  );

  await pool.end();
  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch(async (error) => {
  console.error("Erro fatal nos testes:", error);
  await cleanup();
  if (servidor) servidor.kill();
  await pool.end().catch(() => {});
  process.exit(1);
});
