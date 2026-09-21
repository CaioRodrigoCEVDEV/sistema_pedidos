const promocaoModels = require("../models/promocaoModels");
const catalogoCache = require("../utils/catalogoCache");
const showcasesCache = require("../utils/showcasesCache");
const { parseIntegerParam } = require("../utils/parseIntegerParam");

const TIPOS_VALIDOS = new Set(["P", "V"]);
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

function invalidarCaches() {
  catalogoCache.invalidate();
  showcasesCache.invalidate();
}

// Aceita 'P'/'V' (case-insensitive) e retorna null quando inválido.
function normalizarTipo(valor) {
  if (typeof valor !== "string") return null;
  const tipo = valor.trim().toUpperCase();
  return TIPOS_VALIDOS.has(tipo) ? tipo : null;
}

function parseValor(valor) {
  const numero = typeof valor === "string" ? Number(valor.replace(",", ".")) : Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

// Normaliza data para 'YYYY-MM-DD' (string) ou null. Retorna undefined quando o
// formato é inválido, para diferenciar "não informado" de "inválido".
function parseData(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== "string") return undefined;
  const limpo = valor.trim();
  if (limpo === "") return null;
  if (!REGEX_DATA.test(limpo)) return undefined;

  const [ano, mes, dia] = limpo.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const valida =
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia;
  return valida ? limpo : undefined;
}

// Valida o estado final da promoção. Retorna uma mensagem de erro ou null.
function validarPromocao({ tipo, valor, dtinicio, dtfim, provl }) {
  if (!TIPOS_VALIDOS.has(tipo)) {
    return "Tipo de desconto inválido";
  }
  if (valor === null || !(valor > 0)) {
    return "Valor do desconto deve ser maior que zero";
  }
  if (tipo === "P" && valor > 100) {
    return "Percentual de desconto deve ser no máximo 100";
  }
  if (tipo === "V" && valor >= provl) {
    return "Valor fixo do desconto deve ser menor que o preço do produto";
  }
  if (dtinicio && dtfim && dtfim < dtinicio) {
    return "Data final não pode ser anterior à data inicial";
  }
  return null;
}

// GET /promocoes/admin
exports.listarAdmin = async (req, res) => {
  try {
    const promocoes = await promocaoModels.listarAdmin();
    res.status(200).json({ promocoes });
  } catch (error) {
    console.error("Erro ao listar promoções:", error);
    res.status(500).json({ error: "Erro ao buscar promoções" });
  }
};

// POST /promocoes
exports.criar = async (req, res) => {
  const body = req.body || {};
  const procod = parseIntegerParam(body.procod);
  const tipo = normalizarTipo(body.tipo);
  const valor = parseValor(body.valor);
  const ativo = body.ativo === undefined ? true : body.ativo === true;
  const dtinicio = parseData(body.dtinicio);
  const dtfim = parseData(body.dtfim);

  if (procod === null) {
    return res.status(400).json({ error: "Produto inválido ou não informado" });
  }
  if (dtinicio === undefined || dtfim === undefined) {
    return res.status(400).json({ error: "Data inválida (use AAAA-MM-DD)" });
  }

  try {
    const produto = await promocaoModels.buscarProduto(procod);
    if (!produto) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    const erro = validarPromocao({
      tipo,
      valor,
      dtinicio,
      dtfim,
      provl: Number(produto.provl) || 0,
    });
    if (erro) {
      return res.status(400).json({ error: erro });
    }

    const promocao = await promocaoModels.salvar({
      procod,
      tipo,
      valor,
      ativo,
      dtinicio,
      dtfim,
    });

    invalidarCaches();
    res.status(201).json(promocao);
  } catch (error) {
    console.error("Erro ao criar promoção:", error);
    res.status(500).json({ error: "Erro ao salvar promoção" });
  }
};

// PUT /promocoes/:procod
exports.atualizar = async (req, res) => {
  const procod = parseIntegerParam(req.params.procod);
  if (procod === null) {
    return res.status(400).json({ error: "Produto inválido ou não informado" });
  }

  const body = req.body || {};
  const campos = {};

  if (body.tipo !== undefined) {
    const tipo = normalizarTipo(body.tipo);
    if (tipo === null) {
      return res.status(400).json({ error: "Tipo de desconto inválido" });
    }
    campos.tipo = tipo;
  }

  if (body.valor !== undefined) {
    const valor = parseValor(body.valor);
    if (valor === null) {
      return res.status(400).json({ error: "Valor do desconto inválido" });
    }
    campos.valor = valor;
  }

  if (body.ativo !== undefined) {
    if (typeof body.ativo !== "boolean") {
      return res.status(400).json({ error: "Status da promoção inválido" });
    }
    campos.ativo = body.ativo;
  }

  if (body.dtinicio !== undefined) {
    const dtinicio = parseData(body.dtinicio);
    if (dtinicio === undefined) {
      return res.status(400).json({ error: "Data inicial inválida" });
    }
    campos.dtinicio = dtinicio;
  }

  if (body.dtfim !== undefined) {
    const dtfim = parseData(body.dtfim);
    if (dtfim === undefined) {
      return res.status(400).json({ error: "Data final inválida" });
    }
    campos.dtfim = dtfim;
  }

  if (Object.keys(campos).length === 0) {
    return res.status(400).json({ error: "Nenhuma alteração informada" });
  }

  try {
    const atual = await promocaoModels.buscarPorProcod(procod);
    if (!atual) {
      return res.status(404).json({ error: "Promoção não encontrada" });
    }

    const produto = await promocaoModels.buscarProduto(procod);
    if (!produto) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    const estadoFinal = {
      tipo: campos.tipo !== undefined ? campos.tipo : atual.promocaotipo,
      valor: campos.valor !== undefined ? campos.valor : Number(atual.promocaovalor),
      dtinicio:
        campos.dtinicio !== undefined
          ? campos.dtinicio
          : atual.promocaodtinicio,
      dtfim: campos.dtfim !== undefined ? campos.dtfim : atual.promocaodtfim,
    };

    const erro = validarPromocao({
      ...estadoFinal,
      provl: Number(produto.provl) || 0,
    });
    if (erro) {
      return res.status(400).json({ error: erro });
    }

    const promocao = await promocaoModels.atualizar(procod, campos);
    invalidarCaches();
    res.status(200).json(promocao);
  } catch (error) {
    console.error("Erro ao atualizar promoção:", error);
    res.status(500).json({ error: "Erro ao atualizar promoção" });
  }
};

// DELETE /promocoes/:procod
exports.remover = async (req, res) => {
  const procod = parseIntegerParam(req.params.procod);
  if (procod === null) {
    return res.status(400).json({ error: "Produto inválido ou não informado" });
  }

  try {
    const removido = await promocaoModels.remover(procod);
    if (!removido) {
      return res.status(404).json({ error: "Promoção não encontrada" });
    }

    invalidarCaches();
    res.status(200).json({ message: "Promoção removida com sucesso" });
  } catch (error) {
    console.error("Erro ao remover promoção:", error);
    res.status(500).json({ error: "Erro ao remover promoção" });
  }
};

// POST /carrinho/precos — público. Revalida no servidor os preços dos itens do
// carrinho, garantindo que a loja nunca dependa de preço calculado no cliente.
exports.precosCarrinho = async (req, res) => {
  const itens = req.body ? req.body.itens || req.body.cart : null;
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: "Itens do carrinho inválidos" });
  }

  try {
    const precos = await promocaoModels.calcularPrecosItens(itens);
    res.status(200).json({ itens: precos });
  } catch (error) {
    console.error("Erro ao calcular preços do carrinho:", error);
    res.status(500).json({ error: "Erro ao calcular preços" });
  }
};
