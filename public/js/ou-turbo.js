/*
 * OrderUp — Ciclo de vida para navegação client-side (Turbo Drive).
 *
 * Deve ser carregado de forma SÍNCRONA no <head>, antes dos scripts que usam
 * os helpers abaixo.
 *
 * - ouOnLoad(fn)          : roda uma vez por visita. Usado por scripts de
 *                           página, que o Turbo reavalia a cada navegação.
 * - ouOnNavigate(key, fn) : roda na carga inicial e a cada visita, registrando
 *                           o listener uma única vez por `key` (mesmo que o
 *                           script seja reavaliado). Usado por scripts
 *                           compartilhados que precisam re-inicializar.
 */
(function () {
  if (window.__ouTurbo) return;
  window.__ouTurbo = true;

  window.__ouLoadFired = false;

  /*
   * Bibliotecas de terceiros carregadas no <body> (ex.: Bootstrap) são
   * reavaliadas pelo Turbo a cada navegação, pois ele reexecuta os scripts do
   * novo body. O Bootstrap registra listeners de clique no document para o
   * data-api, então cada visita adiciona outra camada: um clique em um
   * dropdown dispara toggle() duas vezes (abre e fecha na mesma hora) e os
   * menus/modais do topo param de funcionar. Marcar esses scripts com
   * data-turbo-eval="false" impede a reavaliação pelo Turbo; a carga inicial
   * (F5) continua executando normalmente, e a lib permanece em memória nas
   * navegações seguintes.
   */
  var OU_SCRIPTS_UMA_VEZ = ["bootstrap.bundle.min.js"];

  function ouMarcarScriptsUmaVez(root) {
    if (!root || typeof root.querySelectorAll !== "function") return;
    var scripts = root.querySelectorAll("script[src]");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute("src") || "";
      for (var j = 0; j < OU_SCRIPTS_UMA_VEZ.length; j++) {
        if (src.indexOf(OU_SCRIPTS_UMA_VEZ[j]) !== -1) {
          scripts[i].setAttribute("data-turbo-eval", "false");
          break;
        }
      }
    }
  }

  document.addEventListener("turbo:before-render", function (event) {
    window.__ouLoadFired = false;
    if (event.detail) ouMarcarScriptsUmaVez(event.detail.newBody);
  });
  document.addEventListener("turbo:load", function () {
    window.__ouLoadFired = true;
  });

  window.ouOnLoad = function (fn) {
    if (typeof fn !== "function") return;
    if (window.__ouLoadFired) {
      fn();
      return;
    }
    document.addEventListener("turbo:load", fn, { once: true });
  };

  window.__ouNavKeys = window.__ouNavKeys || {};
  window.ouOnNavigate = function (key, fn) {
    if (typeof key === "function") {
      fn = key;
      key = null;
    }
    if (typeof fn !== "function") return;

    if (key) {
      if (window.__ouNavKeys[key]) return;
      window.__ouNavKeys[key] = true;
      document.addEventListener("turbo:load", fn);
      // Se o script foi avaliado depois do turbo:load desta visita, roda agora.
      if (window.__ouLoadFired) fn();
      return;
    }

    document.addEventListener("turbo:load", fn);
  };
})();
