const proModels = require("../models/proModels");


exports.listarProdutosComEstoque = async (req, res) => {
  try {
    const result = await proModels.listarProdutosComEstoque();
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar produtos estoque" });
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
