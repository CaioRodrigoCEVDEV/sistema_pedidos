const params = new URLSearchParams(window.location.search);

const id = params.get("id");
const marcascod = params.get("marcascod");

const usersData = [
  //popular table com os dados do modelo
  { id: 0, nome: " ", email: " ", senha: " ", adm: "S", sta: "A" },
];

// Estado
let users = [...usersData]; // clone para manipulação local
let filtered = [...users];
let telasRegistry = []; // catálogo de telas liberáveis
// Carrega dados reais da API e atualiza users/usersData
// --- Função central para recarregar usuários da API e atualizar UI ---
async function refreshUsers({ keepSearch = true } = {}) {
  try {
    const res = await fetch(`${BASE_URL}/usuario/listar`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dados = await res.json();
    const list = Array.isArray(dados) ? dados : [];

    // atualiza arrays usados pelo resto do script
    usersData.length = 0;
    usersData.push(...list);
    users = [...usersData];

    // preserva termo de busca atual (ou limpa) e re-renderiza
    const termo = keepSearch && searchInput ? searchInput.value : "";
    doSearch(termo);
  } catch (err) {
    console.error("Failed to refresh users:", err);
    alert("Erro ao recarregar usuários. Veja console para mais detalhes.");
  }
}

// Substitui seu IIFE loadUsers original — usa refreshUsers para inicializar
(async function init() {
  try {
    const res = await fetch(`${BASE_URL}/telas`);
    if (res.ok) {
      telasRegistry = await res.json();
    }
  } catch (err) {
    console.error("Falha ao carregar catálogo de telas:", err);
  }
  renderTelasChecks([]);
  await refreshUsers();
})();

// Renderiza as checkboxes de telas liberáveis, agrupadas por grupo.
function renderTelasChecks(selected) {
  const holder = document.getElementById("usuTelasChecks");
  if (!holder) return;
  const sel = new Set(selected || []);
  const grupos = {};
  for (const tela of telasRegistry) {
    const grupo = tela.telagrupo || "Telas";
    if (!grupos[grupo]) grupos[grupo] = [];
    grupos[grupo].push(tela);
  }

  holder.innerHTML = Object.keys(grupos)
    .map((grupo) => {
      const checks = grupos[grupo]
        .map(
          (tela) => `
        <div class="form-check">
          <input class="form-check-input tela-check" type="checkbox"
            value="${escapeHtml(tela.telachave)}" id="tela_${escapeHtml(
              tela.telachave
            )}" ${sel.has(tela.telachave) ? "checked" : ""}>
          <label class="form-check-label" for="tela_${escapeHtml(
            tela.telachave
          )}"><i class="bi ${escapeHtml(
            tela.telaicone || "bi-window"
          )}"></i> ${escapeHtml(tela.telanome)}</label>
        </div>`
        )
        .join("");
      return `<div class="usu-telas-group"><div class="usu-telas-group__title">${escapeHtml(
        grupo
      )}</div>${checks}</div>`;
    })
    .join("");
}

function getSelectedTelas() {
  return Array.from(
    document.querySelectorAll("#usuTelasChecks .tela-check:checked")
  ).map((input) => input.value);
}

// Elementos
const tbody = document.getElementById("usersTbody");
const usersMobileList = document.getElementById("usersMobileList");
const searchInput = document.getElementById("searchInput");
const resultsInfo = document.getElementById("resultsInfo");
const emptyState = document.getElementById("emptyState");

const userModalEl = document.getElementById("userModal");
const userModal = new bootstrap.Modal(userModalEl);
const userForm = document.getElementById("userForm");
const usuId = document.getElementById("usuId");
const usuNome = document.getElementById("usuNome");
const usuEmail = document.getElementById("usuEmail");
const usuSenha = document.getElementById("usuSenha");
const usuAdm = document.getElementById("usuAdm");
const usuSta = document.getElementById("usuSta");
const usuRca = document.getElementById("usuRca");
const togglePwd = document.getElementById("togglePwd");
const btnDelete = document.getElementById("btnDelete");
const btnNew = document.getElementById("btnNew");
const btnRefresh = document.getElementById("btnRefresh");

// Badges para a listagem mobile (design system)
function admBadge(usuadm) {
  return usuadm === "S"
    ? '<span class="ou-badge ou-badge--info"><span class="ou-badge__dot"></span>Sim</span>'
    : '<span class="ou-badge ou-badge--neutral"><span class="ou-badge__dot"></span>Não</span>';
}

function statusBadge(ususta) {
  if (ususta === "A") {
    return '<span class="ou-badge ou-badge--success"><span class="ou-badge__dot"></span>Ativo</span>';
  }
  if (ususta === "I") {
    return '<span class="ou-badge ou-badge--warning"><span class="ou-badge__dot"></span>Inativo</span>';
  }
  return '<span class="ou-badge ou-badge--danger"><span class="ou-badge__dot"></span>Excluído</span>';
}

function iniciais(nome, email) {
  const base = String(nome || "").trim() || String(email || "").trim();
  const partes = base.split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  const a = partes[0][0] || "";
  const b = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (a + b).toUpperCase() || "?";
}

// Render da tabela (desktop) e dos cards (mobile)
function renderTable(list) {
  tbody.innerHTML = "";
  usersMobileList.innerHTML = "";
  if (!list.length) {
    emptyState.style.display = "block";
  } else {
    emptyState.style.display = "none";
    for (const u of list) {
      const nome = (u.usunome || "").trim();
      const email = u.usuemail || "";

      const tr = document.createElement("tr");
      tr.dataset.usucod = u.usucod;
      tr.innerHTML = `
            
            <!--<td>${escapeHtml(u.usunome)}</td>-->
            <td>${u.usucod}</td>
            <td>${escapeHtml(email)}</td>
            <td>${
              u.usuadm === "S"
                ? '<span class="badge bg-success">Sim</span>'
                : '<span class="badge bg-secondary">Não</span>'
            }</td>
            <td>${
              u.ususta === "A"
                ? '<span class="badge bg-success">Ativo</span>'
                : u.ususta === "I"
                ? '<span class="badge bg-warning text-dark">Inativo</span>'
                : '<span class="badge bg-danger">Excluído</span>'
            }</td>
          `;
      tr.addEventListener("click", () => openUserModal(u.usucod));
      tbody.appendChild(tr);

      const card = document.createElement("div");
      card.className = "ou-mobile-card";
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `Abrir usuário ${nome || email}`);
      card.innerHTML = `
        <div class="ou-mobile-card__head">
          <span class="ou-mobile-card__avatar" aria-hidden="true">${escapeHtml(iniciais(nome, email))}</span>
          <span class="ou-mobile-card__identity">
            <span class="ou-mobile-card__name">${escapeHtml(nome || email)}</span>
            ${nome ? `<span class="ou-mobile-card__fantasia">${escapeHtml(email)}</span>` : ""}
          </span>
        </div>
        <div class="ou-mobile-card__info">
          <div class="ou-mobile-card__block">
            <span class="ou-mobile-card__label">Código</span>
            <span class="ou-mobile-card__value">#${u.usucod}</span>
          </div>
          <div class="ou-mobile-card__block">
            <span class="ou-mobile-card__label">Administrador</span>
            <span class="ou-mobile-card__value">${admBadge(u.usuadm)}</span>
          </div>
          <div class="ou-mobile-card__block ou-mobile-card__block--full">
            <span class="ou-mobile-card__label">E-mail</span>
            <span class="ou-mobile-card__value ou-mobile-card__value--wrap">${escapeHtml(email)}</span>
          </div>
        </div>
        <div class="ou-mobile-card__foot">
          ${statusBadge(u.ususta)}
          <i class="fa-solid fa-chevron-right ou-mobile-card__chevron" aria-hidden="true"></i>
        </div>
      `;
      const abrir = () => openUserModal(u.usucod);
      card.addEventListener("click", abrir);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          abrir();
        }
      });
      usersMobileList.appendChild(card);
    }
  }
  resultsInfo.textContent = `${list.length} usuário(s)`;
}

// Busca simples (nome, email, id)
function doSearch(term) {
  const q = term.trim().toLowerCase();
  if (!q) {
    filtered = [...users];
  } else {
    filtered = users.filter(
      (u) =>
        String(u.usucod).includes(q) ||
        u.usunome.toLowerCase().includes(q) ||
        u.usuemail.toLowerCase().includes(q)
    );
  }
  renderTable(filtered);
}

// Abrir modal preenchido
function openUserModal(usucod) {
  const u = users.find((x) => x.usucod == usucod);
  if (!u) return;
  //console.log(u.usuemail.length);
  if (u.usuemail.length >= 3) {
    usuId.value = u.usucod;
    usuNome.value = u.usunome;
    usuEmail.value = u.usuemail;
    usuEmail.disabled = true;
    usuSenha.value = "";
    usuSenha.type = "password";
    usuAdm.checked = u.usuadm === "S";
    usuSta.checked = u.ususta === "A" ? true : u.ususta === "I" ? false : false;
    usuRca.checked = u.usurca === "S";
    renderTelasChecks(u.telas || []);
    userModal.show();
  }
}

// salvar registro na api
userForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const id = usuId.value;
  const email = usuEmail.value.trim();
  const payload = {
    usunome: usuNome.value.trim(),
    usuemail: usuEmail.value.trim(),
    ususenha: usuSenha.value,
    usuadm: usuAdm.checked ? "S" : "N",
    ususta: usuSta.checked ? "A" : "I",
    usurca: usuRca.checked ? "S" : "N",
    telas: getSelectedTelas(),
  };

  try {
    // Define URL based on whether we're creating or updating
    const url = id
      ? `${BASE_URL}/usuario/atualizar/${email}`
      : `${BASE_URL}/usuario/novo/`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // tenta extrair mensagem da API se houver
      let msg = `Erro ao salvar usuário (HTTP ${response.status})`;
      try {
        const errObj = await response.json();
        if (errObj && errObj.mensagem) msg = errObj.mensagem;
      } catch (e) {
        /**/
      }
      throw new Error(msg);
    }

    // Se a API retornar o objeto criado/atualizado, ok; mas para garantir consistência,
    // recarregamos a lista inteira da API (mantendo o termo de busca atual).
    await refreshUsers({ keepSearch: true });
    userModal.hide();
  } catch (error) {
    console.error("Failed to save user to API:", error);
    alert(error.message || "Erro ao salvar usuário. Veja console.");
  }
});

// Excluir usuário via API
btnDelete.addEventListener("click", async () => {
  const id = usuId.value;
  if (!id) return;
  if (!confirm("Deseja realmente excluir este usuário?")) return;

  try {
    const response = await fetch(`${BASE_URL}/usuario/excluir/${id}`, {
      method: "POST",
    });
    if (!response.ok) {
      let msg = `Erro ao excluir usuário (HTTP ${response.status})`;
      try {
        const errObj = await response.json();
        if (errObj && errObj.mensagem) msg = errObj.mensagem;
      } catch (e) {
        /**/
      }
      throw new Error(msg);
    }

    // Recarrega lista da API para garantir consistência
    await refreshUsers({ keepSearch: true });
    userModal.hide();
  } catch (error) {
    console.error("Failed to delete user:", error);
    alert(error.message || "Erro ao excluir usuário");
  }
});

// Novo usuário
btnNew.addEventListener("click", () => {
  usuEmail.disabled = false;
  usuId.value = "";
  usuNome.value = "";
  usuEmail.value = "";
  usuSenha.value = "";
  usuSenha.type = "password";
  usuAdm.checked = false;
  usuSta.checked = true;
  usuRca.checked = false;
  renderTelasChecks([]);
  userModal.show();
});

// Toggle mostrar senha
togglePwd.addEventListener("click", () => {
  usuSenha.type = usuSenha.type === "password" ? "text" : "password";
  togglePwd.innerHTML =
    usuSenha.type === "password"
      ? '<i class="fa-solid fa-eye"></i>'
      : '<i class="fa-solid fa-eye-slash"></i>';
});

// Escape para evitar XSS em campos renderizados
function escapeHtml(txt = "") {
  return txt
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Eventos de busca com debounce simples
let searchTimer = null;
searchInput.addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => doSearch(e.target.value), 180);
});

// inicializa
doSearch("");
