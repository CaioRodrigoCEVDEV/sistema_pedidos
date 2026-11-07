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
    const snapshot = await pool.query(
      `SELECT COALESCE(pv.pvvl, 0)::text AS total_amount,
              i.pviprocod::text AS product_code,
              COALESCE(p.prodes, 'Peça ' || i.pviprocod::text) AS description,
              c.cornome AS color_name,
              COALESCE(i.pviqtde, 0)::text AS quantity,
              COALESCE(i.pvivl, 0)::text AS unit_price,
              ROUND(COALESCE(i.pviqtde, 0) * COALESCE(i.pvivl, 0), 4)::text AS line_total
       FROM public.pv pv
       LEFT JOIN public.pvi i ON i.pvipvcod = pv.pvcod
       LEFT JOIN public.pro p ON p.procod = i.pviprocod
       LEFT JOIN public.cores c ON c.corcod = i.pviprocorid
       WHERE pv.pvcod = $1
       ORDER BY i.pviprocod, i.pviprocorid`,
      [row.pvcod]
    );
    if (snapshot.rows.length === 0) throw new Error('Pedido não encontrado para envio ao CRM');
    const items = snapshot.rows.filter((item) => item.product_code !== null && Number(item.quantity) > 0)
      .map((item) => ({
        productCode: item.product_code,
        description: item.color_name ? `${item.description} - ${item.color_name}` : item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        lineTotal: item.line_total,
      }));
    const response = await fetch(settings.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${settings.secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        externalOrderId: String(row.pvcod),
        approvedAt: row.approved_at.toISOString(),
        items,
        totalAmount: snapshot.rows[0].total_amount,
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
