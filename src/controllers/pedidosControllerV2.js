const pedidoModels = require("../models/pedidoModels");

exports.totalVendas = async (req, res) => {
  try {
    const result = await pedidoModels.totalVendas();
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro buscar total vendas" });
  }
}