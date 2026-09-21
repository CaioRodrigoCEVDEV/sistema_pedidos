#!/usr/bin/env node
/**
 * Reproduz o teste de latência dos endpoints do backend.
 *
 * Uso:
 *   BASE_URL=http://localhost:4000 node scripts/bench-endpoints.js
 *   BASE_URL=http://localhost:4000 TOKEN=<jwt> node scripts/bench-endpoints.js
 *
 * TOKEN é opcional: sem ele, os endpoints autenticados (/v2/*) são pulados.
 * Faz apenas GETs de leitura; não altera dados.
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:4000";
const TOKEN = process.env.TOKEN || "";

const PUBLIC_ENDPOINTS = [
  "/api/version",
  "/marcas",
  "/modelos",
  "/tipos",
  "/emp",
  "/pros?page=1&pageSize=1",
];

const AUTH_ENDPOINTS = ["/v2/pedidos/total", "/v2/top/marcas/mes", "/v2/pedidos/total/anual"];

async function measure(path) {
  const url = `${BASE_URL}${path}`;
  const headers = TOKEN ? { Cookie: `token=${TOKEN}` } : {};
  const start = process.hrtime.bigint();
  try {
    const res = await fetch(url, { headers, redirect: "manual" });
    const body = await res.arrayBuffer();
    const totalMs = Number(process.hrtime.bigint() - start) / 1e6;
    return {
      path,
      status: res.status,
      totalMs: totalMs.toFixed(1),
      bytes: body.byteLength,
    };
  } catch (error) {
    const totalMs = Number(process.hrtime.bigint() - start) / 1e6;
    return { path, status: "ERR", totalMs: totalMs.toFixed(1), bytes: 0, error: error.message };
  }
}

async function main() {
  console.log(`BASE_URL=${BASE_URL}`);
  console.log(`TOKEN=${TOKEN ? "definido" : "ausente (pulando /v2/*)"}\n`);

  const endpoints = [...PUBLIC_ENDPOINTS];
  if (TOKEN) endpoints.push(...AUTH_ENDPOINTS);

  const rows = [];
  for (const path of endpoints) {
    const result = await measure(path);
    rows.push(result);
    const err = result.error ? ` (${result.error})` : "";
    console.log(
      `${path.padEnd(32)} status=${String(result.status).padEnd(4)} total=${result.totalMs}ms bytes=${result.bytes}${err}`
    );
  }

  console.log("\nResumo:");
  console.table(rows);
}

main();
