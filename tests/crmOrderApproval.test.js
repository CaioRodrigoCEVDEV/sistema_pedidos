const test = require("node:test");
const assert = require("node:assert/strict");
const pool = require("../src/config/db");
const { dispatchApprovals } = require("../src/integrations/crmOrderApproval");

test("envia aprovação com a credencial da loja e marca a saída como entregue", async () => {
  const previous = {
    url: process.env.CRM_API_BASE_URL,
    storeId: process.env.CRM_STORE_ID,
    secret: process.env.CRM_STORE_SECRET,
    query: pool.query,
    fetch: global.fetch,
  };
  const queries = [];
  const calls = [];
  try {
    process.env.CRM_API_BASE_URL = "http://localhost:3000";
    process.env.CRM_STORE_ID = "loja-teste";
    process.env.CRM_STORE_SECRET = "segredo-teste";
    pool.query = async (sql, params) => {
      queries.push({ sql, params });
      return sql.startsWith("SELECT")
        ? { rows: [{ pvcod: 123, approved_at: new Date("2026-11-05T12:00:00Z"), attempts: 0 }] }
        : { rows: [] };
    };
    global.fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      return { ok: true };
    };

    await dispatchApprovals();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://localhost:3000/api/store-orders/stores/loja-teste/approved");
    assert.equal(calls[0].options.headers.authorization, "Bearer segredo-teste");
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      externalOrderId: "123",
      approvedAt: "2026-11-05T12:00:00.000Z",
    });
    assert.match(queries.at(-1).sql, /SET delivered_at = now\(\)/);
  } finally {
    pool.query = previous.query;
    global.fetch = previous.fetch;
    for (const [key, value] of Object.entries({ CRM_API_BASE_URL: previous.url, CRM_STORE_ID: previous.storeId, CRM_STORE_SECRET: previous.secret })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await pool.end();
  }
});
