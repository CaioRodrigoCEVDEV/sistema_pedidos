const pool = require("../config/db");

// Cache curto da configuracao de estoque da empresa. A tabela emp tem uma
// unica linha por instalacao, entao evitamos consultar o banco em toda leitura
// de catalogo/vitrines.
const TTL_MS = 30000;

let entry = null;

function normalizar(usaEstoque, estoqueMin) {
  const usa = String(usaEstoque || "N").trim().toUpperCase() === "S" ? "S" : "N";
  const min = Number.isInteger(Number(estoqueMin)) && Number(estoqueMin) >= 0
    ? Number(estoqueMin)
    : 5;
  return { usaEstoque: usa === "S", empusaest: usa, estoqueMin: min };
}

async function getEstoqueConfig() {
  if (entry && Date.now() < entry.expiresAt) {
    return entry.value;
  }

  try {
    const result = await pool.query(
      `SELECT COALESCE(TRIM(empusaest), 'N') AS empusaest,
              COALESCE(empestoqmin, 5) AS empestoqmin
         FROM emp
        ORDER BY empcod
        LIMIT 1`
    );
    const row = result.rows[0] || {};
    const value = normalizar(row.empusaest, row.empestoqmin);
    entry = { value, expiresAt: Date.now() + TTL_MS };
    return value;
  } catch (error) {
    // Sem a coluna/config, assume empresa que nao controla estoque.
    console.error("Erro ao carregar configuracao de estoque:", error.message);
    return { usaEstoque: false, empusaest: "N", estoqueMin: 5 };
  }
}

function invalidateEstoqueConfigCache() {
  entry = null;
}

module.exports = {
  getEstoqueConfig,
  invalidateEstoqueConfigCache,
  normalizar,
  TTL_MS,
};
