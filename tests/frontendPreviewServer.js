// Preview visual isolado: dados fictícios em memória, sem carregar app.js ou banco.
// Execute manualmente: node tests/frontendPreviewServer.js
const express = require("express");
const path = require("node:path");
async function start() {
  const { createTestApi } = await import("../frontend/tests/fixtures/api.js");
  const fixture = createTestApi();
  const app = express();
  let documents = 0;
  app.use((req, _res, next) => {
    if (req.get("sec-fetch-dest") === "document") documents++;
    next();
  });
  app.use(express.json());
  app.get("/__test__/counts", (_req, res) =>
    res.json({ documents, apiCalls: fixture.calls.length })
  );
  app.use(express.static(path.join(__dirname, "../public")));
  app.use("/app", require("../src/routes/frontendRoutes")());
  app.use("/loja", require("../src/routes/frontendRoutes")());
  app.use(async (req, res) => {
    const result = await fixture.handle(req.originalUrl, { method: req.method, body: req.body });
    res.status(result.status).json(result.data);
  });
  app.listen(3012, "127.0.0.1", () =>
    console.log("Preview com dados fictícios: http://127.0.0.1:3012/app/")
  );
}
if (require.main === module)
  start().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
