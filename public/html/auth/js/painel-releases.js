// Controle de exibição do alerta de tutorial na página inicial
document.addEventListener("DOMContentLoaded", () => {
  const alertEl = document.getElementById("releaseID");
  const closeBtn = document.getElementById("releaseIDClose");
  if (!alertEl) return;

  if (localStorage.getItem("releaseIDClose") === "true") {
    alertEl.remove();
    return;
  }

  // Hide the alert initially and display it after a brief delay with animation
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
  const CACHE_KEY = 'gh_releases_cache_v2';
  const FAV_KEY = 'gh_releases_favs_v2';
  const CACHE_TTL_MIN = 60;

  const openBtn = document.getElementById('openReleasesBtn');
  const releasesModalEl = document.getElementById('releasesModal');
  const releasesModal = new bootstrap.Modal(releasesModalEl);
  const listEl = document.getElementById('releasesList');
  const msgEl = document.getElementById('releasesMsg');
  const filterInput = document.getElementById('filterInput');
  const sortSelect = document.getElementById('sortSelect');
  const cacheInfo = document.getElementById('cacheInfo');
  //const ghTokenInput = document.getElementById('ghToken');
  const refreshBtn = document.getElementById('refreshBtn');

  // document.addEventListener("DOMContentLoaded",() => {
  //   releasesModal.show();
  //   setTimeout(()=> filterInput.focus(), 300);
  //   loadAndRender();
  // });

  openBtn.addEventListener('click', () => {
    releasesModal.show();
    setTimeout(() => filterInput.focus(), 300);
    loadAndRender();
  });
  //refreshBtn.addEventListener('click', ()=> loadAndRender(true));
  filterInput.addEventListener('input', renderFromCache);
  sortSelect.addEventListener('change', renderFromCache);

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
    renderFromCache();
  }

  function setCache(data) {
    const payload = { ts: Date.now(), data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    updateCacheInfo();
  }
  function getCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { return null; }
  }
  function isCacheValid(ts) {
    if (!ts) return false;
    return ((Date.now() - ts) / (1000 * 60)) < CACHE_TTL_MIN;
  }
  function updateCacheInfo() {
    const c = getCache();
    if (!c) { cacheInfo.innerText = 'Nenhum'; return; }
    const mins = Math.round((Date.now() - c.ts) / 60000);
    cacheInfo.innerText = (mins === 0 ? 'agora' : `${mins} min atrás`);
  }

  async function fetchReleasesFromGitHub() {
    const url = `${BASE_URL}/api/releases`;

    console.log(url);

    const res = await fetch(url);

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`${res.status} ${res.statusText} — ${txt.slice(0, 150)}`);
    }

    const data = await res.json();
    return data.releases; // já vem do backend com ok:true, releases:[...]
  }


  async function loadAndRender(force = false) {
    msgEl.innerText = 'Carregando...'; listEl.innerHTML = '';
    //const token = ghTokenInput.value.trim() || null;
    const cached = getCache();
    if (!force && cached && isCacheValid(cached.ts)) {
      renderList(cached.data);
      msgEl.innerText = '';
      return;
    }
    try {
      const data = await fetchReleasesFromGitHub();
      setCache(data);
      renderList(data);
      msgEl.innerText = '';
    } catch (err) {
      console.error(err);
      msgEl.innerHTML = `<div class="text-danger small">Erro: ${escapeHtml(err.message)}</div>`;
      if (cached && cached.data) {
        msgEl.innerHTML += `<div class="text-muted small">Usando cache local.</div>`;
        renderList(cached.data);
      } else {
        listEl.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-circle" style="font-size:28px"></i><div class="mt-2">Não foi possível carregar releases.</div></div>`;
      }
    }
  }

  function renderFromCache() {
    const cached = getCache();
    if (!cached) { listEl.innerHTML = ''; return; }
    renderList(cached.data);
  }

  function renderList(releases) {
    updateCacheInfo();
    if (!Array.isArray(releases) || releases.length === 0) {
      listEl.innerHTML = `<div class="empty-state">Nenhuma release encontrada.</div>`; return;
    }

    const q = filterInput.value.trim().toLowerCase();
    let list = releases.filter(r => {
      if (!q) return true;
      return ((r.name || '') + ' ' + (r.tag_name || '') + ' ' + (r.body || '')).toLowerCase().includes(q);
    });

    if (sortSelect.value === 'date_asc') {
      list.sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
    } else {
      list.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    }

    const favs = getFavs();

    listEl.innerHTML = list.map(r => {
      const isFav = !!favs.find(f => f.id === r.id);
      const published = r.published_at ? new Date(r.published_at).toLocaleString() : '—';
      const short = (r.body || '').slice(0, 420);
      const author = r.author?.login || '—';
      const initials = (author && author[0]) ? author[0].toUpperCase() : '?';
      return `
          <div class="release-card">
            <div class="release-meta">
              <div class="version-badge">${escapeHtml(r.tag_name || r.name || '')}</div>
              <div class="date-small">${new Date(r.published_at || Date.now()).toLocaleDateString()}</div>
              <div class="mt-2">
                <div class="author-avatar">${"O"}</div>
                <div class="small text-muted mt-1">${"OrderUp"}</div>
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
                <div class="small text-muted">Publicada em ${new Date(r.published_at || Date.now()).toLocaleString()}</div>
              </div>
            </div>
          </div>
        `;
    }).join('');

    // events
    //listEl.querySelectorAll('.openBtn').forEach(b=> b.addEventListener('click', e => window.open(e.currentTarget.dataset.url, '_blank','noopener')));
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
      if (expanded) {
        // show full content (from cache)
        const cached = getCache();
        const r = (cached && cached.data) ? cached.data.find(rr => rr.id === id) : null;
        if (r) cardDesc.innerHTML = escapeHtml(r.body || '(sem descrição)');
      } else {
        // collapse to summary
        const cached = getCache();
        const r = (cached && cached.data) ? cached.data.find(rr => rr.id === id) : null;
        cardDesc.innerHTML = escapeHtml((r && r.body ? r.body.slice(0, 420) : '').replaceAll('\\n', '\n')) + (r && r.body && r.body.length > 420 ? '…' : '');
      }
    }));
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }

  updateCacheInfo();

  // initial note: token client-side is insecure.
})();