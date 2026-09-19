// Cache curto do aviso de manutenção. A fonte é uma API externa cujo
// contrato JSON é fixo:
//
// {
//   "ativo": true,
//   "titulo": "Manutenção programada",
//   "mensagem": "O sistema ficará indisponível durante este período."
// }
//
// Qualquer falha (rede, timeout, status != 2xx, JSON inválido) resulta em
// `null`, e o frontend simplesmente não exibe o aviso. Assim a API externa
// nunca derruba nem atrasa o shell autenticado.

const TTL_MS = 60000;
const DEFAULT_TIMEOUT_MS = 3000;

let entry = null;
let inFlight = null;

function getApiUrl() {
  return process.env.MAINTENANCE_API_URL || "";
}

function getTimeoutMs() {
  const value = Number.parseInt(process.env.MAINTENANCE_API_TIMEOUT_MS, 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

function isAtivo(value) {
  if (value === true) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "s" || normalized === "1";
  }
  return false;
}

function normalize(data) {
  if (!data || typeof data !== "object") return null;
  if (!isAtivo(data.ativo)) return null;

  return {
    ativo: true,
    titulo: typeof data.titulo === "string" ? data.titulo : "",
    mensagem: typeof data.mensagem === "string" ? data.mensagem : "",
  };
}

async function fetchManutencao() {
  const url = getApiUrl();
  if (!url) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const headers = { Accept: "application/json" };
    if (process.env.MAINTENANCE_API_TOKEN) {
      headers.Authorization = `Bearer ${process.env.MAINTENANCE_API_TOKEN}`;
    }

    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return normalize(data);
  } catch (error) {
    console.warn(
      "[manutencao] Nao foi possivel consultar a API:",
      error.message
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getManutencao() {
  if (entry && Date.now() < entry.expiresAt) {
    return entry.value;
  }
  if (inFlight) {
    return inFlight;
  }

  inFlight = fetchManutencao()
    .then((value) => {
      entry = { value, expiresAt: Date.now() + TTL_MS };
      return value;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

function invalidateManutencaoCache() {
  entry = null;
}

module.exports = {
  getManutencao,
  invalidateManutencaoCache,
  TTL_MS,
};
