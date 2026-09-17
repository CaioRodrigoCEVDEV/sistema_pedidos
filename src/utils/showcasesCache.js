const crypto = require("crypto");

// Cache em memória das vitrines públicas. Mesmo padrão do catalogoCache:
// uma única entrada com TTL curto e ETag, invalidada sempre que a
// configuração das vitrines (ou uma venda/devolução) muda.
//
// O cache é separado do catalogoCache porque aquele guarda outra resposta
// (lista completa de produtos) e compartilhar a mesma entrada faria uma
// sobrescrever a outra.
const TTL_MS = (() => {
  const parsed = parseInt(process.env.SHOWCASES_CACHE_TTL_MS || "30000", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 30000;
})();

let entry = null;

function buildEtag(body) {
  return `"${crypto.createHash("sha1").update(body).digest("hex")}"`;
}

function get() {
  if (entry && Date.now() < entry.expiresAt) {
    return entry;
  }
  return null;
}

function set(payload) {
  const body = Buffer.from(JSON.stringify(payload));
  entry = { body, etag: buildEtag(body), expiresAt: Date.now() + TTL_MS };
  return entry;
}

function invalidate() {
  entry = null;
}

function getTtlMs() {
  return TTL_MS;
}

module.exports = {
  get,
  set,
  invalidate,
  getTtlMs,
};
