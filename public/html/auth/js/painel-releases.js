// Controle de exibição do alerta de tutorial na página inicial (inalterado)
document.addEventListener("DOMContentLoaded", () => {
  const alertEl = document.getElementById("releaseID");
  const closeBtn = document.getElementById("releaseIDClose");
  if (!alertEl) return;

  if (localStorage.getItem("releaseIDClose") === "true") {
    // deixar sempre mostrando por enquanto
    localStorage.removeItem("releaseIDClose");
    return;
  }

  alertEl.style.display = "none";
  setTimeout(() => {
    alertEl.style.display = "block";
    alertEl.classList.add("slide-down");
  }, 1500);

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      localStorage.setItem("releaseIDClose", "true");
    });
  }
});

(function () {
  const OWNER = 'CaioRodrigoCEVDEV';
  const REPO = 'sistema_pedidos';

  // ======= REMOVIDO CACHE DE RELEASES =======
  const FAV_KEY = 'gh_releases_favs_v2';

  const openBtn = document.getElementById('openReleasesBtn');
  const releasesModalEl = document.getElementById('releasesModal');
  const releasesModal = releasesModalEl ? new bootstrap.Modal(releasesModalEl) : null;
  const listEl = document.getElementById('releasesList');
  const msgEl = document.getElementById('releasesMsg');
  const filterInput = document.getElementById('filterInput');
  const sortSelect = document.getElementById('sortSelect');
  const cacheInfo = document.getElementById('cacheInfo'); // manter elemento: mostra "agora"
  const refreshBtn = document.getElementById('refreshBtn');

  // fonte única de verdade em memória (sem localStorage)
  let releasesData = [];

  if (!listEl || !msgEl) {
    console.warn('Releases: elementos essenciais não encontrados, abortando inicialização.');
    return;
  }

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (releasesModal) releasesModal.show();
      setTimeout(() => filterInput && filterInput.focus(), 300);
      loadAndRender(); // sempre bate na API
    });
  }

  if (filterInput) filterInput.addEventListener('input', renderFromMemory);
  if (sortSelect) sortSelect.addEventListener('change', renderFromMemory);
  if (refreshBtn) refreshBtn.addEventListener('click', () => loadAndRender(true));

  function getFavs() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch (e) { return []; }
  }
  function setFavs(favs) { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); }

  function toggleFav(id, release) {
    const favs = getFavs();
    const exists = favs.find(f => f.id === id);
    if (exists) {
      setFavs(favs.filter(f => f.id !== id));
    } else {
      favs.push({ id, tag_name: release.tag_name, name: release.name, ts: Date.now() });
      setFavs(favs);
    }
    renderFromMemory();
  }

  function updateInfoNow() {
    if (cacheInfo) cacheInfo.innerText = 'agora'; // compatível com UI atual
  }

  // ---------- FETCH sempre sem cache ----------
// --- FETCH sempre sem cache e compatível com o JSON real ---
async function fetchReleasesFromAPI() {
  let url = '/api/releases?t=' + Date.now();

  const opts = {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  };

  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const payload = await res.json();
  // 🔹 Ajuste direto conforme seu retorno real:
  // { ok: true, fromCache: true, releases: [ {...}, {...} ] }
  const releases = payload.releases || [];
  if (!Array.isArray(releases) || releases.length === 0)
    throw new Error('Nenhuma release encontrada');

  return releases;
}

// --- carrega e renderiza sempre direto da API ---
async function loadAndRender() {
  msgEl.innerText = 'Carregando...';
  listEl.innerHTML = '';

  try {
    const data = await fetchReleasesFromAPI();

    // 🔹 Normaliza campos, garantindo que o renderList receba estrutura completa
    releasesData = data.map(r => ({
      id: r.id,
      tag_name: r.tag_name || '',
      name: r.name || '',
      body: r.body || '',
      published_at: r.published_at || '',
    }));

    updateInfoNow();
    renderList(releasesData);
    msgEl.innerText = '';
  } catch (err) {
    console.error('[releases] erro ao carregar releases', err);
    msgEl.innerHTML = `<div class="text-danger small">Erro: ${escapeHtml(err.message)}</div>`;
    listEl.innerHTML = `<div class="empty-state">
      <i class="bi bi-exclamation-circle" style="font-size:28px"></i>
      <div class="mt-2">Não foi possível carregar releases.</div>
    </div>`;
  }
}


  async function loadAndRender(force = false) {
    msgEl.innerText = 'Carregando...';
    listEl.innerHTML = '';

    try {
      let data;
      try {
        data = await fetchReleasesFromAPI(false);
      } catch (e) {
        console.warn('[releases] tentativa 1 falhou:', e.message, ' -> tentando bypass');
        data = await fetchReleasesFromAPI(true);
      }

      releasesData = data;          // mantém apenas em memória
      updateInfoNow();              // mostra "agora"
      renderList(releasesData);     // render
      msgEl.innerText = '';
    } catch (err) {
      console.error('[releases] erro ao carregar releases', err);
      msgEl.innerHTML = `<div class="text-danger small">Erro: ${escapeHtml(err.message)}</div>`;
      // sem cache local — mostra estado vazio elegante
      listEl.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-circle" style="font-size:28px"></i><div class="mt-2">Não foi possível carregar releases.</div></div>`;
    }
  }

  function renderFromMemory() {
    if (!Array.isArray(releasesData)) return;
    renderList(releasesData);
  }

  function renderList(releases) {
    updateInfoNow();

    if (!Array.isArray(releases) || releases.length === 0) {
      listEl.innerHTML = `<div class="empty-state">Nenhuma release encontrada.</div>`;
      return;
    }

    const q = (filterInput && filterInput.value) ? filterInput.value.trim().toLowerCase() : '';
    let list = releases.filter(r => {
      if (!q) return true;
      return ((r.name || '') + ' ' + (r.tag_name || '') + ' ' + (r.body || '')).toLowerCase().includes(q);
    });

    if (sortSelect && sortSelect.value === 'date_asc') {
      list.sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
    } else {
      list.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    }

    const favs = getFavs();

    listEl.innerHTML = list.map(r => {
      const isFav = !!favs.find(f => f.id === r.id);
      const published = r.published_at ? new Date(r.published_at).toLocaleString() : '—';
      const short = (r.body || '').slice(0, 420);
      return `
        <div class="release-card">
          <div class="release-meta">
            <div class="version-badge">${escapeHtml(r.tag_name || r.name || '')}</div>
            <div class="date-small">${new Date(r.published_at || Date.now()).toLocaleDateString()}</div>
            <div class="mt-2">
              <div class="author-avatar">O</div>
              <div class="small text-muted mt-1">OrderUp</div>
            </div>
          </div>

          <div class="release-body">
            <div class="release-title">
              <div>
                <h5>${escapeHtml(r.name || '')}</h5>
                <div class="release-sub">${escapeHtml(r.tag_name || '')} • <span class="text-muted">${escapeHtml(published)}</span></div>
              </div>
            </div>

            <div class="release-desc" data-id="${r.id}">
              ${escapeHtml(short)}
              ${(r.body && r.body.length > 420) ? '…' : ''}
            </div>

            <div class="d-flex justify-content-between align-items-center mt-2">
              <div>
                ${(r.body && r.body.length > 420) ? `<a href="#" class="readmore small" data-id="${r.id}">Ver mais</a>` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // handlers
    listEl.querySelectorAll('.favBtn').forEach(b => b.addEventListener('click', e => {
      const id = Number(e.currentTarget.dataset.id);
      const release = releases.find(r => r.id === id);
      toggleFav(id, release);
    }));

    listEl.querySelectorAll('.readmore').forEach(a => a.addEventListener('click', ev => {
      ev.preventDefault();
      const id = Number(ev.currentTarget.dataset.id);
      const cardDesc = listEl.querySelector(`.release-desc[data-id="${id}"]`);
      if (!cardDesc) return;

      const expanded = cardDesc.classList.toggle('expanded');
      ev.currentTarget.innerText = expanded ? 'Ver menos' : 'Ver mais';

      const r = Array.isArray(releasesData) ? releasesData.find(rr => rr.id === id) : null;
      if (expanded) {
        if (r) cardDesc.innerHTML = escapeHtml(r.body || '(sem descrição)');
      } else {
        if (r) {
          const base = (r.body ? r.body.slice(0, 420) : '').replaceAll('\\n', '\n');
          cardDesc.innerHTML = escapeHtml(base) + (r && r.body && r.body.length > 420 ? '…' : '');
        }
      }
    }));
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }

  updateInfoNow();
})();
