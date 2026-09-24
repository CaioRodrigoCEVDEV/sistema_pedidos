const express = require("express");
const path = require("path");

function createFrontendRouter(distDir = path.join(__dirname, "../../frontend/dist")) {
  const router = express.Router();

  // Os nomes gerados pelo Vite incluem hash; o HTML deve sempre revalidar.
  router.use(
    "/assets",
    express.static(path.join(distDir, "assets"), {
      maxAge: "1y",
      immutable: true,
    })
  );
  router.use("/assets", (_req, res) => res.sendStatus(404));

  // Fallback restrito ao ponto de montagem (/app ou /loja); nunca intercepta
  // APIs nem páginas legadas.
  router.get("/{*page}", (req, res, next) => {
    if (path.extname(req.path)) return res.sendStatus(404);
    res.set("Cache-Control", "no-cache, must-revalidate");
    res.sendFile(path.join(distDir, "index.html"), (error) => {
      if (!error) return;
      if (error.code === "ENOENT") {
        return res
          .status(503)
          .type("text")
          .send("O novo painel ainda não foi compilado. Execute npm run build:frontend.");
      }
      next(error);
    });
  });

  return router;
}

module.exports = createFrontendRouter;
