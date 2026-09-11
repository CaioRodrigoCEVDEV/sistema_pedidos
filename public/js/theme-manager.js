/**
 * Gerenciador central de aparência (Claro / Escuro / Automático).
 *
 * - Persiste a preferência em localStorage (chave: sistema_pedidos_theme).
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
  var DEFAULT = "auto";

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

  function updateSwitcher(pref) {
    var box = document.getElementById("ouThemeSwitcher");
    if (!box) return;
    var buttons = box.querySelectorAll("[data-theme-choice]");
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var active = btn.getAttribute("data-theme-choice") === pref;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function setPreference(pref) {
    if (VALID.indexOf(pref) === -1) pref = DEFAULT;
    savePreference(pref);
    apply(pref);
    updateSwitcher(pref);
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

  // --- Seletor de aparência no menu do usuário ------------------------------
  function buildSwitcher() {
    var wrap = document.createElement("div");
    wrap.id = "ouThemeSwitcher";
    wrap.className = "ou-theme-switcher";
    wrap.innerHTML =
      '<div class="dropdown-divider"></div>' +
      '<h6 class="dropdown-header">Aparência</h6>' +
      '<div class="px-3 pb-2">' +
      '<div class="btn-group w-100" role="group" aria-label="Aparência">' +
      '<button type="button" class="btn btn-sm btn-outline-secondary" data-theme-choice="light" title="Tema claro" aria-pressed="false">' +
      '<i class="fa-solid fa-sun"></i><span class="ms-1">Claro</span></button>' +
      '<button type="button" class="btn btn-sm btn-outline-secondary" data-theme-choice="dark" title="Tema escuro" aria-pressed="false">' +
      '<i class="fa-solid fa-moon"></i><span class="ms-1">Escuro</span></button>' +
      '<button type="button" class="btn btn-sm btn-outline-secondary" data-theme-choice="auto" title="Acompanhar o sistema" aria-pressed="false">' +
      '<i class="fa-solid fa-circle-half-stroke"></i><span class="ms-1">Auto</span></button>' +
      "</div></div>";
    return wrap;
  }

  function mount() {
    if (document.getElementById("ouThemeSwitcher")) {
      updateSwitcher(readPreference());
      return;
    }
    // Só páginas com o menu do usuário (header autenticado) recebem o seletor.
    var menu = document.querySelector("#header-admin .dropdown-menu");
    if (!menu) return;

    var wrap = buildSwitcher();
    var divider = menu.querySelector(".dropdown-divider");
    if (divider) {
      menu.insertBefore(wrap, divider);
    } else {
      menu.appendChild(wrap);
    }

    var buttons = wrap.querySelectorAll("[data-theme-choice]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function () {
        setPreference(this.getAttribute("data-theme-choice"));
      });
    }
    updateSwitcher(readPreference());
  }

  window.OrderUpTheme = {
    STORAGE_KEY: STORAGE_KEY,
    get: getPreference,
    set: setPreference,
    resolve: resolve,
    mount: mount,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
