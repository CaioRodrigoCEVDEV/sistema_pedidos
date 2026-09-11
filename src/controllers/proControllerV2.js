const proModels = require("../models/proModels");
const catalogoCache = require("../utils/catalogoCache");

exports.listarTodosProdutos = async (req, res) => {
  try {
    let entry = catalogoCache.get();

    if (!entry) {
      const result = await proModels.listarTodosProdutos();
      entry = catalogoCache.set(result);
    }

    res.set("ETag", entry.etag);
    res.set("Cache-Control", "private, max-age=0, must-revalidate");

    if (req.headers["if-none-match"] === entry.etag) {
      return res.status(304).end();
    }

    res.type("application/json").status(200).send(entry.body);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
};

exports.listarProdutosComEstoque = async (req, res) => {
  try {
    const result = await proModels.listarProdutosComEstoque();
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar produtos estoque" });
  }
};

exports.listarProdutosComEstoqueItem = async (req, res) => {
  const { marca, modelo } = req.params;
  try {
    const result = await proModels.listarProdutosComEstoqueItem(marca, modelo);
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar produto com estoque" });
  }
};

exports.listarProdutosSemEstoque = async (req, res) => {
  try {
    const result = await proModels.listarProdutosSemEstoque();
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar produtos estoque" });
  }
};

exports.listarProdutosSemEstoqueItem = async (req, res) => {
  const { marca, modelo } = req.params;
  try {
    const result = await proModels.listarProdutosSemEstoqueItem(marca, modelo);
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar produto sem estoque" });
  }
};

exports.listarProdutosComEstoqueAcabando = async (req, res) => {
  const { marca, modelo } = req.params;
  try {
    const result = await proModels.listarProdutosComEstoqueAcabando(
      marca,
      modelo
    );
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Erro ao buscar produto com estoque acabando" });
  }
};

exports.listarProdutosComEstoqueAcabandoItem = async (req, res) => {
  const { marca, modelo } = req.params;
  try {
    const result = await proModels.listarProdutosComEstoqueAcabandoItem(
      marca,
      modelo
    );
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Erro ao buscar produto com estoque acabando item" });
  }
};

exports.listarProdutosEmFalta = async (req, res) => {
  const { marca, modelo } = req.params;
  try {
    const result = await proModels.listarProdutosEmFalta(marca, modelo);
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Erro ao buscar produto com estoque em falta" });
  }
};

exports.listarProdutosEmFaltaItem = async (req, res) => {
  const { marca, modelo } = req.params;
  try {
    const result = await proModels.listarProdutosEmFaltaItem(marca, modelo);
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Erro ao buscar produto com estoque em falta item" });
  }
};
