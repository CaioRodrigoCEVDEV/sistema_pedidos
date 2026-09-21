/**
 * Performance Middleware
 *
 * Instrumentação leve de performance por request.
 * Controle via variáveis de ambiente:
 *   REQUEST_LOGGING=true     — loga método, rota, status e tempo total de cada request
 *   SQL_TRACE=true           — loga, por request, quantas queries rodaram, tempo de SQL,
 *                              tempo de processamento (Node), conexões novas e cada query
 *   LOG_SLOW_QUERIES_MS=200  — loga queries que demoram mais que o valor (ms)
 *                              0 desabilita (padrão); cobre pool.query e client.query
 */

const REQUEST_LOGGING = process.env.REQUEST_LOGGING === "true";
const SQL_TRACE = process.env.SQL_TRACE === "true";

const { createContext, run } = require("../utils/queryMetrics");

/**
 * Middleware Express que registra o tempo total de cada request e, quando
 * SQL_TRACE=true, detalha as queries SQL associadas ao request.
 */
function requestTimingMiddleware(req, res, next) {
  if (!REQUEST_LOGGING && !SQL_TRACE) return next();

  const start = Date.now();
  const context = createContext();

  res.on("finish", () => {
    const duration = Date.now() - start;

    if (REQUEST_LOGGING) {
      console.log(`[PERF] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    }

    if (SQL_TRACE) {
      const sqlMs = Math.round(context.totalSqlMs);
      const processing = Math.max(0, duration - sqlMs);
      const bytes = res.getHeader("content-length");
      const sizePart = bytes !== undefined ? ` bytes=${bytes}` : "";

      console.log(
        `[SQL] ${req.method} ${req.originalUrl} ${res.statusCode}` +
          ` total=${duration}ms queries=${context.queries.length}` +
          ` sql=${sqlMs}ms processing=${processing}ms` +
          ` newConn=${context.newConnections}${sizePart}`
      );

      context.queries.forEach((query, index) => {
        console.log(`      q${index + 1} ${query.durationMs}ms [${query.source}] | ${query.sql}`);
      });
    }
  });

  run(context, () => next());
}

module.exports = { requestTimingMiddleware };
