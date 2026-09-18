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

  document.addEventListener("turbo:before-render", function () {
    window.__ouLoadFired = false;
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
