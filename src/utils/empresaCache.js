const pool = require("../config/db");

// Cache curto dos dados da empresa (tabela de linha unica). Evita consultar o
// banco em toda leitura de /emp e no /manifest.json. Invalide ao gravar.
const TTL_MS = 60000;

let entry = null;

async function getEmpresa() {
  if (entry && Date.now() < entry.expiresAt) {
    return entry.value;
  }

  const result = await pool.query("SELECT * FROM emp ORDER BY empcod LIMIT 1");
  entry = { value: result.rows[0] || null, expiresAt: Date.now() + TTL_MS };
  return entry.value;
}

function invalidateEmpresaCache() {
  entry = null;
}

module.exports = {
  getEmpresa,
  invalidateEmpresaCache,
  TTL_MS,
};
