const showcaseModels = require("../models/showcaseModels");
const showcasesCache = require("../utils/showcasesCache");
const { parseIntegerParam } = require("../utils/parseIntegerParam");
const { getEstoqueConfig } = require("../utils/estoqueConfig");

const TIPO_MANUAL = "featured";
const TITULO_MAX_LENGTH = 100;

// Formato enxuto dos itens das vitrines para a página pública.
// Não expõe campos internos do cadastro (prosit, posições etc.).
// Com o controle de estoque ativo (empusaest = 'S'), as flags são automáticas;
// sem ele (empusaest = 'N'), a validação de estoque é ignorada e valem apenas
// as flags manuais do cadastro: "sem estoque geral" (prosemest) e "acabando"
// (proacabando).
function mapearItemPublico(row, config) {
  const usaEstoque = Boolean(config && config.usaEstoque);
  const estoqueMin = config && Number.isInteger(config.estoqueMin)
    ? config.estoqueMin
    : 5;
  const normalizar = (valor) =>
    String(valor || "N").trim().toUpperCase() === "S" ? "S" : "N";
  const qtd = Number(row.estoque_menor_saldo) || 0;
  const acabandoAuto = qtd > 0 && qtd <= estoqueMin ? "S" : "N";

  return {
    procod: row.procod,
    prodes: row.prodes || "",
    provl: Number(row.provl) || 0,
    provlpromo:
      row.provlpromo === null || row.provlpromo === undefined
        ? null
        : Number(row.provlpromo),
    tipocod: row.protipocod,
    tipodes: row.tipodes || "",
    marcascod: row.promarcascod,
    marcasdes: row.marcasdes || "",
    modcod: row.modcod || null,
    moddes: row.moddes || "",
    prosemest: normalizar(usaEstoque ? row.prosemest_auto : row.prosemest),
    proacabando: row.tem_cores ? 'N' : (usaEstoque ? acabandoAuto : normalizar(row.proacabando)),
  };
}

// Monta as vitrines ativas já prontas para o frontend:
// - featured (manual) usa os itens escolhidos pelo admin, na ordem salva;
// - best_sellers/new_arrivals são calculadas na hora, respeitando max_items.
// Vitrines ativas sem itens são omitidas para não renderizar seção vazia.
async function montarVitrinesPublicas() {
  const showcases = await showcaseModels.listarShowcases({ somenteAtivas: true });
  if (showcases.length === 0) {
    return { showcases: [] };
  }

  const config = await getEstoqueConfig();

  const destaque = showcases.find((s) => s.type === TIPO_MANUAL);
  let itensDestaque = [];
  if (destaque) {
    itensDestaque = await showcaseModels.listarItensShowcase(destaque.id, {
      somenteAtivos: true,
      config,
    });
  }

  const resultado = [];
  for (const showcase of showcases) {
    let itens;

    if (showcase.type === TIPO_MANUAL) {
      itens = itensDestaque;
    } else if (showcase.type === "best_sellers") {
      itens = await showcaseModels.listarMaisVendidos(showcase.max_items, config);
    } else if (showcase.type === "new_arrivals") {
      itens = await showcaseModels.listarNovidades(showcase.max_items, config);
    } else {
      itens = [];
    }

    if (!itens.length) continue;

    resultado.push({
      type: showcase.type,
      title: showcase.title,
      items: itens.map((item) => mapearItemPublico(item, config)),
    });
  }

  return { showcases: resultado };
}

// GET /showcases — público. Retorna somente vitrines ativas e com itens,
// na ordem configurada no painel, com ETag para evitar tráfego repetido.
exports.listarPublicas = async (req, res) => {
  try {
    let entry = showcasesCache.get();

    if (!entry) {
      const payload = await montarVitrinesPublicas();
      entry = showcasesCache.set(payload);
    }

    res.set("ETag", entry.etag);
    res.set("Cache-Control", "private, max-age=0, must-revalidate");

    if (req.headers["if-none-match"] === entry.etag) {
      return res.status(304).end();
    }

    res.type("application/json").status(200).send(entry.body);
  } catch (error) {
    console.error("Erro ao listar vitrines públicas:", error);
    res.status(500).json({ error: "Erro ao buscar vitrines" });
  }
};

// GET /showcases/admin — lista todas as vitrines (ativas e inativas) com os
// itens manuais, inclusive produtos inativos, para o painel gerenciar.
// As vitrines automáticas também trazem uma prévia do que está sendo exibido.
exports.listarAdmin = async (req, res) => {
  try {
    const [showcases, itens] = await Promise.all([
      showcaseModels.listarShowcases({ somenteAtivas: false }),
      showcaseModels.listarItensShowcases({ somenteAtivos: false }),
    ]);
    const config = await getEstoqueConfig();

    const itensPorShowcase = new Map();
    for (const item of itens) {
      if (!itensPorShowcase.has(item.showcase_id)) {
        itensPorShowcase.set(item.showcase_id, []);
      }
      itensPorShowcase.get(item.showcase_id).push(item);
    }

    const resposta = [];
    for (const showcase of showcases) {
      let previewItems = [];

      if (showcase.type === "best_sellers") {
        previewItems = await showcaseModels.listarMaisVendidos(
          showcase.max_items,
          config
        );
      } else if (showcase.type === "new_arrivals") {
        previewItems = await showcaseModels.listarNovidades(
          showcase.max_items,
          config
        );
      }

      resposta.push({
        ...showcase,
        items: itensPorShowcase.get(showcase.id) || [],
        previewItems: previewItems.map((item) => mapearItemPublico(item, config)),
      });
    }

    res.status(200).json({ showcases: resposta });
  } catch (error) {
    console.error("Erro ao listar vitrines do painel:", error);
    res.status(500).json({ error: "Erro ao buscar vitrines" });
  }
};

// PUT /showcases/admin/:id — ativa/desativa, altera posição e limite de itens.
exports.atualizarShowcase = async (req, res) => {
  const id = parseIntegerParam(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "Vitrine inválida ou não informada" });
  }

  const body = req.body || {};
  const campos = {};

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      return res.status(400).json({ error: "Status da vitrine inválido" });
    }
    campos.active = body.active;
  }

  if (body.position !== undefined) {
    const position = parseIntegerParam(body.position);
    if (position === null || position < 1) {
      return res.status(400).json({ error: "Posição inválida" });
    }
    campos.position = position;
  }

  if (body.max_items !== undefined) {
    const maxItems = parseIntegerParam(body.max_items);
    if (
      maxItems === null ||
      maxItems < 1 ||
      maxItems > showcaseModels.MAX_MAX_ITEMS
    ) {
      return res.status(400).json({
        error: `Quantidade máxima deve ser entre 1 e ${showcaseModels.MAX_MAX_ITEMS}`,
      });
    }
    campos.max_items = maxItems;
  }

  if (body.title !== undefined) {
    if (typeof body.title !== "string") {
      return res.status(400).json({ error: "Título da vitrine inválido" });
    }
    const title = body.title.trim();
    if (!title) {
      return res.status(400).json({ error: "Informe um título para a vitrine" });
    }
    if (title.length > TITULO_MAX_LENGTH) {
      return res.status(400).json({
        error: `O título deve ter no máximo ${TITULO_MAX_LENGTH} caracteres`,
      });
    }
    campos.title = title;
  }

  if (Object.keys(campos).length === 0) {
    return res.status(400).json({ error: "Nenhuma alteração informada" });
  }

  try {
    // O título é editável somente na vitrine manual (Destaques); as
    // automáticas mantêm o rótulo fixo que descreve o critério de seleção.
    if (campos.title !== undefined) {
      const showcase = await showcaseModels.buscarShowcasePorId(id);
      if (!showcase) {
        return res.status(404).json({ error: "Vitrine não encontrada" });
      }
      if (showcase.type !== TIPO_MANUAL) {
        return res.status(400).json({
          error: "Somente a vitrine Destaques permite alterar o título",
        });
      }
    }

    const atualizado = await showcaseModels.atualizarShowcase(id, campos);
    if (!atualizado) {
      return res.status(404).json({ error: "Vitrine não encontrada" });
    }

    showcasesCache.invalidate();
    res.status(200).json(atualizado);
  } catch (error) {
    console.error("Erro ao atualizar vitrine:", error);
    res.status(500).json({ error: "Erro ao atualizar vitrine" });
  }
};

// POST /showcases/admin/ordem — reordena todas as vitrines da página.
exports.atualizarOrdem = async (req, res) => {
  const ordem = req.body ? req.body.ordem : null;

  if (!Array.isArray(ordem) || ordem.length === 0) {
    return res.status(400).json({ error: "Ordem inválida" });
  }

  const ids = ordem.map((valor) => parseIntegerParam(valor));
  if (ids.some((valor) => valor === null)) {
    return res.status(400).json({ error: "Ordem inválida" });
  }

  try {
    const showcases = await showcaseModels.listarShowcases({
      somenteAtivas: false,
    });
    const idsExistentes = showcases.map((s) => s.id);
    const mesmaQuantidade = ids.length === idsExistentes.length;
    const todosPresentes = idsExistentes.every((id) => ids.includes(id));

    if (!mesmaQuantidade || !todosPresentes) {
      return res.status(400).json({
        error: "A ordem deve conter todas as vitrines exatamente uma vez",
      });
    }

    await showcaseModels.atualizarOrdemShowcases(ids);
    showcasesCache.invalidate();
    res.status(200).json({ message: "Ordem atualizada com sucesso" });
  } catch (error) {
    console.error("Erro ao atualizar ordem das vitrines:", error);
    res.status(500).json({ error: "Erro ao atualizar ordem das vitrines" });
  }
};

// POST /showcases/admin/:id/items — adiciona produto à vitrine manual.
exports.adicionarItem = async (req, res) => {
  const id = parseIntegerParam(req.params.id);
  const procod = parseIntegerParam(req.body ? req.body.procod : null);

  if (id === null) {
    return res.status(400).json({ error: "Vitrine inválida ou não informada" });
  }
  if (procod === null) {
    return res.status(400).json({ error: "Produto inválido ou não informado" });
  }

  try {
    const showcase = await showcaseModels.buscarShowcasePorId(id);
    if (!showcase) {
      return res.status(404).json({ error: "Vitrine não encontrada" });
    }
    if (showcase.type !== TIPO_MANUAL) {
      return res.status(400).json({
        error: "Somente a vitrine Destaques permite seleção manual de produtos",
      });
    }

    const produto = await showcaseModels.buscarProduto(procod);
    if (!produto) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }
    if (produto.prosit !== "A") {
      return res.status(400).json({
        error: "Produto inativo não pode ser adicionado à vitrine",
      });
    }

    const item = await showcaseModels.adicionarItemDestaque(id, procod);
    showcasesCache.invalidate();

    if (!item) {
      return res
        .status(200)
        .json({ message: "Produto já está na vitrine", jaExistia: true });
    }

    res.status(201).json(item);
  } catch (error) {
    console.error("Erro ao adicionar item à vitrine:", error);
    res.status(500).json({ error: "Erro ao adicionar produto à vitrine" });
  }
};

// DELETE /showcases/admin/:id/items/:procod — remove produto dos Destaques.
exports.removerItem = async (req, res) => {
  const id = parseIntegerParam(req.params.id);
  const procod = parseIntegerParam(req.params.procod);

  if (id === null || procod === null) {
    return res.status(400).json({ error: "Vitrine ou produto inválidos" });
  }

  try {
    const showcase = await showcaseModels.buscarShowcasePorId(id);
    if (!showcase) {
      return res.status(404).json({ error: "Vitrine não encontrada" });
    }
    if (showcase.type !== TIPO_MANUAL) {
      return res.status(400).json({
        error: "Somente a vitrine Destaques permite seleção manual de produtos",
      });
    }

    const removido = await showcaseModels.removerItemDestaque(id, procod);
    if (!removido) {
      return res.status(404).json({ error: "Produto não está na vitrine" });
    }

    showcasesCache.invalidate();
    res.status(200).json({ message: "Produto removido da vitrine" });
  } catch (error) {
    console.error("Erro ao remover item da vitrine:", error);
    res.status(500).json({ error: "Erro ao remover produto da vitrine" });
  }
};

// POST /showcases/admin/:id/items/ordem — reordena os produtos dos Destaques.
exports.atualizarOrdemItens = async (req, res) => {
  const id = parseIntegerParam(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "Vitrine inválida ou não informada" });
  }

  const ordem = req.body ? req.body.ordem : null;
  if (!Array.isArray(ordem)) {
    return res.status(400).json({ error: "Ordem inválida" });
  }

  const procs = ordem.map((valor) => parseIntegerParam(valor));
  if (procs.some((valor) => valor === null)) {
    return res.status(400).json({ error: "Ordem inválida" });
  }

  try {
    const showcase = await showcaseModels.buscarShowcasePorId(id);
    if (!showcase) {
      return res.status(404).json({ error: "Vitrine não encontrada" });
    }
    if (showcase.type !== TIPO_MANUAL) {
      return res.status(400).json({
        error: "Somente a vitrine Destaques permite reordenar produtos",
      });
    }

    const itens = await showcaseModels.listarItensShowcase(id, {
      somenteAtivos: false,
    });
    const procsUnicos = new Set(procs);
    const itensAtuais = new Set(itens.map((item) => Number(item.procod)));
    const ordemValida =
      procsUnicos.size === procs.length &&
      itens.length === procs.length &&
      procs.every((procod) => itensAtuais.has(procod));

    if (!ordemValida) {
      return res.status(400).json({
        error: "A ordem deve conter todos os produtos da vitrine",
      });
    }

    await showcaseModels.atualizarOrdemItensShowcase(id, procs);
    showcasesCache.invalidate();
    res.status(200).json({ message: "Ordem atualizada com sucesso" });
  } catch (error) {
    console.error("Erro ao reordenar itens da vitrine:", error);
    res.status(500).json({ error: "Erro ao reordenar produtos da vitrine" });
  }
};
