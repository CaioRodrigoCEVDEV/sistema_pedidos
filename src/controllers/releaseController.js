const releaseModels = require("../models/releaseModels");

/**
 * Controlador das releases do sistema.
 *
 * Importante: consulta somente o PostgreSQL. Nenhuma chamada à API do GitHub
 * acontece aqui — a sincronização é feita pelo script scripts/sync-releases.js.
 */

// Lista as releases armazenadas no banco, da mais recente para a mais antiga.
exports.listReleases = async (req, res) => {
  try {
    const releases = await releaseModels.listReleases();
    res.set("Cache-Control", "no-store");
    res.status(200).json(releases);
  } catch (error) {
    console.error("Erro ao listar releases:", error);
    res.status(500).json({ error: "Erro ao listar atualizações" });
  }
};

// Retorna apenas a versão da release mais recente (tag git normalizada).
// Endpoint leve usado para exibir a versão no menu do shell autenticado.
exports.getVersion = async (req, res) => {
  try {
    const version = await releaseModels.latestVersion();
    res.set("Cache-Control", "no-store");
    res.status(200).json({ version: version || null });
  } catch (error) {
    console.error("Erro ao obter versão do sistema:", error);
    res.status(500).json({ version: null });
  }
};
