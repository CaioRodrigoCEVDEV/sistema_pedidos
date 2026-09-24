const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const LOGO_PATH = path.join(__dirname, "..", "uploads", "logo.jpg");
const TOUCH_PATH = path.join(__dirname, "..", "uploads", "apple-touch-icon.png");

let cache = { key: null, version: "0" };

function statKey(file) {
  try {
    const stat = fs.statSync(file);
    return `${Math.floor(stat.mtimeMs)}-${stat.size}`;
  } catch (e) {
    return null;
  }
}

// Versão estável derivada dos arquivos da logo (mtime + tamanho). Muda sempre
// que a logo é substituída pelo painel e serve de cache-busting para o
// manifest.json, favicon e apple-touch-icon — dando ao Android/Chrome o sinal
// de que o ícone da PWA mudou.
function logoVersion() {
  const logoKey = statKey(LOGO_PATH);
  if (!logoKey) return "0";

  const touchKey = statKey(TOUCH_PATH);
  const key = touchKey ? `${logoKey}|${touchKey}` : logoKey;

  if (cache.key !== key) {
    cache = {
      key,
      version: crypto.createHash("sha1").update(key).digest("hex").slice(0, 12),
    };
  }
  return cache.version;
}

module.exports = { logoVersion, LOGO_PATH, TOUCH_PATH };
