const crypto = require("crypto");

const TTL_MS = (() => {
  const parsed = parseInt(process.env.CATALOGO_CACHE_TTL_MS || "30000", 10);
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

function set(rows) {
  const body = Buffer.from(JSON.stringify(rows));
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
