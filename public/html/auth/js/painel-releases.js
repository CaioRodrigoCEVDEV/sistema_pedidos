// Controle de exibição do alerta de tutorial na página inicial
document.addEventListener("DOMContentLoaded", () => {
  const alertEl = document.getElementById("releaseID");
  const closeBtn = document.getElementById("releaseIDClose");
  if (!alertEl) return;

  if (localStorage.getItem("releaseIDClose") === "true") {
    // deixar sempre mostrando por enquanto // alertEl.remove();
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

  // Evita colapso de layout no Chrome
  const modalBody = releasesModalEl?.querySelector('.modal-body') || releasesModalEl;
  if (modalBody) {
    modalBody.style.maxHeight = '70vh';
    modalBody.style.overflowY = 'auto';
  }
  listEl.style.minHeight = '300px';
  listEl.style.maxHeight = '65vh';
  listEl.style.overflowY = 'auto';
  listEl.style.display = 'block';
  listEl.style.visibility = 'visible';

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (releasesModal) releasesModal.show();
      // Render depois do modal abrir para garantir dimensões válidas
      requestAnimationFrame(() => {
        setTimeout(() => filterInput && filterInput.focus(), 50);
        loadAndRender();
      });
    });
  }

  if (filterInput) filterInput.addEventListener('input', renderFromCache);
  if (sortSelect) sortSelect.addEventListener('change', renderFromCache);
  if (refreshBtn) refreshBtn.addEventListener('click', () => loadAndRender(true));

  function getFavs() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
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
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
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
    let url = '/api/releases';
    if (forceBypass) url += `?t=${Date.now()}`;
    const opts = { cache: 'no-store', credentials: 'same-origin', headers: { 'Accept': 'application/json' } };

    const res = await fetch(url, opts);
    if (!res.ok) {
      const txt = await res.text().catch(() => '<no-body>');
      throw new Error(`${res.status} ${res.statusText} — ${txt.slice(0, 150)}`);
    }

    const payload = await res.json().catch(() => { throw new Error('JSON inválido da API de releases'); });
    const releases = payload.releases || payload.data || payload;
    if (!Array.isArray(releases)) throw new Error('Formato inesperado do JSON de releases');
    return releases;
  }

  async function loadAndRender(force = false) {
    setMsg('Carregando...', 'muted');
    listEl.replaceChildren();

    const cached = getCache();
    if (!force && cached && isCacheValid(cached.ts)) {
      renderList(cached.data);
      setMsg('');
      return;
    }

    try {
      let data;
      try {
        data = await fetchReleasesFromGitHub(false);
      } catch (e) {
        console.warn('[releases] fetch sem bypass falhou:', e.message, 'Tentando com bypass ?t=');
        data = await fetchReleasesFromGitHub(true);
      }
      setCache(data);
      renderList(data);
      setMsg('');
    } catch (err) {
      console.error('[releases] erro ao carregar releases', err);
      setMsg(`Erro: ${err.message}`, 'danger');
      if (cached?.data) {
        setMsgAppend('Usando cache local.', 'muted');
        renderList(cached.data);
      } else {
        renderEmpty('Não foi possível carregar releases.');
      }
    }
  }

  function renderFromCache() {
    const cached = getCache();
    if (!cached) { listEl.replaceChildren(); return; }
    renderList(cached.data);
  }

  // ---------- Helpers DOM-safe ----------
  function setMsg(text, variant = 'muted') {
    msgEl.replaceChildren();
    if (!text) return;
    const div = document.createElement('div');
    div.className = variant === 'danger' ? 'text-danger small' : 'text-muted small';
    div.textContent = text;
    msgEl.appendChild(div);
  }
  function setMsgAppend(text, variant = 'muted') {
    if (!text) return;
    const div = document.createElement('div');
    div.className = variant === 'danger' ? 'text-danger small' : 'text-muted small';
    div.textContent = text;
    msgEl.appendChild(div);
  }

  function addTextWithBreaks(el, text) {
    const parts = String(text || '').split(/\r?\n/);
    parts.forEach((p, i) => {
      if (i) el.appendChild(document.createElement('br'));
      el.appendChild(document.createTextNode(p));
    });
  }

  function renderEmpty(text) {
    listEl.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'empty-state';
    wrap.textContent = text;
    listEl.appendChild(wrap);
  }

  // ---------- RENDER LIST (DOM-safe) ----------
  function renderList(releases) {
    updateCacheInfo();
    if (!Array.isArray(releases) || releases.length === 0) {
      renderEmpty('Nenhuma release encontrada.');
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
    listEl.replaceChildren();
    const frag = document.createDocumentFragment();

    list.forEach(r => {
      const isFav = !!favs.find(f => f.id === r.id);
      const published = r.published_at ? new Date(r.published_at).toLocaleString() : '—';
      const fullBody = r.body || '';
      const shortBody = fullBody.slice(0, 420);
      const hasMore = fullBody.length > 420;

      const card = document.createElement('div');
      card.className = 'release-card';

      // meta
      const meta = document.createElement('div');
      meta.className = 'release-meta';

      const badge = document.createElement('div');
      badge.className = 'version-badge';
      badge.textContent = (r.tag_name || r.name || '');

      const dateSmall = document.createElement('div');
      dateSmall.className = 'date-small';
      dateSmall.textContent = new Date(r.published_at || Date.now()).toLocaleDateString();

      const authorWrap = document.createElement('div');
      authorWrap.className = 'mt-2';
      const avatar = document.createElement('div');
      avatar.className = 'author-avatar';
      avatar.textContent = 'O';
      const by = document.createElement('div');
      by.className = 'small text-muted mt-1';
      by.textContent = 'OrderUp';
      authorWrap.append(avatar, by);

      meta.append(badge, dateSmall, authorWrap);

      // body
      const bodyWrap = document.createElement('div');
      bodyWrap.className = 'release-body';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'release-title';
      const titleInner = document.createElement('div');

      const h5 = document.createElement('h5');
      h5.textContent = (r.name || '');

      const sub = document.createElement('div');
      sub.className = 'release-sub';
      const tagSpan = document.createElement('span');
      tagSpan.textContent = (r.tag_name || '');
      const sep = document.createTextNode(' • ');
      const dateSpan = document.createElement('span');
      dateSpan.className = 'text-muted';
      dateSpan.textContent = published;
      sub.append(tagSpan, sep, dateSpan);

      titleInner.append(h5, sub);
      titleWrap.append(titleInner);

      const desc = document.createElement('div');
      desc.className = 'release-desc';
      desc.dataset.id = r.id;
      addTextWithBreaks(desc, shortBody);
      if (hasMore) desc.appendChild(document.createTextNode('…'));

      const footer = document.createElement('div');
      footer.className = 'd-flex justify-content-between align-items-center mt-2';
      const left = document.createElement('div');
      if (hasMore) {
        const more = document.createElement('a');
        more.href = '#';
        more.className = 'readmore small';
        more.dataset.id = r.id;
        more.textContent = 'Ver mais';
        left.appendChild(more);
      }
      footer.appendChild(left);

      bodyWrap.append(titleWrap, desc, footer);
      card.append(meta, bodyWrap);
      frag.appendChild(card);
    });

    listEl.appendChild(frag);

    // events
    listEl.querySelectorAll('.favBtn').forEach(b => b.addEventListener('click', e => {
      const id = Number(e.currentTarget.dataset.id);
      const release = releases.find(rr => rr.id === id);
      toggleFav(id, release);
    }));

    listEl.querySelectorAll('.readmore').forEach(a => a.addEventListener('click', ev => {
      ev.preventDefault();
      const id = Number(ev.currentTarget.dataset.id);
      const cardDesc = listEl.querySelector(`.release-desc[data-id="${id}"]`);
      if (!cardDesc) return;

      const expanded = cardDesc.classList.toggle('expanded');
      ev.currentTarget.textContent = expanded ? 'Ver menos' : 'Ver mais';

      const r = releases.find(rr => rr.id === id);
      const text = expanded
        ? (r?.body || '(sem descrição)')
        : ((r?.body || '').slice(0, 420) + ((r?.body?.length || 0) > 420 ? '…' : ''));

      // troca conteúdo sem innerHTML
      cardDesc.replaceChildren();
      addTextWithBreaks(cardDesc, text);
    }));
  }

  // Mantido para compatibilidade (não usado no DOM-safe)
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }

  updateCacheInfo();
})();
