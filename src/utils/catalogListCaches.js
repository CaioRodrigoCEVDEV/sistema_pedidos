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

// Cache por chave (ex.: id de marca/modelo). Evita ir ao banco nas APIs de
// navegação do catálogo; invalidado por inteiro nos writes (catálogo pequeno).
function createKeyedCache(name, ttlMs, maxEntries = 500) {
  const entries = new Map();

  return {
    name,
    getTtlMs: () => ttlMs,
    get(key) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (Date.now() >= entry.expiresAt) {
        entries.delete(key);
        return null;
      }
      return entry;
    },
    set(key, value) {
      const body = Buffer.from(JSON.stringify(value));
      const etag = `"${crypto.createHash("sha1").update(body).digest("hex")}"`;
      const entry = { body, etag, expiresAt: Date.now() + ttlMs };
      entries.set(key, entry);

      if (entries.size > maxEntries) {
        // Evita crescimento ilimitado: remove a chave mais antiga (ordem de inserção).
        const oldest = entries.keys().next().value;
        entries.delete(oldest);
      }
      return entry;
    },
    invalidate(key) {
      entries.delete(key);
    },
    invalidateAll() {
      entries.clear();
    },
    size() {
      return entries.size;
    },
  };
}

module.exports = {
  TTL_MS,
  createListCache,
  createKeyedCache,
  sendCached,
  marcasCache: createListCache("marcas", TTL_MS),
  tiposCache: createListCache("tipos", TTL_MS),
  coresCache: createListCache("cores", TTL_MS),
  modelosCache: createListCache("modelos", TTL_MS),
  // APIs de navegação do catálogo (/marcas/:id, /modelo/:id, /mod/:id, /tipo/:id, /modtipo/:id)
  catalogoNavCache: createKeyedCache("catalogo-nav", TTL_MS),
};
