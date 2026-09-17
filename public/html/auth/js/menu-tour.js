/* ==========================================================================
   OrderUp — Apresentação do item "Vitrines" no menu (shell autenticado).

   Carregado por componentes.js em todas as páginas com #header-admin.
   Na primeira utilização após a novidade, destaca o item Vitrines da sidebar
   para o usuário descobrir o novo recurso. A conclusão é persistida por
   usuário (usu.usuvitourmenu) e também em localStorage.

   Não roda na própria tela /vitrines (lá existe o tour detalhado da tela).
   ========================================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "vitrinesMenuTourVisto";
  var NAV_SELECTOR = '#ouSidebar [data-route="/vitrines"]';
  var INTERVALO_MS = 120;
  var MAX_TENTATIVAS = 80; // ~9,6s aguardando menu + biblioteca

  function baseUrl() {
    return typeof BASE_URL !== "undefined" ? BASE_URL : "";
  }

  function vistoLocal() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch (error) {
      return false;
    }
  }

  function marcarLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch (error) {
      /* localStorage indisponível */
    }
  }

  async function jaVisualizado() {
    if (vistoLocal()) return true;

    try {
      var response = await fetch(baseUrl() + "/usuario/viutourmenu/", {
        credentials: "include",
      });
      if (!response.ok) return false;
      var data = await response.json();
      return String(data.usuvitourmenu || "N").toUpperCase() === "S";
    } catch (error) {
      console.error("Erro ao consultar preferência do tour do menu:", error);
      return false;
    }
  }

  function persistir(resultado) {
    if (!resultado || resultado.noTargets) return;
    if (!(resultado.dontShowAgain || resultado.forcePersist)) return;

    marcarLocal();
    fetch(baseUrl() + "/usuario/viutourmenu/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ viuTourMenu: "S" }),
    }).catch(function (error) {
      console.error("Erro ao salvar preferência do tour do menu:", error);
    });
  }

  function ehMobile() {
    return window.matchMedia("(max-width: 991.98px)").matches;
  }

  function abrirDrawerSePreciso() {
    if (!ehMobile()) return false;
    if (document.body.classList.contains("ou-drawer-open")) return false;

    document.body.classList.add("ou-drawer-open");
    var btn = document.getElementById("ouMenuBtn");
    if (btn) btn.setAttribute("aria-expanded", "true");
    return true;
  }

  function fecharDrawer() {
    document.body.classList.remove("ou-drawer-open");
    var btn = document.getElementById("ouMenuBtn");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function iniciar(alvo) {
    var abriuDrawer = abrirDrawerSePreciso();

    window.OrderUpTour.start({
      steps: [
        {
          target: alvo,
          title: "Novidade no menu: Vitrines",
          text: "Agora você pode controlar quais vitrines aparecem na página inicial da loja. Acesse a tela Vitrines pelo menu Catálogo.",
        },
      ],
      onClose: function (resultado) {
        if (abriuDrawer) fecharDrawer();
        persistir(resultado);
      },
    });
  }

  function naTelaDeVitrines() {
    var path = (location.pathname || "").replace(/\/+$/, "");
    return path === "/vitrines";
  }

  function tentarIniciar() {
    if (naTelaDeVitrines()) return;

    var tentativas = 0;
    var timer = window.setInterval(function () {
      tentativas++;

      var alvo = document.querySelector(NAV_SELECTOR);
      var pronto = alvo && window.OrderUpTour;

      if (pronto) {
        window.clearInterval(timer);
        jaVisualizado().then(function (visto) {
          if (visto) return;
          // Evita sobrepor outro tour já aberto (ex.: releases/modal).
          if (document.querySelector("#ouTour")) return;
          iniciar(alvo);
        });
        return;
      }

      if (tentativas >= MAX_TENTATIVAS) {
        window.clearInterval(timer);
      }
    }, INTERVALO_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tentarIniciar);
  } else {
    tentarIniciar();
  }
})();
