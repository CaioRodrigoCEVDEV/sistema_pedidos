import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App.jsx";
import StorefrontApp from "./store/StorefrontApp.jsx";
import "../../public/css/theme.css";
import "./styles.css";

const storefront = window.location.pathname === "/loja" || window.location.pathname.startsWith("/loja/");
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
