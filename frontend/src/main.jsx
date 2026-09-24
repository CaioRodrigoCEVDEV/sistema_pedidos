import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App.jsx";
import StorefrontApp from "./store/StorefrontApp.jsx";
import "../../public/css/theme.css";
import "./styles.css";

// A raiz do app React (em dev/preview o Vite atende "/") redireciona para a
// loja. Em produção a raiz é servida pelo Express (legado), então este código
// nem chega a ser carregado lá — o legado permanece intacto.
const naRaizDoReact = window.location.pathname === "/";

if (naRaizDoReact) {
  window.location.replace("/loja/");
} else {
  const storefront =
    window.location.pathname === "/loja" ||
    window.location.pathname.startsWith("/loja/");
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <BrowserRouter basename={storefront ? "/loja" : "/app"}>
        {storefront ? <StorefrontApp /> : <App />}
      </BrowserRouter>
    </StrictMode>
  );

  // Registra o Service Worker para o app ser instalável (PWA). O SW é
  // network-only e é o mesmo servido em /sw.js para o restante do sistema.
  if ("serviceWorker" in navigator && !window.__ouSWRegistered) {
    window.__ouSWRegistered = true;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
}
