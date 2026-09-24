/* ==========================================================================
   Atualizações — OrderUp (global no shell autenticado)

   Carregado por public/html/auth/js/componentes.js em todas as páginas com
   #header-admin. Exibe um marcador no botão "Novidades" da topbar enquanto o
   usuário ainda não visualizou a versão mais recente; ao abrir o modal a
   versão vista é gravada no banco e o marcador desaparece.

   A abertura automática do modal após o login está desativada no momento
   (AUTO_OPEN_ON_LOGIN = false) e pode ser reativada quando desejado.

   O modal é renderizado de forma DOM-safe: nenhum innerHTML é usado com o
   conteúdo externo das releases, apenas com markup estático confiável.
   ========================================================================== */
(function () {
  "use strict";

  // Abertura automática do modal após o login desativada por enquanto.
  // Basta voltar para true para reativar o fluxo de "visto uma vez".
  var AUTO_OPEN_ON_LOGIN = false;

  // Reaproveita o ?v= do próprio script (definido por componentes.js) para
  // manter o cache-busting do CSS de releases em sincronia.
  var SELF_VERSION = "";
  if (document.currentScript) {
    var selfMatch = String(document.currentScript.src).match(/[?&]v=([^&]+)/);
    if (selfMatch) SELF_VERSION = selfMatch[1];
  }
  var RELEASES_CSS =
    "/html/auth/admin/css/style-painel-releases.css" +
    (SELF_VERSION ? "?v=" + SELF_VERSION : "");

  var loaded = false;
  var modalInstance = null;
  var seenChecked = false;
  var seen = false;
  var versaoAtual = null;
  var latestLoadedVersion = null;

  function baseUrl() {
    return typeof BASE_URL !== "undefined" ? BASE_URL : "";
  }

  // ---------- Infraestrutura: CSS + markup injetados uma única vez ----------
  function ensureStyles() {
    if (document.getElementById("ouReleasesStyles")) return;
    var link = document.createElement("link");
    link.id = "ouReleasesStyles";
    link.rel = "stylesheet";
    link.href = RELEASES_CSS;
    document.head.appendChild(link);
  }

  function ensureMarkup() {
    if (document.getElementById("releasesModal")) return;

    var wrapper = document.createElement("div");
    wrapper.innerHTML =
      '<div class="modal fade" id="releasesModal" tabindex="-1" aria-labelledby="releasesModalLabel" aria-hidden="true">' +
      '<div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">' +
      '<div class="modal-content">' +
      '<div class="modal-header">' +
      '<div>' +
      '<h5 class="modal-title" id="releasesModalLabel">🚀 Atualizações</h5>' +
      '<p class="text-muted small mb-0">Confira as novidades e melhorias das versões mais recentes</p>' +
      "</div>" +
      '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>' +
      "</div>" +
      '<div class="modal-body">' +
      '<div id="releasesList"></div>' +
      '<div id="releasesMsg" class="py-3"></div>' +
      "</div>" +
      '<div class="modal-footer">' +
      '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>' +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>";

    if (wrapper.firstElementChild) {
      document.body.appendChild(wrapper.firstElementChild);
    }
  }

  // ---------- "Visto": versão vista no banco (por usuário) ----------
  function setBadge(visible) {
    var badge = document.getElementById("ouReleasesBadge");
    var btn = document.getElementById("ouReleasesBtn");
    if (badge) badge.hidden = !visible;
    if (btn) btn.classList.toggle("is-unseen", visible);
  }

  function markSeen() {
    if (seen) return;

    var versao = versaoAtual || latestLoadedVersion;
    seen = true;
    setBadge(false);

    if (!versao) return;

    try {
      fetch(baseUrl() + "/usuario/viuversao/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ versao: versao }),
      });
    } catch (err) {
      console.error("Erro ao atualizar viuversao:", err);
    }
  }

  function bindModal() {
    var el = document.getElementById("releasesModal");
    if (!el || el.dataset.ouReleasesBound) return;
    el.dataset.ouReleasesBound = "1";
    // Ao visualizar o modal, o marcador de "não visto" desaparece.
    el.addEventListener("shown.bs.modal", markSeen);
  }

  function refreshSeenState() {
    if (seenChecked) return;
    seenChecked = true;

    fetch(baseUrl() + "/usuario/viuversao", {
      method: "GET",
      credentials: "include",
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Falha ao obter usuário");
        return response.json();
      })
      .then(function (data) {
        versaoAtual = (data && data.versaoAtual) || null;
        var versaoVista = (data && data.usuversaovista) || null;

        // Só há novidade quando existe uma versão publicada e ela difere da
        // última versão que este usuário visualizou.
        seen = !versaoAtual || (!!versaoVista && versaoVista === versaoAtual);
        setBadge(!seen);

        if (AUTO_OPEN_ON_LOGIN && !seen) {
          window.setTimeout(openModal, 1500);
        }
      })
      .catch(function (err) {
        console.error("Erro ao buscar versão do usuário:", err);
      });
  }

  // ---------- Abertura do modal ----------
  function openModal() {
    ensureStyles();
    ensureMarkup();
    bindModal();

    var el = document.getElementById("releasesModal");
    if (!el || typeof bootstrap === "undefined") return;

    if (!modalInstance) modalInstance = new bootstrap.Modal(el);
    if (!loaded) loadAndRender();
    modalInstance.show();
  }

  window.ouOpenReleases = openModal;

  // ---------- Fetch: exclusivamente a API do sistema, que lê o PostgreSQL ----------
  function fetchReleases() {
    return fetch("/api/releases", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (data) {
      return Array.isArray(data) ? data : [];
    });
  }

  function loadAndRender() {
    var listEl = document.getElementById("releasesList");
    var msgEl = document.getElementById("releasesMsg");
    if (!listEl || !msgEl) return;

    listEl.replaceChildren();
    setMessage(msgEl, "Carregando atualizações...");

    fetchReleases()
      .then(function (releases) {
        loaded = true;
        render(listEl, msgEl, releases);
      })
      .catch(function (err) {
        console.error("[releases] erro ao carregar releases", err);
        renderError(listEl, msgEl);
      });
  }

  function setMessage(msgEl, text) {
    msgEl.replaceChildren();
    var div = document.createElement("div");
    div.className = "release-feedback";
    div.textContent = text;
    msgEl.appendChild(div);
  }

  function renderError(listEl, msgEl) {
    listEl.replaceChildren();
    msgEl.replaceChildren();

    var wrap = document.createElement("div");
    wrap.className = "release-feedback release-feedback--error";

    var title = document.createElement("p");
    title.className = "mb-2";
    title.textContent = "Não foi possível carregar as atualizações.";

    var retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn btn-sm btn-outline-primary";
    retry.textContent = "Tentar novamente";
    retry.addEventListener("click", function () {
      loadAndRender();
    });

    wrap.append(title, retry);
    msgEl.appendChild(wrap);
  }

  function render(listEl, msgEl, releases) {
    listEl.replaceChildren();
    msgEl.replaceChildren();

    if (!releases.length) {
      listEl.appendChild(renderEmpty());
      return;
    }

    // A ordenação vem do backend (mais recente primeiro). O primeiro item é,
    // por definição, a release mais recente — nada fica hardcoded no frontend.
    var latest = releases[0];
    latestLoadedVersion = latest.version || latest.tag_name || null;
    var history = releases.slice(1);
    listEl.appendChild(renderLatest(latest));

    if (history.length) {
      var heading = document.createElement("h6");
      heading.className = "release-history__title";
      heading.textContent = "Histórico de versões";
      listEl.appendChild(heading);
      listEl.appendChild(renderHistory(history));
    }
  }

  function renderEmpty() {
    var empty = document.createElement("div");
    empty.className = "empty-state";

    var icon = document.createElement("i");
    icon.className = "bi bi-inboxes";
    icon.setAttribute("aria-hidden", "true");

    var text = document.createElement("p");
    text.className = "mt-2 mb-0";
    text.textContent = "Nenhuma atualização cadastrada ainda.";

    empty.append(icon, text);
    return empty;
  }

  function renderLatest(release) {
    var card = document.createElement("article");
    card.className = "release-card release-card--latest";

    var header = document.createElement("div");
    header.className = "release-latest__header";

    var badge = document.createElement("span");
    badge.className = "version-badge";
    badge.textContent = release.version || release.tag_name || "Versão";

    var date = document.createElement("span");
    date.className = "release-date";
    date.textContent = formatDate(release.published_at);

    header.append(badge, date);

    var titleText = release.name || release.tag_name || "";
    if (titleText) {
      var title = document.createElement("h5");
      title.className = "release-title-text";
      title.textContent = titleText;
      card.appendChild(title);
    }

    var body = document.createElement("div");
    body.className = "release-md";
    renderMarkdown(body, release.body);

    card.append(header, body);
    return card;
  }

  function renderHistory(items) {
    var accordion = document.createElement("div");
    accordion.className = "accordion release-history";
    accordion.id = "releasesHistoryAccordion";

    items.forEach(function (release, index) {
      var targetId = "release-history-" + (release.id || index);

      var item = document.createElement("div");
      item.className = "accordion-item release-history__item";

      var header = document.createElement("h2");
      header.className = "accordion-header";

      var toggle = document.createElement("button");
      toggle.className = "accordion-button collapsed release-history__toggle";
      toggle.type = "button";
      toggle.setAttribute("data-bs-toggle", "collapse");
      toggle.setAttribute("data-bs-target", "#" + targetId);
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", targetId);

      var version = document.createElement("span");
      version.className = "release-history__version";
      version.textContent = release.version || release.tag_name || "";

      var name = document.createElement("span");
      name.className = "release-history__name";
      var displayName = release.name || "";
      var displayVersion = release.version || release.tag_name || "";
      name.textContent = displayName && displayName !== displayVersion ? displayName : "";

      var date = document.createElement("span");
      date.className = "release-history__date";
      date.textContent = formatDate(release.published_at);

      toggle.append(version, name, date);
      header.appendChild(toggle);

      var collapse = document.createElement("div");
      collapse.id = targetId;
      collapse.className = "accordion-collapse collapse";
      collapse.setAttribute("data-bs-parent", "#releasesHistoryAccordion");

      var body = document.createElement("div");
      body.className = "accordion-body release-md";
      renderMarkdown(body, release.body);
      collapse.appendChild(body);

      item.append(header, collapse);
      accordion.appendChild(item);
    });

    return accordion;
  }

  function formatDate(value) {
    if (!value) return "Data não informada";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Data não informada";
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  // ---------- Renderer DOM-safe ----------
  // Nenhum innerHTML é usado com conteúdo externo. Tudo é criado com
  // createElement/textContent, então HTML/scripts vindos do body da release
  // são exibidos como texto (sem risco de XSS).
  function renderMarkdown(container, text) {
    container.replaceChildren();

    var normalized = String(text == null ? "" : text)
      .replaceAll("\\r\\n", "\n")
      .replaceAll("\\n", "\n")
      .replaceAll("\\r", "\n");

    if (!normalized.trim()) {
      var empty = document.createElement("p");
      empty.className = "release-md__empty";
      empty.textContent = "Esta versão não possui descrição.";
      container.appendChild(empty);
      return;
    }

    var lines = normalized.split("\n");
    var listEl = null;

    function flushList() {
      if (listEl) {
        container.appendChild(listEl);
        listEl = null;
      }
    }

    lines.forEach(function (rawLine) {
      var line = rawLine.replace(/\s+$/, "");

      if (!line.trim()) {
        flushList();
        return;
      }

      var heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        flushList();
        var level = Math.min(6, heading[1].length + 2);
        var el = document.createElement("h" + level);
        el.className = "release-md__heading";
        appendInline(el, heading[2]);
        container.appendChild(el);
        return;
      }

      var bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (bullet) {
        if (!listEl) {
          listEl = document.createElement("ul");
          listEl.className = "release-md__list";
        }
        var li = document.createElement("li");
        appendInline(li, bullet[1]);
        listEl.appendChild(li);
        return;
      }

      flushList();
      var paragraph = document.createElement("p");
      paragraph.className = "release-md__p";
      appendInline(paragraph, line);
      container.appendChild(paragraph);
    });

    flushList();
  }

  function appendInline(el, text) {
    var parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

    parts.forEach(function (part) {
      if (!part) return;

      if (/^\*\*[^*]+\*\*$/.test(part)) {
        var strong = document.createElement("strong");
        strong.textContent = part.slice(2, -2);
        el.appendChild(strong);
      } else if (/^`[^`]+`$/.test(part)) {
        var code = document.createElement("code");
        code.textContent = part.slice(1, -1);
        el.appendChild(code);
      } else {
        el.appendChild(document.createTextNode(part));
      }
    });
  }

  // ---------- Bootstrap ----------
  function init() {
    ensureStyles();
    ensureMarkup();
    bindModal();
    refreshSeenState();
  }

  ouOnLoad(init);
})();
