/* ==========================================================================
   OrderUp — Tour guiado (motor genérico, sem dependências externas).

   Uso:
     window.OrderUpTour.start({
       steps: [
         { target: "#meuElemento", title: "Título", text: "Descrição" },
         { target: '[data-x="y"]', title: "...", text: "..." }
       ],
       onClose: function (resultado) {
         // resultado: { completed, skipped, dontShowAgain, forcePersist, noTargets }
       }
     });

   - Destaca o elemento real com máscara recortada + anel.
   - Popover posicionado com clamping (sem scroll horizontal em mobile).
   - Teclado: Tab (foco preso), Enter/Seta direita (avança),
     Seta esquerda (volta), Esc (encerra).
   - Não altera a lógica das telas; é apenas uma camada de orientação.
   ========================================================================== */
(function () {
  "use strict";

  var MARGIN = 10;
  var GAP = 12;
  var STYLE_ID = "ouTourStyles";
  var STYLE_HREF = "/html/auth/admin/css/style-tour.css";

  // Captura o ?v= do próprio script na execução síncrona (document.currentScript
  // fica nulo depois, quando o tour é iniciado). Mantém o cache-busting do CSS
  // em sincronia com o do JS (mesmo padrão do releases-global.js).
  var SELF_VERSION = "";
  if (document.currentScript) {
    var versionMatch = String(document.currentScript.src).match(
      /[?&]v=([^&]+)/
    );
    if (versionMatch) SELF_VERSION = versionMatch[1];
  }

  var state = null;
  var scrollLock = null;
  var rafId = null;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    link.href = STYLE_HREF + (SELF_VERSION ? "?v=" + SELF_VERSION : "");
    document.head.appendChild(link);
  }

  function resolveTarget(target) {
    if (!target) return null;
    if (typeof target === "function") return target() || null;
    if (typeof target === "string") return document.querySelector(target);
    return target.nodeType === 1 ? target : null;
  }

  var TEMPLATE =
    '<div class="ou-tour__mask" aria-hidden="true">' +
    '<span class="ou-tour__mask-part" data-part="top"></span>' +
    '<span class="ou-tour__mask-part" data-part="right"></span>' +
    '<span class="ou-tour__mask-part" data-part="bottom"></span>' +
    '<span class="ou-tour__mask-part" data-part="left"></span>' +
    '<span class="ou-tour__ring"></span>' +
    "</div>" +
    '<div class="ou-tour__popover" role="document">' +
    '<span class="ou-tour__arrow" aria-hidden="true"></span>' +
    '<button type="button" class="ou-tour__close" aria-label="Fechar tour">' +
    '<i class="bi bi-x-lg" aria-hidden="true"></i></button>' +
    '<div class="ou-tour__step" id="ouTourStep"></div>' +
    '<h2 class="ou-tour__title" id="ouTourTitle" tabindex="-1"></h2>' +
    '<p class="ou-tour__text" id="ouTourText"></p>' +
    '<label class="ou-tour__dontshow">' +
    '<input type="checkbox" class="form-check-input" id="ouTourDontShow" checked />' +
    "<span>Não mostrar novamente</span>" +
    "</label>" +
    '<div class="ou-tour__footer">' +
    '<button type="button" class="btn btn-link ou-tour__skip">Pular tour</button>' +
    '<div class="ou-tour__nav">' +
    '<button type="button" class="btn btn-outline-secondary btn-sm ou-tour__prev">Anterior</button>' +
    '<button type="button" class="btn btn-primary btn-sm ou-tour__next">Próximo</button>' +
    "</div>" +
    "</div>" +
    "</div>";

  function build() {
    var root = document.createElement("div");
    root.className = "ou-tour";
    root.id = "ouTour";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "ouTourTitle");
    root.setAttribute("aria-describedby", "ouTourText");
    root.innerHTML = TEMPLATE;
    return root;
  }

  function setLocked(locked) {
    if (!document.body) return;
    if (!scrollLock) {
      scrollLock = {
        html: document.documentElement.style.overflow,
        body: document.body.style.overflow,
      };
    }
    if (locked) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = scrollLock.html;
      document.body.style.overflow = scrollLock.body;
    }
  }

  function setBox(el, left, top, width, height) {
    if (!el) return;
    el.style.left = Math.round(left) + "px";
    el.style.top = Math.round(top) + "px";
    el.style.width = Math.max(Math.round(width), 0) + "px";
    el.style.height = Math.max(Math.round(height), 0) + "px";
  }

  function positionEverything() {
    if (!state) return;
    var step = state.steps[state.index];
    var el = resolveTarget(step.target);
    if (!el) return;

    var rect = el.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var top = Math.max(rect.top, 0);
    var left = Math.max(rect.left, 0);
    var right = Math.min(rect.right, vw);
    var bottom = Math.min(rect.bottom, vh);

    // Máscara recortada ao redor do alvo (4 partes + anel)
    setBox(state.maskParts[0], 0, 0, vw, top);
    setBox(state.maskParts[1], right, top, vw - right, bottom - top);
    setBox(state.maskParts[2], 0, bottom, vw, vh - bottom);
    setBox(state.maskParts[3], 0, top, left, bottom - top);
    setBox(state.ring, rect.left, rect.top, rect.width, rect.height);

    // Popover: escolhe o lado com espaço e mantém dentro da viewport.
    var popover = state.popover;
    var arrow = state.arrow;
    var pRect = popover.getBoundingClientRect();
    var popW = pRect.width;
    var popH = pRect.height;

    var placement;
    if (vh - bottom >= popH + GAP) placement = "bottom";
    else if (top >= popH + GAP) placement = "top";
    else placement = "center";

    var targetCenter = (left + right) / 2;
    var popTop;
    if (placement === "bottom") popTop = bottom + GAP;
    else if (placement === "top") popTop = top - popH - GAP;
    else popTop = (vh - popH) / 2;

    var popLeft = targetCenter - popW / 2;
    popLeft = Math.min(Math.max(popLeft, MARGIN), Math.max(vw - popW - MARGIN, MARGIN));
    popTop = Math.min(Math.max(popTop, MARGIN), Math.max(vh - popH - MARGIN, MARGIN));

    popover.setAttribute("data-placement", placement);
    popover.style.left = Math.round(popLeft) + "px";
    popover.style.top = Math.round(popTop) + "px";

    if (placement === "center") {
      arrow.style.display = "none";
    } else {
      arrow.style.display = "";
      var arrowX = Math.min(Math.max(targetCenter - popLeft, 18), popW - 18);
      arrow.style.left = Math.round(arrowX - 6) + "px";
    }
  }

  function schedulePosition() {
    if (rafId) return;
    rafId = window.requestAnimationFrame(function () {
      rafId = null;
      positionEverything();
    });
  }

  function showStep(index) {
    if (!state) return;
    var total = state.steps.length;
    state.index = Math.min(Math.max(index, 0), total - 1);

    var step = state.steps[state.index];
    var el = resolveTarget(step.target);
    if (!el) {
      // Defensivo: alvo ausente (ex.: linha removida) — segue para o próximo.
      if (state.index < total - 1) return showStep(state.index + 1);
      return finish(true, false);
    }

    setLocked(false);
    try {
      el.scrollIntoView({ block: "center", inline: "center" });
    } catch (err) {
      el.scrollIntoView();
    }
    setLocked(true);

    state.popover.classList.add("ou-tour__popover--measuring");
    state.stepEl.style.display = total > 1 ? "" : "none";
    state.prevBtn.style.display = total > 1 ? "" : "none";
    state.stepEl.textContent = "Passo " + (state.index + 1) + " de " + total;
    state.titleEl.textContent = step.title || "";
    state.textEl.textContent = step.text || "";
    state.prevBtn.disabled = state.index === 0;
    state.nextBtn.textContent =
      state.index === total - 1 ? "Concluir" : "Próximo";
    positionEverything();
    state.popover.classList.remove("ou-tour__popover--measuring");

    state.titleEl.focus();
  }

  function next() {
    if (!state) return;
    if (state.index >= state.steps.length - 1) finish(true, false);
    else showStep(state.index + 1);
  }

  function trapTab(event) {
    var focusables = state.popover.querySelectorAll(
      "button, input, [tabindex]:not([tabindex='-1'])"
    );
    var list = Array.prototype.filter.call(focusables, function (el) {
      return !el.disabled && el.offsetParent !== null;
    });
    if (!list.length) return;

    var first = list[0];
    var last = list[list.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onKeydown(event) {
    if (!state) return;

    if (event.key === "Escape") {
      event.preventDefault();
      finish(false, true);
      return;
    }
    if (event.key === "Tab") {
      trapTab(event);
      return;
    }
    if (event.key === "ArrowRight" || event.key === "Enter") {
      var tag = document.activeElement ? document.activeElement.tagName : "";
      // Enter aciona o controle focado (checkbox/botões) naturalmente.
      if (event.key === "Enter" && (tag === "BUTTON" || tag === "INPUT")) return;
      event.preventDefault();
      next();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showStep(state.index - 1);
    }
  }

  function removeGlobalListeners() {
    document.removeEventListener("keydown", onKeydown);
    window.removeEventListener("resize", schedulePosition);
    window.removeEventListener("scroll", schedulePosition, true);
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function teardown() {
    if (!state) return null;
    var s = state;
    state = null;
    setLocked(false);
    removeGlobalListeners();
    if (s.root && s.root.parentNode) s.root.parentNode.removeChild(s.root);
    if (s.previousFocus && typeof s.previousFocus.focus === "function") {
      try {
        s.previousFocus.focus();
      } catch (err) {
        /* noop */
      }
    }
    return s;
  }

  // Encerra o tour. `forcePersist` é usado em "Pular"/fechar para marcar como
  // visto e não interromper o usuário novamente.
  function finish(completed, forcePersist) {
    var s = teardown();
    if (!s) return;
    var dontShowAgain = s.dontCheckbox ? s.dontCheckbox.checked : true;
    if (typeof s.onClose === "function") {
      s.onClose({
        completed: !!completed,
        skipped: !completed,
        dontShowAgain: dontShowAgain,
        forcePersist: !!forcePersist,
      });
    }
  }

  function start(options) {
    options = options || {};

    // Encerra um tour em andamento antes de abrir outro.
    if (state) finish(false, true);

    var steps = (options.steps || []).filter(function (step) {
      return !!resolveTarget(step.target);
    });

    if (!steps.length) {
      if (typeof options.onClose === "function") {
        options.onClose({
          completed: false,
          skipped: false,
          dontShowAgain: true,
          forcePersist: false,
          noTargets: true,
        });
      }
      return;
    }

    injectStyles();

    var root = build();
    document.body.appendChild(root);

    state = {
      steps: steps,
      index: 0,
      onClose: options.onClose,
      previousFocus: document.activeElement,
      root: root,
      popover: root.querySelector(".ou-tour__popover"),
      arrow: root.querySelector(".ou-tour__arrow"),
      ring: root.querySelector(".ou-tour__ring"),
      maskParts: root.querySelectorAll(".ou-tour__mask-part"),
      stepEl: root.querySelector("#ouTourStep"),
      titleEl: root.querySelector("#ouTourTitle"),
      textEl: root.querySelector("#ouTourText"),
      dontCheckbox: root.querySelector("#ouTourDontShow"),
      prevBtn: root.querySelector(".ou-tour__prev"),
      nextBtn: root.querySelector(".ou-tour__next"),
    };

    document.addEventListener("keydown", onKeydown);
    window.addEventListener("resize", schedulePosition);
    window.addEventListener("scroll", schedulePosition, true);

    state.nextBtn.addEventListener("click", next);
    state.prevBtn.addEventListener("click", function () {
      showStep(state.index - 1);
    });
    root.querySelector(".ou-tour__skip").addEventListener("click", function () {
      finish(false, true);
    });
    root.querySelector(".ou-tour__close").addEventListener("click", function () {
      finish(false, true);
    });

    setLocked(true);
    showStep(0);
  }

  window.OrderUpTour = { start: start };
})();
