/**
 * Coleta de métricas de SQL por request.
 *
 * Usa AsyncLocalStorage para associar cada query executada (via pool ou via
 * client de transação) ao request HTTP que a originou. Fica inerte quando não
 * há contexto ativo (ex.: startup, scripts, testes), então não altera o
 * comportamento da aplicação e não loga nada por conta própria.
 *
 * O contexto é criado e logado por src/middlewares/performanceMiddleware.js
 * apenas quando SQL_TRACE=true.
 */

const { AsyncLocalStorage } = require("async_hooks");

const storage = new AsyncLocalStorage();

function createContext() {
  return {
    queries: [],
    totalSqlMs: 0,
    newConnections: 0,
  };
}

function run(context, fn) {
  return storage.run(context, fn);
}

function getContext() {
  return storage.getStore() || null;
}

function normalizeSql(sql) {
  return String(sql || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function recordQuery({ sql, durationMs, source }) {
  const context = getContext();
  if (!context) return;
  context.queries.push({
    sql: normalizeSql(sql),
    durationMs,
    source: source || "pool",
  });
  context.totalSqlMs += durationMs;
}

function recordNewConnection() {
  const context = getContext();
  if (!context) return;
  context.newConnections += 1;
}

module.exports = {
  createContext,
  run,
  getContext,
  recordQuery,
  recordNewConnection,
  normalizeSql,
};
