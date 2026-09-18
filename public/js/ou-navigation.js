/*
 * OrderUp — Navegação instantânea (sem "tela branca").
 *
 * Este script melhora a sensação de troca de página em navegadores modernos
 * sem mudar a arquitetura MPA (cada página continua sendo servida pelo Node):
 *
 * 1. View Transitions (cross-document): faz um cross-fade entre a página
 *    antiga e a nova em vez do flash branco. Habilitado via CSS
 *    `@view-transition { navigation: auto; }` (Chrome/Edge 126+).
 *
 * 2. Speculation Rules (prefetch): o Chrome/Edge pré-carrega o HTML das
 *    páginas dos links internos ao passar o mouse/focar, de modo que o clique
 *    encontre a página no cache e navegue quase instantaneamente.
 *
 *    Usamos apenas `prefetch` (não `prerender`) de propósito: `prerender`
 *    executaria os scripts e as chamadas de API da página destino em segundo
 *    plano, o que causaria efeitos colaterais (ex.: marcar "versão vista") e
 *    carga desnecessária no servidor. `prefetch` só baixa o documento.
 *
 * Navegadores sem suporte (Firefox/Safari) simplesmente seguem a navegação
 * normal, sem quebrar nada.
 */
(function () {
  if (window.__ouNavigation) return;
  window.__ouNavigation = true;

  var reduceMotion = false;
  try {
    reduceMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    /* noop */
  }

  // ---------------------------------------------------------------------------
  // 1) View Transitions (cross-document) — remove o flash branco na troca.
  // ---------------------------------------------------------------------------
  function enableViewTransitions() {
    if (reduceMotion) return;
    try {
      var style = document.createElement("style");
      style.id = "ou-view-transitions";
      style.textContent =
        "@view-transition { navigation: auto; }\n" +
        "::view-transition-old(root) { animation: ou-fade-out 160ms ease both; }\n" +
        "::view-transition-new(root) { animation: ou-fade-in 220ms ease both; }\n" +
        "@keyframes ou-fade-out { from { opacity: 1; } to { opacity: 0; } }\n" +
        "@keyframes ou-fade-in { from { opacity: 0; } to { opacity: 1; } }\n";
      (document.head || document.documentElement).appendChild(style);
    } catch (e) {
      /* noop */
    }
  }

  // ---------------------------------------------------------------------------
  // 2) Speculation Rules — pré-render/prefetch de links internos.
  // ---------------------------------------------------------------------------
  function speculationRulesSupported() {
    return (
      typeof HTMLScriptElement !== "undefined" &&
      typeof HTMLScriptElement.supports === "function" &&
      HTMLScriptElement.supports("speculationrules")
    );
  }

  function enableSpeculationRules() {
    if (!speculationRulesSupported()) return;

    // Evita pré-carregar ações que não são navegação de página:
    // logout, downloads, links para nova aba, arquivos (PDF/planilhas/imagens)
    // e elementos marcados explicitamente com [data-no-prerender].
    var skipSelector =
      "[data-no-prerender], [target=_blank], [download], .js-logout, " +
      '[data-turbo=false], a[href$=".pdf"], a[href$=".xls"], ' +
      'a[href$=".xlsx"], a[href$=".csv"], a[href$=".zip"], a[href$=".doc"], ' +
      'a[href$=".docx"], a[href$=".jpg"], a[href$=".jpeg"], a[href$=".png"], ' +
      'a[href$=".webp"], a[href$=".svg"], a[href$=".ico"]';

    var rules = {
      prefetch: [
        {
          source: "document",
          where: {
            and: [
              { href_matches: "/*" },
              { not: { selector_matches: skipSelector } },
            ],
          },
          eagerness: "moderate",
        },
      ],
    };

    try {
      var script = document.createElement("script");
      script.type = "speculationrules";
      script.id = "ou-speculation-rules";
      script.textContent = JSON.stringify(rules);
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      /* noop */
    }
  }

  enableViewTransitions();
  enableSpeculationRules();
})();
