/**
 * Gerenciador central de aparência (Claro / Escuro / Automático).
 *
 * - Persiste a preferência em localStorage (chave: sistema_pedidos_theme).
 * - Padrão "light" (white); "dark" e "auto" permanecem como opções.
 * - O valor "auto" é preservado (não é convertido para light/dark).
 * - Aplica o tema em <html> via data-theme e data-bs-theme (color mode do
 *   Bootstrap 5.3), evitando FOUC quando carregado no <head>.
 * - Escuta mudanças de prefers-color-scheme enquanto estiver em "auto".
 * - Expõe window.OrderUpTheme para uso por outras páginas/scripts.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "sistema_pedidos_theme";
  var VALID = ["light", "dark", "auto"];
  var DEFAULT = "light";

  var media =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

  function readPreference() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      return VALID.indexOf(stored) !== -1 ? stored : DEFAULT;
    } catch (err) {
      return DEFAULT;
    }
  }

  function savePreference(pref) {
    try {
      window.localStorage.setItem(STORAGE_KEY, pref);
    } catch (err) {
      /* localStorage indisponível (modo privado) — segue só em memória */
    }
  }

  function resolve(pref) {
    if (pref === "auto") {
      return media && media.matches ? "dark" : "light";
    }
    return pref === "dark" ? "dark" : "light";
  }

  function apply(pref) {
    var effective = resolve(pref);
    var root = document.documentElement;
    root.setAttribute("data-theme", effective);
    root.setAttribute("data-theme-pref", pref);
    // Bootstrap 5.3 color mode (tematiza todos os componentes nativos).
    root.setAttribute("data-bs-theme", effective);
    root.style.colorScheme = effective;
  }

  function setPreference(pref) {
    if (VALID.indexOf(pref) === -1) pref = DEFAULT;
    savePreference(pref);
    apply(pref);
    window.dispatchEvent(
      new CustomEvent("ou:themechange", {
        detail: { preference: pref, effective: resolve(pref) },
      })
    );
  }

  function getPreference() {
    return readPreference();
  }

  // --- Aplica imediatamente (antes do primeiro paint) -----------------------
  apply(readPreference());

  // --- Reage ao sistema quando em "auto" ------------------------------------
  if (media) {
    var onSystemChange = function () {
      if (readPreference() === "auto") apply("auto");
    };
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onSystemChange);
    } else if (typeof media.addListener === "function") {
      media.addListener(onSystemChange);
    }
  }

  window.OrderUpTheme = {
    STORAGE_KEY: STORAGE_KEY,
    get: getPreference,
    set: setPreference,
    resolve: resolve,
  };
})();
