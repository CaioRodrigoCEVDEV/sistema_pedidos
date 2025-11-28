/**
 * Part Groups Admin Panel JavaScript
 * Manages compatibility groups for shared inventory
 */

let currentGroupId = null;
let allGroups = [];
let availableParts = [];

// Toast helper (leve, sem dependências)
function showToast(message, type = "success") {
  let container = document.getElementById("app-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "app-toast-container";
    Object.assign(container.style, {
      position: "fixed",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      zIndex: "2147483647",
      pointerEvents: "none",
    });
    document.body.appendChild(container);
  }

  // Garante posição no topo-direito
  container.style.top = "16px";
  container.style.right = "16px";
  container.style.bottom = "";
  container.style.left = "";

  const toast = document.createElement("div");
  const bg =
    type === "success" ? "#198754" : type === "error" ? "#dc3545" : "#0d6efd";
  Object.assign(toast.style, {
    background: bg,
    color: "white",
    padding: "10px 14px",
    borderRadius: "8px",
    boxShadow: "0 6px 20px rgba(0,0,0,.15)",
    fontSize: "14px",
    pointerEvents: "auto",
    opacity: "0",
    transform: "translateY(-6px)",
    transition: "opacity .2s ease, transform .2s ease",
  });
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

// Format date for display
function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Load all groups
async function carregarGrupos() {
  const tbody = document.getElementById("tabela-grupos");
  tbody.innerHTML =
    '<tr><td colspan="5" class="text-center">Carregando...</td></tr>';

  try {
    const res = await fetch(`${BASE_URL}/part-groups`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Erro ao buscar grupos");

    allGroups = await res.json();
    renderGrupos(allGroups);
  } catch (err) {
    console.error(err);
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center text-danger">Erro ao carregar grupos</td></tr>';
  }
}

// Render groups table
function renderGrupos(grupos) {
  const tbody = document.getElementById("tabela-grupos");
  tbody.innerHTML = "";

  if (!grupos || grupos.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center text-muted">Nenhum grupo cadastrado</td></tr>';
    return;
  }

  grupos.forEach((grupo) => {
    const tr = document.createElement("tr");
    tr.className = "align-middle";
    tr.style.cursor = "pointer";
    tr.addEventListener("click", (e) => {
      // Don't trigger if clicking on buttons
      if (e.target.closest("button")) return;
      abrirDetalhes(grupo.id);
    });

    const stockClass =
      grupo.stock_quantity === 0
        ? "badge rounded-pill bg-danger-subtle text-danger"
        : grupo.stock_quantity < 10
        ? "badge rounded-pill bg-warning-subtle text-warning"
        : "badge rounded-pill bg-success-subtle text-success";

    tr.innerHTML = `
      <td>
        <div class="d-flex align-items-center gap-2">
          <i class="bi bi-diagram-3 text-primary"></i>
          <span class="fw-semibold">${escapeHtml(grupo.name)}</span>
        </div>
      </td>
      <td class="text-center">
        <span class="badge rounded-pill bg-secondary-subtle text-secondary">${
          grupo.parts_count || 0
        }</span>
      </td>
      <td class="text-center">
        <span class="${stockClass} fw-semibold px-3">${
      grupo.stock_quantity
    }</span>
      </td>
      <td class="text-center text-muted small">${formatDate(
        grupo.updated_at
      )}</td>
      <td class="text-center">
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-primary btn-edit-group" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-outline-danger btn-delete-group" title="Excluir">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;

    // Add event listeners instead of inline onclick (XSS prevention)
    tr.querySelector(".btn-edit-group").addEventListener("click", () => {
      abrirModalEditar(grupo.id, grupo.name);
    });
    tr.querySelector(".btn-delete-group").addEventListener("click", () => {
      excluirGrupo(grupo.id);
    });

    tbody.appendChild(tr);
  });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Create new group
async function criarGrupo() {
  const nome = document.getElementById("nomeGrupo").value.trim();
  const estoque =
    parseInt(document.getElementById("estoqueInicial").value, 10) || 0;

  if (!nome) {
    showToast("Nome do grupo é obrigatório", "error");
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/part-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: nome, stock_quantity: estoque }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao criar grupo");
    }

    showToast("Grupo criado com sucesso!", "success");
    bootstrap.Modal.getInstance(
      document.getElementById("modalCriarGrupo")
    ).hide();
    document.getElementById("formCriarGrupo").reset();
    carregarGrupos();
  } catch (err) {
    console.error(err);
    showToast(err.message, "error");
  }
}

// Open edit modal
function abrirModalEditar(id, nome) {
  document.getElementById("editarGrupoId").value = id;
  document.getElementById("editarNomeGrupo").value = nome;
  new bootstrap.Modal(document.getElementById("modalEditarGrupo")).show();
}

// Save group edit
async function salvarEdicaoGrupo() {
  const id = document.getElementById("editarGrupoId").value;
  const nome = document.getElementById("editarNomeGrupo").value.trim();

  if (!nome) {
    showToast("Nome do grupo é obrigatório", "error");
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/part-groups/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: nome }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao atualizar grupo");
    }

    showToast("Grupo atualizado com sucesso!", "success");
    bootstrap.Modal.getInstance(
      document.getElementById("modalEditarGrupo")
    ).hide();
    carregarGrupos();

    // Update details view if open
    if (currentGroupId === id) {
      document.getElementById("nomeGrupoDetalhe").textContent = nome;
    }
  } catch (err) {
    console.error(err);
    showToast(err.message, "error");
  }
}

// Delete group
async function excluirGrupo(id) {
  if (
    !confirm(
      "Tem certeza que deseja excluir este grupo? As peças serão desvinculadas."
    )
  ) {
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/part-groups/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao excluir grupo");
    }

    showToast("Grupo excluído com sucesso!", "success");
    carregarGrupos();

    if (currentGroupId === id) {
      fecharDetalhes();
    }
  } catch (err) {
    console.error(err);
    showToast(err.message, "error");
  }
}

// Open group details
async function abrirDetalhes(id) {
  currentGroupId = id;
  document.getElementById("detalhesGrupo").style.display = "block";

  try {
    const res = await fetch(`${BASE_URL}/part-groups/${id}`, {
      credentials: "include",
    });

    if (!res.ok) throw new Error("Erro ao buscar detalhes do grupo");

    const grupo = await res.json();

    document.getElementById("nomeGrupoDetalhe").textContent = grupo.name;
    document.getElementById("estoqueGrupoDetalhe").textContent =
      grupo.stock_quantity;

    // Render parts
    renderPecasGrupo(grupo.parts || []);

    // Load audit history
    carregarHistorico(id);
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar detalhes do grupo", "error");
  }
}

// Render group parts table
function renderPecasGrupo(pecas) {
  const tbody = document.getElementById("tabela-pecas-grupo");
  tbody.innerHTML = "";

  if (!pecas || pecas.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center text-muted">Nenhuma peça no grupo</td></tr>';
    return;
  }

  pecas.forEach((peca) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${peca.procod}</td>
      <td>${escapeHtml(peca.prodes || "-")}</td>
      <td>R$ ${Number(peca.provl || 0).toFixed(2)}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-danger btn-remove-part" title="Remover do grupo">
          <i class="bi bi-x-lg"></i>
        </button>
      </td>
    `;
    // Add event listener instead of inline onclick (XSS prevention)
    tr.querySelector(".btn-remove-part").addEventListener("click", () => {
      removerPecaGrupo(peca.procod);
    });
    tbody.appendChild(tr);
  });
}

// Load audit history
async function carregarHistorico(groupId) {
  const tbody = document.getElementById("tabela-historico");
  tbody.innerHTML =
    '<tr><td colspan="4" class="text-center">Carregando...</td></tr>';

  try {
    const res = await fetch(`${BASE_URL}/part-groups/${groupId}/audit`, {
      credentials: "include",
    });

    if (!res.ok) throw new Error("Erro ao buscar histórico");

    const historico = await res.json();
    renderHistorico(historico);
  } catch (err) {
    console.error(err);
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center text-muted">Erro ao carregar histórico</td></tr>';
  }
}

// Render audit history
function renderHistorico(historico) {
  const tbody = document.getElementById("tabela-historico");
  tbody.innerHTML = "";

  if (!historico || historico.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center text-muted">Sem histórico</td></tr>';
    return;
  }

  historico.forEach((item) => {
    const tr = document.createElement("tr");
    const changeClass = item.change > 0 ? "text-success" : "text-danger";
    const changePrefix = item.change > 0 ? "+" : "";

    tr.innerHTML = `
      <td class="text-muted small">${formatDate(item.created_at)}</td>
      <td><span class="${changeClass} fw-semibold">${changePrefix}${
      item.change
    }</span></td>
      <td>${escapeHtml(item.reason || "-")}</td>
      <td>${escapeHtml(item.part_name || item.reference_id || "-")}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Close details view
function fecharDetalhes() {
  currentGroupId = null;
  document.getElementById("detalhesGrupo").style.display = "none";
}

// Open stock edit modal
function abrirModalEditarEstoque() {
  if (!currentGroupId) return;

  const currentStock = document.getElementById(
    "estoqueGrupoDetalhe"
  ).textContent;
  document.getElementById("novoEstoque").value = currentStock;
  document.getElementById("motivoEstoque").value = "manual_adjustment";

  new bootstrap.Modal(document.getElementById("modalEditarEstoque")).show();
}

// Save stock
async function salvarEstoque() {
  if (!currentGroupId) return;

  const quantidade = parseInt(document.getElementById("novoEstoque").value, 10);
  const motivo = document.getElementById("motivoEstoque").value;

  if (isNaN(quantidade) || quantidade < 0) {
    showToast("Quantidade inválida", "error");
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/part-groups/${currentGroupId}/stock`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ stock_quantity: quantidade, reason: motivo }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao atualizar estoque");
    }

    showToast("Estoque atualizado com sucesso!", "success");
    bootstrap.Modal.getInstance(
      document.getElementById("modalEditarEstoque")
    ).hide();

    // Refresh details
    abrirDetalhes(currentGroupId);
    carregarGrupos();
  } catch (err) {
    console.error(err);
    showToast(err.message, "error");
  }
}

// Open modal to add part to group
async function abrirModalAdicionarPeca() {
  if (!currentGroupId) return;

  const tbody = document.getElementById("tabela-pecas-disponiveis");
  tbody.innerHTML =
    '<tr><td colspan="5" class="text-center">Carregando...</td></tr>';

  new bootstrap.Modal(document.getElementById("modalAdicionarPeca")).show();

  try {
    const res = await fetch(`${BASE_URL}/part-groups/available-part`, {
      credentials: "include",
    });

    if (!res.ok) throw new Error("Erro ao buscar peças disponíveis");

    availableParts = await res.json();
    renderPecasDisponiveis(availableParts);
  } catch (err) {
    console.error(err);
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center text-danger">Erro ao carregar peças</td></tr>';
  }
}

// Render available parts
function renderPecasDisponiveis(pecas) {
  const tbody = document.getElementById("tabela-pecas-disponiveis");
  tbody.innerHTML = "";

  if (!pecas || pecas.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center text-muted">Nenhuma peça disponível</td></tr>';
    return;
  }

  pecas.forEach((peca) => {
    const tr = document.createElement("tr");
    const isInGroup = peca.part_group_id === currentGroupId;

    tr.innerHTML = `
      <td>${peca.procod}</td>
      <td>${escapeHtml(peca.prodes || "-")}</td>
      <td>${escapeHtml(peca.marcasdes || "-")}</td>
      <td>${escapeHtml(peca.tipodes || "-")}</td>
      <td class="text-center">
        ${
          isInGroup
            ? '<span class="badge bg-success">No grupo</span>'
            : `<button class="btn btn-sm btn-primary btn-add-part">
              <i class="bi bi-plus"></i> Adicionar
            </button>`
        }
      </td>
    `;
    // Add event listener instead of inline onclick (XSS prevention)
    if (!isInGroup) {
      tr.querySelector(".btn-add-part").addEventListener("click", () => {
        adicionarPecaAoGrupo(peca.procod);
      });
    }
    tbody.appendChild(tr);
  });
}

// Add part to group
async function adicionarPecaAoGrupo(partId) {
  if (!currentGroupId) return;

  try {
    const res = await fetch(`${BASE_URL}/part-groups/${currentGroupId}/parts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ partId }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao adicionar peça");
    }

    showToast("Peça adicionada ao grupo!", "success");

    // Refresh available parts list
    abrirModalAdicionarPeca();

    // Refresh group details
    abrirDetalhes(currentGroupId);
  } catch (err) {
    console.error(err);
    showToast(err.message, "error");
  }
}

// Remove part from group
async function removerPecaGrupo(partId) {
  if (!confirm("Tem certeza que deseja remover esta peça do grupo?")) {
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/part-groups/parts/${partId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao remover peça");
    }

    showToast("Peça removida do grupo!", "success");

    // Refresh group details
    abrirDetalhes(currentGroupId);
    carregarGrupos();
  } catch (err) {
    console.error(err);
    showToast(err.message, "error");
  }
}

// Search filter for available parts
document.addEventListener("DOMContentLoaded", function () {
  const searchInput = document.getElementById("pesquisaPeca");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      const query = this.value.toLowerCase().trim();
      const filtered = availableParts.filter((p) => {
        const text = `${p.procod} ${p.prodes || ""} ${p.marcasdes || ""} ${
          p.tipodes || ""
        }`.toLowerCase();
        return text.includes(query);
      });
      renderPecasDisponiveis(filtered);
    });
  }
});

// Initialize on page load
(function () {
  carregarGrupos();
})();
