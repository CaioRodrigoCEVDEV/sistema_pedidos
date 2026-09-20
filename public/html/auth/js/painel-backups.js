// Encapsulado em IIFE para o Turbo poder reexecutar este script a cada
// navegação sem o erro "Identifier 'state' has already been declared"
// (declarações const/let de topo colidem no escopo global).
(() => {
  "use strict";

  const state = {
    data: [],
    sortKey: "nome",
    sortDir: 1,
    path: "", // caminho relativo dentro de /backups
    loading: false,
  };

  const els = {
    q: document.getElementById("q"),
    ext: document.getElementById("ext"),
    tbody: document.querySelector("#tbl tbody"),
    crumbs: document.getElementById("crumbs"),
    empty: document.getElementById("emptyState"),
    emptyTitle: document.getElementById("emptyTitle"),
    emptyText: document.getElementById("emptyText"),
    loading: document.getElementById("loadingState"),
    results: document.getElementById("resultsInfo"),
    refresh: document.getElementById("btnRefresh"),
  };

  // ---------- helpers ----------
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  const fmtKB = (v) => {
    const n = Number(v);
    return Number.isFinite(n)
      ? n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
      : v;
  };

  function fileIcon(name) {
    const n = String(name || "").toLowerCase();
    if (n.endsWith(".tgz") || n.endsWith(".tar.gz") || n.endsWith(".zip")) {
      return "bi-file-earmark-zip";
    }
    if (n.endsWith(".log") || n.endsWith(".txt")) {
      return "bi-file-earmark-text";
    }
    if (n.endsWith(".sql") || n.endsWith(".dump")) {
      return "bi-filetype-sql";
    }
    if (n.endsWith(".pdf")) {
      return "bi-file-earmark-pdf";
    }
    return "bi-file-earmark";
  }

  function showEmpty(show, title, text) {
    if (title) els.emptyTitle.textContent = title;
    if (text) els.emptyText.textContent = text;
    els.empty.style.display = show ? "flex" : "none";
  }

  function setLoading(isLoading) {
    els.loading.style.display = isLoading ? "flex" : "none";
    if (isLoading) els.empty.style.display = "none";
  }

  // ---------- carregamento ----------
  async function load() {
    if (state.loading) return;
    state.loading = true;
    setLoading(true);

    const endpoint = state.path
      ? `/backups/folder/${encodeURIComponent(state.path)}`
      : "/backups";

    try {
      const r = await fetch(endpoint, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Falha ao carregar lista");
      const json = await r.json();
      state.data = Array.isArray(json.backups) ? json.backups : [];
      renderBreadcrumb();
      render();
    } catch (err) {
      console.error(err);
      state.data = [];
      renderBreadcrumb();
      render();
      showEmpty(
        true,
        "Erro ao carregar",
        "Não foi possível carregar os backups. Tente novamente."
      );
      if (window.ouToast) window.ouToast("Falha ao carregar os backups.", "error");
    } finally {
      state.loading = false;
      setLoading(false);
    }
  }

  // ---------- breadcrumb ----------
  function renderBreadcrumb() {
    const parts = state.path.split("/").filter(Boolean);
    const items = [
      '<li class="breadcrumb-item"><a href="#" data-path=""><i class="bi bi-hdd-stack me-1"></i>Backups</a></li>',
    ];

    const acc = [];
    parts.forEach((seg, i) => {
      acc.push(seg);
      const p = acc.join("/");
      const isLast = i === parts.length - 1;
      items.push(
        isLast
          ? `<li class="breadcrumb-item active" aria-current="page">${escapeHtml(seg)}</li>`
          : `<li class="breadcrumb-item"><a href="#" data-path="${escapeHtml(p)}">${escapeHtml(seg)}</a></li>`
      );
    });

    els.crumbs.innerHTML = items.join("");
    els.crumbs.querySelectorAll("a[data-path]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        state.path = a.dataset.path;
        load();
      });
    });
  }

  // ---------- render ----------
  function render() {
    const q = els.q.value.trim().toLowerCase();
    const ext = els.ext.value.toLowerCase();

    const rows = state.data.filter((it) => {
      const nome = String(it.nome || "");
      if (q && !nome.toLowerCase().includes(q)) return false;
      if (ext) {
        if (it.tipo !== "arquivo") return false;
        if (!nome.toLowerCase().endsWith(ext)) return false;
      }
      return true;
    });

    const key = state.sortKey;
    const dir = state.sortDir;
    rows.sort((a, b) => {
      // pastas sempre antes de arquivos
      const fa = a.tipo === "pasta" ? 0 : 1;
      const fb = b.tipo === "pasta" ? 0 : 1;
      if (fa !== fb) return fa - fb;

      let va;
      let vb;
      if (key === "tamanhoKB") {
        va = a.tipo === "pasta" ? -1 : Number(a[key]) || 0;
        vb = b.tipo === "pasta" ? -1 : Number(b[key]) || 0;
      } else {
        va = String(a[key] || "").toLowerCase();
        vb = String(b[key] || "").toLowerCase();
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });

    renderRows(rows);
    updateSortIndicators();
    updateFooter(rows.length);

    if (rows.length === 0) {
      if (q || ext) {
        showEmpty(
          true,
          "Nenhum resultado",
          "Ajuste a busca ou o filtro de tipo e tente novamente."
        );
      } else {
        showEmpty(
          true,
          "Nenhum backup encontrado",
          state.path ? "Esta pasta está vazia." : "Não há backups disponíveis no momento."
        );
      }
    } else {
      showEmpty(false);
    }
  }

  function renderRows(rows) {
    els.tbody.innerHTML = "";
    const frag = document.createDocumentFragment();

    rows.forEach((it) => {
      const isFolder = it.tipo === "pasta";
      const tr = document.createElement("tr");

      if (isFolder) {
        tr.className = "ou-backup-row";
      }

      const icon = isFolder ? "bi-folder-fill" : fileIcon(it.nome);
      const size = isFolder ? "—" : `${fmtKB(it.tamanhoKB)} KB`;

      const actionHTML = isFolder
        ? `<button type="button" class="btn btn-sm btn-outline-primary btn-open">
             <i class="bi bi-box-arrow-in-right"></i> Abrir
           </button>`
        : `<a class="btn btn-sm btn-outline-primary" href="${escapeHtml(it.url)}" download>
             <i class="bi bi-download"></i> Baixar
           </a>`;

      tr.innerHTML = `
        <td>
          <div class="ou-backup-name">
            <i class="bi ${icon} ou-backup-name__icon ${isFolder ? "is-folder" : ""}" aria-hidden="true"></i>
            <span class="ou-backup-name__text" title="${escapeHtml(it.nome)}">${escapeHtml(it.nome)}</span>
          </div>
        </td>
        <td class="text-end ou-backup-size">${size}</td>
        <td class="text-end">${actionHTML}</td>
      `;

      if (isFolder) {
        const open = () => enterFolder(it.nome);
        tr.addEventListener("click", open);
        tr.querySelector(".btn-open").addEventListener("click", (e) => {
          e.stopPropagation();
          open();
        });
      }

      frag.appendChild(tr);
    });

    els.tbody.appendChild(frag);
  }

  function enterFolder(name) {
    state.path = state.path ? `${state.path}/${name}` : name;
    load();
  }

  function updateSortIndicators() {
    document.querySelectorAll("#tbl th[data-k]").forEach((th) => {
      if (th.dataset.k === state.sortKey) {
        th.setAttribute(
          "aria-sort",
          state.sortDir === 1 ? "ascending" : "descending"
        );
      } else {
        th.removeAttribute("aria-sort");
      }
    });
  }

  function updateFooter(count) {
    const pastas = state.data.filter((i) => i.tipo === "pasta").length;
    const arquivos = state.data.filter((i) => i.tipo === "arquivo").length;

    if (count === state.data.length) {
      els.results.textContent = `${pastas} pasta(s) • ${arquivos} arquivo(s)`;
    } else {
      els.results.textContent = `${count} de ${state.data.length} item(ns)`;
    }
  }

  // ---------- eventos ----------
  let searchTimer;
  els.q.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, 150);
  });

  els.ext.addEventListener("change", render);

  if (els.refresh) els.refresh.addEventListener("click", () => load());

  document.querySelectorAll("#tbl th[data-k]").forEach((th) => {
    th.addEventListener("click", () => {
      const k = th.dataset.k;
      if (state.sortKey === k) {
        state.sortDir *= -1;
      } else {
        state.sortKey = k;
        state.sortDir = 1;
      }
      render();
    });
  });

  load();
})();
