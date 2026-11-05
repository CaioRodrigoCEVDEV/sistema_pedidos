const pool = require("../config/db");

const INTERVAL_MS = 15_000;
let running = false;

function config() {
  const baseUrl = process.env.CRM_API_BASE_URL;
  const storeId = process.env.CRM_STORE_ID;
  const secret = process.env.CRM_STORE_SECRET;
  if (!baseUrl || !storeId || !secret) return null;
  const url = new URL(`/api/store-orders/stores/${encodeURIComponent(storeId)}/approved`, baseUrl);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("CRM_API_BASE_URL deve usar HTTPS fora do ambiente local.");
  }
  return { url, secret };
}

async function deliverOne(settings, row) {
  try {
    const response = await fetch(settings.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${settings.secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        externalOrderId: String(row.pvcod),
        approvedAt: row.approved_at.toISOString(),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`CRM respondeu HTTP ${response.status}`);
    await pool.query(
      `UPDATE public.crm_order_approval_outbox
       SET delivered_at = now(), last_error = NULL
       WHERE pvcod = $1 AND delivered_at IS NULL`,
      [row.pvcod]
    );
  } catch (error) {
    const nextAttempts = row.attempts + 1;
    const retrySeconds = Math.min(3600, 15 * (2 ** Math.min(nextAttempts - 1, 8)));
    const message = String(error.message || "Falha de comunicação").slice(0, 200);
    await pool.query(
      `UPDATE public.crm_order_approval_outbox
       SET attempts = attempts + 1,
           next_attempt_at = now() + ($2 * interval '1 second'),
           last_error = $3
       WHERE pvcod = $1 AND delivered_at IS NULL`,
      [row.pvcod, retrySeconds, message]
    );
  }
}

async function dispatchApprovals() {
  if (running) return;
  const settings = config();
  if (!settings) return;
  running = true;
  try {
    const result = await pool.query(
      `SELECT pvcod, approved_at, attempts
       FROM public.crm_order_approval_outbox
       WHERE delivered_at IS NULL AND next_attempt_at <= now()
       ORDER BY next_attempt_at, pvcod LIMIT 20`
    );
    for (const row of result.rows) await deliverOne(settings, row);
  } finally {
    running = false;
  }
}

function startCrmOrderApprovalDispatch() {
  const timer = setInterval(() => {
    dispatchApprovals().catch((error) => {
      console.error("Falha ao processar fila de aprovações do CRM:", error.message);
    });
  }, INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = { dispatchApprovals, startCrmOrderApprovalDispatch };
