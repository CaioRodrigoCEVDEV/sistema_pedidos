const { Pool } = require("pg");
const { recordQuery, recordNewConnection } = require("../utils/queryMetrics");
require("dotenv").config({ path: "../.env" });

// Pool de conexões configurável via env para ambientes com pouco recurso
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Número máximo de clientes no pool (padrão 10; reduzir em Docker com pouca RAM)
  max: parseInt(process.env.DB_POOL_MAX || "10", 10),
  // Tempo (ms) que um cliente inativo fica no pool antes de ser fechado
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || "30000", 10),
  // Tempo (ms) máximo para obter uma conexão do pool
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS || "5000", 10),
  // Mantém o TCP vivo em links com NAT/timeout, evitando reconectar a cada request
  keepAlive: true,
  // Identifica as conexões da aplicação no pg_stat_activity
  application_name: process.env.DB_APPLICATION_NAME || "sistema_pedidos",
});

// --- Instrumentação de queries (inerte quando não há request em andamento) ---

function extractSql(args) {
  const first = args[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && typeof first.text === "string") {
    return first.text;
  }
  return "";
}

// Log de queries lentas — habilitado quando LOG_SLOW_QUERIES_MS > 0.
// Cobre tanto pool.query quanto client.query (transações).
const slowMs = parseInt(process.env.LOG_SLOW_QUERIES_MS || "0", 10);
const slowEnabled = Number.isFinite(slowMs) && slowMs > 0;
function logIfSlow(sql, duration) {
  if (slowEnabled && duration >= slowMs) {
    console.warn(`[SLOW QUERY] ${duration}ms | ${sql.replace(/\s+/g, " ").trim().slice(0, 250)}`);
  }
}

// Define statement_timeout em cada conexão nova e contabiliza conexões físicas
pool.on("connect", (client) => {
  recordNewConnection();
  const timeout = parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || "30000", 10);
  // Validate before interpolating (parseInt returns NaN for invalid input)
  const safeTimeout = Number.isFinite(timeout) && timeout >= 0 ? timeout : 30000;
  client.query(`SET statement_timeout = ${safeTimeout}`).catch(() => {});
});

// Mede queries feitas em clients dedicados (transações), que não passam por pool.query
function wrapClient(client) {
  if (!client || client.__ouQueryWrapped) return client;
  const originalClientQuery = client.query.bind(client);
  client.query = function (...args) {
    const start = Date.now();
    const result = originalClientQuery(...args);
    if (result && typeof result.then === "function") {
      return result.then((res) => {
        const duration = Date.now() - start;
        const sql = extractSql(args);
        recordQuery({ sql, durationMs: duration, source: "client" });
        logIfSlow(sql, duration);
        return res;
      });
    }
    return result;
  };
  client.__ouQueryWrapped = true;
  return client;
}

// Mede queries do pool. O pool obtém/reutiliza conexões internamente; esta
// medição cobre o ciclo completo (aquisição de conexão + execução + release).
const originalQuery = pool.query.bind(pool);
pool.query = function (...args) {
  const start = Date.now();
  const result = originalQuery(...args);
  if (result && typeof result.then === "function") {
    return result.then((res) => {
      const duration = Date.now() - start;
      const sql = extractSql(args);
      recordQuery({ sql, durationMs: duration, source: "pool" });
      logIfSlow(sql, duration);
      return res;
    });
  }
  return result;
};

// Garante que clients obtidos explicitamente (transações) também sejam medidos
const originalConnect = pool.connect.bind(pool);
pool.connect = function (...args) {
  const result = originalConnect(...args);
  if (result && typeof result.then === "function") {
    return result.then((client) => wrapClient(client));
  }
  return result;
};

module.exports = pool;
