import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Redireciona a raiz do servidor React (Vite dev/preview) para a loja, antes
// de qualquer render. Em produção a raiz é servida pelo Express (legado), que
// não é afetado por este plugin.
function redirectRootToStore() {
  const handler = (req, res, next) => {
    if (req.url === "/" || req.url === "/index.html") {
      res.writeHead(302, { Location: "/loja/" });
      res.end();
      return;
    }
    next();
  };

  return {
    name: "ou-redirect-root-to-store",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig(({ command, mode }) => {
  // Somente a configuração local do frontend; nunca expor o .env do backend.
  const env = loadEnv(mode, process.cwd(), "BACKEND_");
  const proxy = {
    // /app e /loja pertencem ao Vite. APIs e páginas antigas continuam no Express.
    "^/(?!(?:app|loja|@vite|@react-refresh|@fs|src|node_modules|__vite_ping)(?:/|$))": {
      target: env.BACKEND_URL || "http://127.0.0.1:3000",
      changeOrigin: true,
    },
  };

  return {
    // No desenvolvimento há duas entradas React. O build mantém /app como base
    // dos assets, que também são servidos quando o HTML é aberto em /loja.
    base: command === "serve" && mode === "development" ? "/" : "/app/",
    plugins: [react(), redirectRootToStore()],
    server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy },
    preview: { host: "127.0.0.1", port: 4173, strictPort: true, proxy },
  };
});
