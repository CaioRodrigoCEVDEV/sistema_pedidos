const crypto = require("crypto");

/**
 * Cache em memória para listas públicas e pouco mutáveis do catálogo
 * (marcas, tipos, cores, modelos). Evita ir ao PostgreSQL a cada request,
 * com ETag para respostas 304. Deve ser invalidado nos writes correspondentes.
 *
 * TTL configurável por CATALOG_LIST_CACHE_TTL_MS (padrão 30s).
 */

function parseTtl(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const TTL_MS = parseTtl(process.env.CATALOG_LIST_CACHE_TTL_MS, 30000);

function createListCache(name, ttlMs) {
  let entry = null;

  return {
    name,
    getTtlMs: () => ttlMs,
    get() {
      if (entry && Date.now() < entry.expiresAt) {
        return entry;
      }
      return null;
    },
    set(rows) {
      const body = Buffer.from(JSON.stringify(rows));
      const etag = `"${crypto.createHash("sha1").update(body).digest("hex")}"`;
      entry = { body, etag, expiresAt: Date.now() + ttlMs };
      return entry;
    },
    invalidate() {
      entry = null;
    },
  };
}

// Envia uma entrada de cache com ETag. Retorna 304 quando o cliente já tem a
// versão atual; caso contrário envia o mesmo corpo que gerou o ETag.
function sendCached(req, res, entry) {
  res.set("ETag", entry.etag);
  res.set("Cache-Control", "private, max-age=0, must-revalidate");

  if (req.headers["if-none-match"] === entry.etag) {
    return res.status(304).end();
  }

  return res.type("application/json").status(200).send(entry.body);
}

module.exports = {
  TTL_MS,
  createListCache,
  sendCached,
  marcasCache: createListCache("marcas", TTL_MS),
  tiposCache: createListCache("tipos", TTL_MS),
  coresCache: createListCache("cores", TTL_MS),
  modelosCache: createListCache("modelos", TTL_MS),
};
