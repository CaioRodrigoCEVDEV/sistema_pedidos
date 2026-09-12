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
