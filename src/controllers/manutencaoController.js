const manutencaoCache = require("../utils/manutencaoCache");

// Retorna o aviso de manutenção atual. O contrato é sempre um objeto JSON:
// - { ativo: false } quando não há aviso, a API falha ou não está configurada;
// - { ativo: true, titulo, mensagem } quando há aviso válido.
//
// A URL da API externa fica somente no backend (MAINTENANCE_API_URL), nunca é
// exposta ao navegador.
exports.obterManutencao = async (req, res) => {
  let manutencao = null;
  try {
    manutencao = await manutencaoCache.getManutencao();
  } catch (error) {
    console.error("Erro ao obter manutenção:", error);
  }

  res.set("Cache-Control", "no-store");

  if (!manutencao) {
    return res.status(200).json({ ativo: false });
  }

  return res.status(200).json(manutencao);
};
