function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const MAX_ATTEMPTS = parsePositiveInt(process.env.LOGIN_MAX_ATTEMPTS, 4);
const BLOCK_MS = parsePositiveInt(process.env.LOGIN_BLOCK_MS, 15 * 60 * 1000);
const WINDOW_MS = parsePositiveInt(process.env.LOGIN_WINDOW_MS, 15 * 60 * 1000);

const LIMITE_MENSAGEM = 'Muitas tentativas de login. Tente novamente em instantes.';

const store = new Map();

function normalizeIp(ip) {
  if (!ip) return 'unknown';
  return String(ip).replace(/^::ffff:/, '');
}

function buildLoginKey(ip, email) {
  const normalizedEmail = String(email == null ? '' : email).trim().toLowerCase();
  return `${normalizeIp(ip)}|${normalizedEmail}`;
}

function isExpired(entry, now) {
  if (!entry) return true;
  if (entry.blockedUntil && entry.blockedUntil > now) return false;
  return now - entry.lastAt > WINDOW_MS;
}

function checkLoginAttempt(key) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) return { blocked: false, retryAfterSec: 0 };

  if (entry.blockedUntil) {
    if (entry.blockedUntil > now) {
      return {
        blocked: true,
        retryAfterSec: Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000)),
      };
    }
    store.delete(key);
    return { blocked: false, retryAfterSec: 0 };
  }

  if (isExpired(entry, now)) {
    store.delete(key);
    return { blocked: false, retryAfterSec: 0 };
  }

  return { blocked: false, retryAfterSec: 0 };
}

function registerLoginFailure(key) {
  const now = Date.now();
  let entry = store.get(key);

  if (isExpired(entry, now)) {
    entry = null;
  }

  if (!entry) {
    entry = { count: 0, firstAt: now, lastAt: now, blockedUntil: 0 };
  }

  entry.count += 1;
  entry.lastAt = now;

  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_MS;
  }

  store.set(key, entry);
  return entry;
}

function resetLoginAttempts(key) {
  store.delete(key);
}

function clearAllLoginAttempts() {
  store.clear();
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (isExpired(entry, now)) store.delete(key);
  }
}, Math.min(WINDOW_MS, BLOCK_MS));

if (cleanupTimer.unref) cleanupTimer.unref();

module.exports = {
  MAX_ATTEMPTS,
  BLOCK_MS,
  WINDOW_MS,
  LIMITE_MENSAGEM,
  buildLoginKey,
  checkLoginAttempt,
  registerLoginFailure,
  resetLoginAttempts,
  clearAllLoginAttempts,
};
