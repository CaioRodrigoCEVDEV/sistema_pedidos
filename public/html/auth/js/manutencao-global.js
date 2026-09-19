/* ==========================================================================
   Aviso de manutenção — OrderUp (global no shell autenticado)

   Carregado por public/html/auth/js/componentes.js em todas as páginas com
   #header-admin. Consulta GET /api/manutencao (que, por sua vez, fala com a
   API externa configurada em MAINTENANCE_API_URL) e, se houver aviso vigente,
   abre um modal uma única vez por sessão de login.

   A "sessão de login" é controlada via sessionStorage: login.js limpa a flag
   ao autenticar e este módulo grava a assinatura (titulo|mensagem) ao exibir.
   Assim o aviso reaparece em um novo login ou quando o texto mudar.

   O modal é estático: não fecha ao clicar fora nem com Esc — apenas pelo
   botão "Entendi" (ou X). Há uma flag sutil, desmarcada por padrão, que ao ser
   marcada "soneca" o aviso por algumas horas (localStorage).

   Renderização DOM-safe: nenhum innerHTML com conteúdo vindo da API externa,
   apenas texto criado com textContent/createElement.
   ========================================================================== */
(function () {
  "use strict";

  var SESSION_KEY = "ouManutencaoSessao";
  var SNOOZE_KEY = "ouManutencaoSnoozeAte";
  var SNOOZE_MS = 4 * 60 * 60 * 1000; // 4 horas
  var MODAL_ID = "manutencaoModal";

  // Reaproveita o ?v= do próprio script (definido por componentes.js) para
  // manter o cache-busting do CSS de manutenção em sincronia.
  var SELF_VERSION = "";
  if (document.currentScript) {
    var selfMatch = String(document.currentScript.src).match(/[?&]v=([^&]+)/);
    if (selfMatch) SELF_VERSION = selfMatch[1];
  }
  var MAINTENANCE_CSS =
    "/html/auth/admin/css/style-manutencao.css" +
    (SELF_VERSION ? "?v=" + SELF_VERSION : "");

  var modalInstance = null;

  function baseUrl() {
    return typeof BASE_URL !== "undefined" ? BASE_URL : "";
  }

  // ---------- Infraestrutura: CSS + markup injetados uma única vez ----------
  function ensureStyles() {
    if (document.getElementById("ouManutencaoStyles")) return;
    var link = document.createElement("link");
    link.id = "ouManutencaoStyles";
    link.rel = "stylesheet";
    link.href = MAINTENANCE_CSS;
    document.head.appendChild(link);
  }

  function ensureMarkup() {
    if (document.getElementById(MODAL_ID)) return;

    var wrapper = document.createElement("div");
    wrapper.innerHTML =
      '<div class="modal fade" id="manutencaoModal" tabindex="-1" aria-labelledby="manutencaoModalLabel" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">' +
      '<div class="modal-dialog modal-dialog-centered">' +
      '<div class="modal-content maintenance-modal">' +
      '<div class="modal-header maintenance-modal__header">' +
      '<span class="maintenance-modal__icon" aria-hidden="true"><i class="bi bi-cone-striped"></i></span>' +
      '<h5 class="modal-title" id="manutencaoModalLabel">Aviso de manutenção</h5>' +
      '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>' +
      "</div>" +
      '<div class="modal-body">' +
      '<p class="maintenance-modal__text" id="manutencaoMensagem" tabindex="-1"></p>' +
      "</div>" +
      '<div class="modal-footer maintenance-modal__footer">' +
      '<div class="form-check maintenance-modal__snooze">' +
      '<input class="form-check-input" type="checkbox" id="manutencaoSnooze">' +
      '<label class="form-check-label" for="manutencaoSnooze">Não mostrar novamente por 4 horas</label>' +
      "</div>" +
      '<button type="button" class="btn btn-primary" data-bs-dismiss="modal">Entendi</button>' +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>";

    if (wrapper.firstElementChild) {
      document.body.appendChild(wrapper.firstElementChild);
    }
  }

  function bindModal() {
    var el = document.getElementById(MODAL_ID);
    if (!el || el.dataset.ouManutencaoBound) return;
    el.dataset.ouManutencaoBound = "1";

    // Foco na mensagem ao abrir, para leitura acessível.
    el.addEventListener("shown.bs.modal", function () {
      var mensagemEl = document.getElementById("manutencaoMensagem");
      if (mensagemEl) mensagemEl.focus();
    });

    // Só aplica a soneca no fechamento (pelo botão/X), nunca no clique fora,
    // que fica bloqueado pelo backdrop estático.
    el.addEventListener("hide.bs.modal", function () {
      var snoozeEl = document.getElementById("manutencaoSnooze");
      if (snoozeEl && snoozeEl.checked) marcarSnooze();
    });
  }

  // ---------- "Visto na sessão": flag no sessionStorage ----------
  function getSignature(data) {
    return String(data.titulo || "") + "|" + String(data.mensagem || "");
  }

  function jaExibido(signature) {
    try {
      return sessionStorage.getItem(SESSION_KEY) === signature;
    } catch (err) {
      return false;
    }
  }

  function marcarExibido(signature) {
    try {
      sessionStorage.setItem(SESSION_KEY, signature);
    } catch (err) {
      /* noop */
    }
  }

  // ---------- Soneca: flag opcional marcada pelo usuário ----------
  function snoozeAtivo() {
    try {
      var ate = Number(localStorage.getItem(SNOOZE_KEY));
      return Number.isFinite(ate) && ate > 0 && Date.now() < ate;
    } catch (err) {
      return false;
    }
  }

  function marcarSnooze() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch (err) {
      /* noop */
    }
  }

  // Converte eventuais `\n`/`\r\n` literais (JSON com escape duplo) em quebras
  // reais. O CSS usa white-space: pre-wrap, então novos e espaços são exibidos.
  function normalizarMensagem(text) {
    return String(text == null ? "" : text)
      .replaceAll("\\r\\n", "\n")
      .replaceAll("\\n", "\n")
      .replaceAll("\\r", "\n");
  }

  function preencherConteudo(data) {
    var tituloEl = document.getElementById("manutencaoModalLabel");
    var mensagemEl = document.getElementById("manutencaoMensagem");

    if (tituloEl && data.titulo) {
      tituloEl.textContent = data.titulo;
    }

    if (mensagemEl) {
      mensagemEl.textContent = normalizarMensagem(
        data.mensagem ||
          "O sistema ficará indisponível durante o período informado."
      );
    }
  }

  function openModal(data) {
    ensureStyles();
    ensureMarkup();
    bindModal();

    if (typeof bootstrap === "undefined" || !bootstrap.Modal) {
      return false;
    }

    preencherConteudo(data);

    var el = document.getElementById(MODAL_ID);
    if (!el) return false;

    if (!modalInstance) {
      modalInstance = new bootstrap.Modal(el, {
        backdrop: "static",
        keyboard: false,
      });
    }
    modalInstance.show();
    return true;
  }

  window.ouOpenManutencao = function (data) {
    return openModal(data || {});
  };

  // ---------- Fetch: API interna, que lê a API externa no backend ----------
  function fetchManutencao() {
    return fetch(baseUrl() + "/api/manutencao", {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" },
    }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    });
  }

  function init() {
    if (snoozeAtivo()) return;

    fetchManutencao()
      .then(function (data) {
        if (!data || data.ativo !== true) return;

        var signature = getSignature(data);
        if (jaExibido(signature)) return;

        // Pequeno atraso para o shell terminar de montar antes de sobrepor o
        // modal. A flag só é gravada quando o modal realmente abre.
        window.setTimeout(function () {
          if (openModal(data)) {
            marcarExibido(signature);
          }
        }, 1200);
      })
      .catch(function (err) {
        console.error("[manutencao] erro ao carregar aviso:", err);
      });
  }

  ouOnLoad(init);
})();
