document.addEventListener("DOMContentLoaded", async () => {
  const alertEl = document.getElementById("releaseID");
  const closeBtn = document.getElementById("releaseIDClose");
  const br = document.getElementById("br");

  try {
    const response = await fetch("/usuario/viuversao", {
      method: "GET",
      credentials: "include" // envia o cookie HttpOnly
    });

    if (!response.ok) throw new Error("Falha ao obter usuário");

    const data = await response.json();
    const viuversao = data.usuviuversao || "N";
    const usucod = data.usucod;
    

    if (!alertEl) return;

    if (viuversao === "S" && localStorage.getItem("releaseIDClose") === "true") {
      alertEl.style.display = "none";
      return;
    }

    //alertEl.style.display = "none";
    setTimeout(() => {
      br.style.display = "block";
      alertEl.style.display = "block";
      alertEl.classList.add("slide-down");
    }, 1500);

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
      br.style.display = "none";
        try {
          fetch(`${BASE_URL}/usuario/viuversao/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            credentials: "include", // envia o cookie HttpOnly
            body: JSON.stringify({ viuversao: "S",usucod: usucod })
          });
        } catch (err) {
          console.error("Erro ao atualizar viuversao:", err);
        }
        alertEl.style.display = "none";
        localStorage.setItem("releaseIDClose", "true");
      });
    }

  } catch (err) {
    console.error("Erro ao buscar nome do usuário:", err);
  }
});

(function () {
  const openBtn = document.getElementById('openReleasesBtn');
  const releasesModalEl = document.getElementById('releasesModal');
  const releasesModal = releasesModalEl ? new bootstrap.Modal(releasesModalEl) : null;
  const listEl = document.getElementById('releasesList');
  const msgEl = document.getElementById('releasesMsg');

  if (!listEl || !msgEl) {
    console.warn('Releases: elementos essenciais não encontrados, abortando inicialização.');
    return;
  }

  // Cache em memória apenas durante a sessão da página. O botão sempre
  // reaproveita o que já foi carregado do banco.
  let loaded = false;

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (releasesModal) releasesModal.show();
      if (!loaded) loadAndRender();
    });
  }

  // --- FETCH: exclusivamente a API do sistema, que lê o PostgreSQL ---
  async function fetchReleases() {
    const res = await fetch('/api/releases', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async function loadAndRender() {
    listEl.replaceChildren();
    setMessage('Carregando atualizações...');

    try {
      const releases = await fetchReleases();
      loaded = true;
      render(releases);
    } catch (err) {
      console.error('[releases] erro ao carregar releases', err);
      renderError();
    }
  }

  function setMessage(text) {
    msgEl.replaceChildren();
    const div = document.createElement('div');
    div.className = 'release-feedback';
    div.textContent = text;
    msgEl.appendChild(div);
  }

  function renderError() {
    listEl.replaceChildren();
    msgEl.replaceChildren();

    const wrap = document.createElement('div');
    wrap.className = 'release-feedback release-feedback--error';

    const title = document.createElement('p');
    title.className = 'mb-2';
    title.textContent = 'Não foi possível carregar as atualizações.';

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn-sm btn-outline-primary';
    retry.textContent = 'Tentar novamente';
    retry.addEventListener('click', () => loadAndRender());

    wrap.append(title, retry);
    msgEl.appendChild(wrap);
  }

  function render(releases) {
    listEl.replaceChildren();
    msgEl.replaceChildren();

    if (!releases.length) {
      listEl.appendChild(renderEmpty());
      return;
    }

    // A ordenação vem do backend (mais recente primeiro). O primeiro item é,
    // por definição, a release mais recente — nada fica hardcoded no frontend.
    const [latest, ...history] = releases;
    listEl.appendChild(renderLatest(latest));

    if (history.length) {
      const heading = document.createElement('h6');
      heading.className = 'release-history__title';
      heading.textContent = 'Histórico de versões';
      listEl.appendChild(heading);
      listEl.appendChild(renderHistory(history));
    }
  }

  function renderEmpty() {
    const empty = document.createElement('div');
    empty.className = 'empty-state';

    const icon = document.createElement('i');
    icon.className = 'bi bi-inboxes';
    icon.setAttribute('aria-hidden', 'true');

    const text = document.createElement('p');
    text.className = 'mt-2 mb-0';
    text.textContent = 'Nenhuma atualização cadastrada ainda.';

    empty.append(icon, text);
    return empty;
  }

  function renderLatest(release) {
    const card = document.createElement('article');
    card.className = 'release-card release-card--latest';

    const header = document.createElement('div');
    header.className = 'release-latest__header';

    const badge = document.createElement('span');
    badge.className = 'version-badge';
    badge.textContent = release.version || release.tag_name || 'Versão';

    const date = document.createElement('span');
    date.className = 'release-date';
    date.textContent = formatDate(release.published_at);

    header.append(badge, date);

    const titleText = release.name || release.tag_name || '';
    if (titleText) {
      const title = document.createElement('h5');
      title.className = 'release-title-text';
      title.textContent = titleText;
      card.appendChild(title);
    }

    const body = document.createElement('div');
    body.className = 'release-md';
    renderMarkdown(body, release.body);

    card.append(header, body);
    return card;
  }

  function renderHistory(items) {
    const accordion = document.createElement('div');
    accordion.className = 'accordion release-history';
    accordion.id = 'releasesHistoryAccordion';

    items.forEach((release, index) => {
      const targetId = 'release-history-' + (release.id || index);

      const item = document.createElement('div');
      item.className = 'accordion-item release-history__item';

      const header = document.createElement('h2');
      header.className = 'accordion-header';

      const toggle = document.createElement('button');
      toggle.className = 'accordion-button collapsed release-history__toggle';
      toggle.type = 'button';
      toggle.setAttribute('data-bs-toggle', 'collapse');
      toggle.setAttribute('data-bs-target', '#' + targetId);
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', targetId);

      const version = document.createElement('span');
      version.className = 'release-history__version';
      version.textContent = release.version || release.tag_name || '';

      const name = document.createElement('span');
      name.className = 'release-history__name';
      const displayName = release.name || '';
      const displayVersion = release.version || release.tag_name || '';
      name.textContent = displayName && displayName !== displayVersion ? displayName : '';

      const date = document.createElement('span');
      date.className = 'release-history__date';
      date.textContent = formatDate(release.published_at);

      toggle.append(version, name, date);
      header.appendChild(toggle);

      const collapse = document.createElement('div');
      collapse.id = targetId;
      collapse.className = 'accordion-collapse collapse';
      collapse.setAttribute('data-bs-parent', '#releasesHistoryAccordion');

      const body = document.createElement('div');
      body.className = 'accordion-body release-md';
      renderMarkdown(body, release.body);
      collapse.appendChild(body);

      item.append(header, collapse);
      accordion.appendChild(item);
    });

    return accordion;
  }

  function formatDate(value) {
    if (!value) return 'Data não informada';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Data não informada';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  // ---------- Renderer DOM-safe ----------
  // Nenhum innerHTML é usado com conteúdo externo. Tudo é criado com
  // createElement/textContent, então HTML/scripts vindos do body da release
  // são exibidos como texto (sem risco de XSS).
  function renderMarkdown(container, text) {
    container.replaceChildren();

    const normalized = String(text == null ? '' : text)
      .replaceAll('\\r\\n', '\n')
      .replaceAll('\\n', '\n')
      .replaceAll('\\r', '\n');

    if (!normalized.trim()) {
      const empty = document.createElement('p');
      empty.className = 'release-md__empty';
      empty.textContent = 'Esta versão não possui descrição.';
      container.appendChild(empty);
      return;
    }

    const lines = normalized.split('\n');
    let listEl = null;

    const flushList = () => {
      if (listEl) {
        container.appendChild(listEl);
        listEl = null;
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.replace(/\s+$/, '');

      if (!line.trim()) {
        flushList();
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        flushList();
        const level = Math.min(6, heading[1].length + 2);
        const el = document.createElement('h' + level);
        el.className = 'release-md__heading';
        appendInline(el, heading[2]);
        container.appendChild(el);
        continue;
      }

      const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (bullet) {
        if (!listEl) {
          listEl = document.createElement('ul');
          listEl.className = 'release-md__list';
        }
        const li = document.createElement('li');
        appendInline(li, bullet[1]);
        listEl.appendChild(li);
        continue;
      }

      flushList();
      const paragraph = document.createElement('p');
      paragraph.className = 'release-md__p';
      appendInline(paragraph, line);
      container.appendChild(paragraph);
    }

    flushList();
  }

  function appendInline(el, text) {
    const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

    for (const part of parts) {
      if (!part) continue;

      if (/^\*\*[^*]+\*\*$/.test(part)) {
        const strong = document.createElement('strong');
        strong.textContent = part.slice(2, -2);
        el.appendChild(strong);
      } else if (/^`[^`]+`$/.test(part)) {
        const code = document.createElement('code');
        code.textContent = part.slice(1, -1);
        el.appendChild(code);
      } else {
        el.appendChild(document.createTextNode(part));
      }
    }
  }
})();
