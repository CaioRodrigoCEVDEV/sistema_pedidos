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
  const releasesModal = releasesModalEl ? new bootstrap.Modal(releasesModalEl) : null;
  const listEl = document.getElementById('releasesList');
  const msgEl = document.getElementById('releasesMsg');
  const filterInput = document.getElementById('filterInput');
  const sortSelect = document.getElementById('sortSelect');
  const cacheInfo = document.getElementById('cacheInfo');
  const refreshBtn = document.getElementById('refreshBtn');

  if (!listEl || !msgEl) {
    console.warn('Releases: elementos essenciais não encontrados, abortando inicialização.');
    return;
  }

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (releasesModal) releasesModal.show();
      setTimeout(() => filterInput && filterInput.focus(), 300);
      loadAndRender();
    });
  }

  if (filterInput) filterInput.addEventListener('input', renderFromCache);
  if (sortSelect) sortSelect.addEventListener('change', renderFromCache);
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
    if (!c) { if (cacheInfo) cacheInfo.innerText = 'Nenhum'; return; }
    const mins = Math.round((Date.now() - c.ts) / 60000);
    if (cacheInfo) cacheInfo.innerText = (mins === 0 ? 'agora' : `${mins} min atrás`);
  }

  // ---------- FETCH ajustado para produção ----------
  async function fetchReleasesFromGitHub(forceBypass = false) {
    // usa URL relativa: /api/releases (mesmo host) — evita problemas de CORS/proxy
    let url = '/api/releases';
    if (forceBypass) url += `?t=${Date.now()}`;
    // tenta sem cache; credentials same-origin para cookies se necessário
    const opts = { cache: 'no-store', credentials: 'same-origin', headers: { 'Accept': 'application/json' } };

    console.debug('[releases] fetching', url, opts);
    const res = await fetch(url, opts);

    if (!res.ok) {
      const txt = await res.text().catch(()=>'<no-body>');
      throw new Error(`${res.status} ${res.statusText} — ${txt.slice(0, 150)}`);
    }

    // tenta parse seguro
    const payload = await res.json().catch(e => { throw new Error('JSON inválido da API de releases'); });

    // backend expected format: { ok:true, releases:[...] } ou { releases:[...] }
    const releases = payload.releases || payload.data || payload;
    if (!Array.isArray(releases)) {
      throw new Error('Formato inesperado do JSON de releases');
    }
    return releases;
  }

  async function loadAndRender(force = false) {
    msgEl.innerText = 'Carregando...'; listEl.innerHTML = '';
    const cached = getCache();

    // se cache vigente e não for forçar, usa cache
    if (!force && cached && isCacheValid(cached.ts)) {
      console.debug('[releases] usando cache válido');
      renderList(cached.data);
      msgEl.innerText = '';
      return;
    }

    try {
      // tenta fetch normal; se falhar por cache intermediário, tentamos com bypass
      let data;
      try {
        data = await fetchReleasesFromGitHub(false);
      } catch (e) {
        console.warn('[releases] fetch sem bypass falhou:', e.message, 'Tentando com bypass ?t=');
        // tenta forçar bypass (evita proxies/CDN cache)
        data = await fetchReleasesFromGitHub(true);
      }
      setCache(data);
      renderList(data);
      msgEl.innerText = '';
    } catch (err) {
      console.error('[releases] erro ao carregar releases', err);
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
                <div class="small text-muted">Publicada em ${new Date(r.published_at || Date.now()).toLocaleString()}</div>
              </div>
            </div>
          </div>
        `;
    }).join('');

    // events
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
      const cached = getCache();
      const r = (cached && cached.data) ? cached.data.find(rr => rr.id === id) : null;
      if (expanded) {
        if (r) cardDesc.innerHTML = escapeHtml(r.body || '(sem descrição)');
      } else {
        if (r) cardDesc.innerHTML = escapeHtml((r.body ? r.body.slice(0, 420) : '').replaceAll('\\n', '\n')) + (r && r.body && r.body.length > 420 ? '…' : '');
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
})();
