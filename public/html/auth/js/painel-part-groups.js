/**
 * JavaScript do Painel de Grupos de Compatibilidade
 *
 * Gerencia a interface administrativa dos grupos de compatibilidade.
 * Os grupos permitem que múltiplas peças compartilhem o mesmo estoque.
 *
 * IMPORTANTE: O ID dos grupos é INTEGER simples, não criptografado.
 */

let currentGroupId = null;
let currentGroupData = null; // Store current group data including cost
let allGroups = [];
let availableParts = [];
let currentPage = 1;
let totalPages = 1;
let isLoadingMore = false;
let searchTerm = "";
let searchDebounceTimer = null;

// Referência do modal de adicionar peça (para controle de backdrop)
let modalAdicionarPecaInstance = null;

/**
 * Função auxiliar para exibir notificações toast
 * Exibe uma mensagem temporária no canto superior direito da tela
 * @param {string} message - Mensagem a ser exibida
 * @param {string} type - Tipo da mensagem ('success', 'error', 'info')
 */
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

/**
 * Formata data para exibição no padrão brasileiro
 * @param {string} dateString - Data em formato ISO
 * @returns {string} Data formatada (ex: 28/11/2025 17:30)
 */
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

/**
 * Carrega todos os grupos de compatibilidade do servidor
 */
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

/**
 * Renderiza a tabela de grupos
 * @param {Array} grupos - Lista de grupos a serem exibidos
 */
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

    // Adiciona event listeners (evita onclick inline para prevenir XSS)
    tr.querySelector(".btn-edit-group").addEventListener("click", () => {
      abrirModalEditar(grupo.id, grupo.name);
    });
    tr.querySelector(".btn-delete-group").addEventListener("click", () => {
      excluirGrupo(grupo.id);
    });

    tbody.appendChild(tr);
  });
}

/**
 * Escapa HTML para prevenir XSS
 * @param {string} text - Texto a ser escapado
 * @returns {string} Texto escapado
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Cria um novo grupo de compatibilidade
 * Grupos são sempre criados com estoque inicial de 0
 */
async function criarGrupo() {
  const nome = document.getElementById("nomeGrupo").value.trim();

  if (!nome) {
    showToast("Nome do grupo é obrigatório", "error");
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/part-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: nome }),
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

/**
 * Abre o modal de edição de grupo
 * @param {number} id - ID do grupo
 * @param {string} nome - Nome atual do grupo
 */
function abrirModalEditar(id, nome) {
  document.getElementById("editarGrupoId").value = id;
  document.getElementById("editarNomeGrupo").value = nome;
  new bootstrap.Modal(document.getElementById("modalEditarGrupo")).show();
}

/**
 * Salva as alterações do grupo editado
 */
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

    // Atualiza a visualização de detalhes se estiver aberta
    if (currentGroupId === id) {
      document.getElementById("nomeGrupoDetalhe").textContent = nome;
    }
  } catch (err) {
    console.error(err);
    showToast(err.message, "error");
  }
}

/**
 * Exclui um grupo de compatibilidade
 * @param {number} id - ID do grupo a ser excluído
 */
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

/**
 * Abre o painel de detalhes de um grupo específico
 * @param {number} id - ID do grupo
 */
async function abrirDetalhes(id) {
  currentGroupId = id;
  document.getElementById("detalhesGrupo").style.display = "block";

  try {
    const res = await fetch(`${BASE_URL}/part-groups/${id}`, {
      credentials: "include",
    });

    if (!res.ok) throw new Error("Erro ao buscar detalhes do grupo");

    const grupo = await res.json();
    currentGroupData = grupo; // Store group data for later use

    document.getElementById("nomeGrupoDetalhe").textContent = grupo.name;
    document.getElementById("estoqueGrupoDetalhe").textContent =
      grupo.stock_quantity || 0;

    // Renderiza as peças do grupo
    renderPecasGrupo(grupo.parts || []);

    // Carrega o histórico de movimentações
    carregarHistorico(id);
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar detalhes do grupo", "error");
  }
}

/**
 * Renderiza a tabela de peças do grupo
 * @param {Array} pecas - Lista de peças do grupo
 */
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
    // Adiciona event listener (evita onclick inline para prevenir XSS)
    tr.querySelector(".btn-remove-part").addEventListener("click", () => {
      removerPecaGrupo(peca.procod);
    });
    tbody.appendChild(tr);
  });
}

/**
 * Carrega o histórico de movimentações (auditoria) de um grupo
 * @param {number} groupId - ID do grupo
 */
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

/**
 * Renderiza a tabela de histórico de movimentações
 * @param {Array} historico - Lista de registros de auditoria
 */
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

/**
 * Fecha o painel de detalhes do grupo
 */
function fecharDetalhes() {
  currentGroupId = null;
  currentGroupData = null;
  document.getElementById("detalhesGrupo").style.display = "none";
}

/**
 * Abre o modal de edição de estoque do grupo
 */
function abrirModalEditarEstoque() {
  if (!currentGroupId) return;

  const currentStock = document.getElementById(
    "estoqueGrupoDetalhe"
  ).textContent;
  document.getElementById("novoEstoque").value = currentStock;
  
  // Set current cost if available
  const currentCost = currentGroupData?.grpcusto || "";
  document.getElementById("novoCusto").value = currentCost;
  
  document.getElementById("motivoEstoque").value = "manual_adjustment";

  new bootstrap.Modal(document.getElementById("modalEditarEstoque")).show();
}

/**
 * Salva o novo estoque do grupo
 */
async function salvarEstoque() {
  if (!currentGroupId) return;

  const quantidade = parseInt(document.getElementById("novoEstoque").value, 10);
  const motivo = document.getElementById("motivoEstoque").value;
  const custoValue = document.getElementById("novoCusto").value;

  if (isNaN(quantidade) || quantidade < 0) {
    showToast("Quantidade inválida", "error");
    return;
  }

  // Prepare request body
  const body = { 
    stock_quantity: quantidade, 
    reason: motivo 
  };
  
  // Add cost if provided
  if (custoValue !== "" && custoValue !== null && custoValue !== undefined) {
    const custo = parseFloat(custoValue);
    if (isNaN(custo) || custo < 0) {
      showToast("Custo inválido", "error");
      return;
    }
    body.cost = custo;
  }

  try {
    const res = await fetch(`${BASE_URL}/part-groups/${currentGroupId}/stock`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao atualizar estoque");
    }

    const result = await res.json();
    showToast(result.message || "Estoque atualizado com sucesso!", "success");
    bootstrap.Modal.getInstance(
      document.getElementById("modalEditarEstoque")
    ).hide();

    // Atualiza os detalhes do grupo
    abrirDetalhes(currentGroupId);
    carregarGrupos();
  } catch (err) {
    console.error(err);
    showToast(err.message, "error");
  }
}

/**
 * Função segura para fechar modal e limpar backdrop
 * Remove o backdrop (overlay cinza) e a classe modal-open do body
 * Corrige o problema onde a tela de fundo fica cinza após fechar o modal
 * @param {string} modalId - ID do elemento modal
 */
function fecharModalComSeguranca(modalId) {
  const modalElement = document.getElementById(modalId);
  if (!modalElement) return;

  // Tenta fechar usando a instância do Bootstrap
  const modalInstance = bootstrap.Modal.getInstance(modalElement);
  if (modalInstance) {
    modalInstance.hide();
  }

  // Limpa imediatamente qualquer backdrop residual
  limparBackdropResidual();

  // Aguarda a animação de fechamento e limpa novamente para garantir
  setTimeout(() => {
    limparBackdropResidual();
  }, 350);
}

/**
 * Remove todos os backdrops residuais e restaura o estado do body
 * Função utilitária para garantir que o overlay cinza seja removido
 */
function limparBackdropResidual() {
  // Remove todos os backdrops que possam ter ficado
  document.querySelectorAll(".modal-backdrop").forEach((el) => el.remove());
  // Remove a classe modal-open do body
  document.body.classList.remove("modal-open");
  // Remove o estilo inline de padding/overflow que o Bootstrap adiciona
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("padding-right");
}

/**
 * Carrega peças disponíveis com paginação
 * @param {number} page - Número da página a carregar
 * @param {boolean} append - Se true, adiciona à lista existente (para infinite scroll)
 */
async function carregarPecasDisponiveis(page = 1, append = false) {
  if (isLoadingMore) return;
  
  isLoadingMore = true;
  const tbody = document.getElementById("tabela-pecas-disponiveis");
  
  try {
    const url = new URL(`${BASE_URL}/part-groups/available-part`);
    url.searchParams.append("page", page);
    url.searchParams.append("limit", 20);
    if (searchTerm) {
      url.searchParams.append("search", searchTerm);
    }
    
    const res = await fetch(url, {
      credentials: "include",
    });

    if (!res.ok) throw new Error("Erro ao buscar peças disponíveis");

    const result = await res.json();
    
    if (append) {
      availableParts = [...availableParts, ...result.data];
    } else {
      availableParts = result.data;
    }
    
    currentPage = result.pagination.page;
    totalPages = result.pagination.totalPages;
    
    renderPecasDisponiveis(availableParts, append);
    
    // Add loading indicator if there are more pages
    if (result.pagination.hasMore) {
      addLoadingIndicator();
    }
  } catch (err) {
    console.error(err);
    if (!append) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar peças</td></tr>';
    }
  } finally {
    isLoadingMore = false;
  }
}

/**
 * Adiciona um indicador de carregamento no final da tabela
 */
function addLoadingIndicator() {
  const tbody = document.getElementById("tabela-pecas-disponiveis");
  const existingIndicator = document.getElementById("loading-indicator");
  if (existingIndicator) return;
  
  const tr = document.createElement("tr");
  tr.id = "loading-indicator";
  tr.innerHTML = `
    <td colspan="6" class="text-center text-muted py-2">
      <small>Role para carregar mais...</small>
    </td>
  `;
  tbody.appendChild(tr);
}

/**
 * Remove o indicador de carregamento
 */
function removeLoadingIndicator() {
  const indicator = document.getElementById("loading-indicator");
  if (indicator) indicator.remove();
}

/**
 * Configura o infinite scroll para a tabela de peças
 */
function setupInfiniteScroll() {
  const modalBody = document.querySelector("#modalAdicionarPeca .modal-body");
  const scrollContainer = modalBody.querySelector("div[style*='overflow-y']");
  
  if (!scrollContainer) return;
  
  // Remove listener anterior se existir
  scrollContainer.removeEventListener("scroll", handleScroll);
  scrollContainer.addEventListener("scroll", handleScroll);
}

/**
 * Handler do evento de scroll para infinite scroll
 */
async function handleScroll(e) {
  const container = e.target;
  const scrollPosition = container.scrollTop + container.clientHeight;
  const scrollHeight = container.scrollHeight;
  
  // Se chegou perto do final (80%) e há mais páginas
  if (scrollPosition >= scrollHeight * 0.8 && currentPage < totalPages && !isLoadingMore) {
    removeLoadingIndicator();
    await carregarPecasDisponiveis(currentPage + 1, true);
  }
}

/**
 * Filtra peças disponíveis com base no termo de busca (com debouncing)
 */
function filtrarPecas() {
  // Limpa o timer anterior
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  
  // Configura novo timer de 400ms
  searchDebounceTimer = setTimeout(async () => {
    const input = document.getElementById("pesquisaPeca");
    searchTerm = input.value.trim();
    currentPage = 1;
    availableParts = [];
    await carregarPecasDisponiveis(1, false);
  }, 400);
}

/**
 * Configura event listeners para o modal de adicionar peça
 */
function setupModalEventListeners() {
  const searchInput = document.getElementById("pesquisaPeca");
  if (searchInput) {
    // Remove listener anterior se existir
    searchInput.removeEventListener("keyup", filtrarPecas);
    searchInput.addEventListener("keyup", filtrarPecas);
  }
}

/**
 * Abre o modal de adicionar peça ao grupo
 * Reutiliza a instância do modal para evitar múltiplos backdrops (overlay cinza)
 * Implementa paginação e infinite scroll
 */
async function abrirModalAdicionarPeca() {
  if (!currentGroupId) return;

  const tbody = document.getElementById("tabela-pecas-disponiveis");
  tbody.innerHTML =
    '<tr><td colspan="6" class="text-center">Carregando...</td></tr>';

  // Reset pagination state
  currentPage = 1;
  availableParts = [];
  searchTerm = "";

  // Limpa qualquer backdrop residual antes de abrir o modal
  limparBackdropResidual();

  // Reutiliza a instância do modal ou cria uma nova
  const modalElement = document.getElementById("modalAdicionarPeca");
  if (!modalAdicionarPecaInstance) {
    modalAdicionarPecaInstance = new bootstrap.Modal(modalElement);
  }
  modalAdicionarPecaInstance.show();

  // Carrega primeira página
  await carregarPecasDisponiveis(1);
  
  // Setup event listeners and infinite scroll
  setupModalEventListeners();
  setupInfiniteScroll();
}

/**
 * Renderiza a tabela de peças disponíveis para adicionar ao grupo
 * @param {Array} pecas - Lista de peças disponíveis
 * @param {boolean} append - Se true, apenas adiciona novas linhas (para infinite scroll)
 */
function renderPecasDisponiveis(pecas, append = false) {
  const tbody = document.getElementById("tabela-pecas-disponiveis");
  
  if (!append) {
    tbody.innerHTML = "";
  } else {
    // Remove loading indicator se existir
    removeLoadingIndicator();
  }

  if (!pecas || pecas.length === 0) {
    if (!append) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted">Nenhuma peça disponível</td></tr>';
    }
    return;
  }

  pecas.forEach((peca) => {
    // Se estamos fazendo append, só adiciona peças novas
    if (append && document.querySelector(`tr[data-peca-id="${peca.procod}"]`)) {
      return;
    }
    
    const tr = document.createElement("tr");
    tr.setAttribute("data-peca-id", peca.procod);
    const isInGroup = peca.part_group_id === currentGroupId;
    const hasColors = peca.has_colors && peca.colors && peca.colors.length > 0;

    tr.innerHTML = `
      <td>${peca.procod}</td>
      <td>${escapeHtml(peca.prodes || "-")}</td>
      <td>${escapeHtml(peca.marcasdes || "-")}</td>
      <td>${escapeHtml(peca.tipodes || "-")}</td>
      <td class="text-center">
        ${hasColors ? '<i class="bi bi-palette-fill text-info" title="Produto com cores"></i>' : ''}
      </td>
      <td class="text-center">
        ${
          isInGroup
            ? '<span class="badge bg-success">No grupo</span>'
            : `<button class="btn btn-sm btn-primary btn-add-part" data-part-id="${peca.procod}" data-has-colors="${hasColors}">
              <i class="bi bi-plus"></i> Adicionar
            </button>`
        }
      </td>
    `;
    
    // Adiciona event listener (evita onclick inline para prevenir XSS)
    if (!isInGroup) {
      const button = tr.querySelector(".btn-add-part");
      button.addEventListener("click", () => {
        if (hasColors) {
          mostrarModalSelecaoCor(peca);
        } else {
          adicionarPecaAoGrupo(peca.procod, null);
        }
      });
    }
    tbody.appendChild(tr);
  });
}

/**
 * Mostra modal para seleção de cor do produto
 * @param {Object} peca - Objeto da peça com informações de cores
 */
function mostrarModalSelecaoCor(peca) {
  const colors = peca.colors || [];
  
  if (colors.length === 0) {
    // Se não há cores, adiciona direto
    adicionarPecaAoGrupo(peca.procod, null);
    return;
  }
  
  // Cria o HTML do modal de seleção de cor
  const modalHtml = `
    <div class="modal fade" id="modalSelecaoCor" tabindex="-1" aria-labelledby="modalSelecaoCorLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="modalSelecaoCorLabel">Selecionar Cor</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p><strong>${escapeHtml(peca.prodes || "Produto")}</strong></p>
            <p class="text-muted small">Selecione a cor para adicionar ao grupo:</p>
            <div class="mb-3">
              <label for="selectCor" class="form-label">Cor:</label>
              <select class="form-select" id="selectCor" required>
                <option value="">Selecione uma cor...</option>
                ${colors.map(cor => `
                  <option value="${cor.corcod}">
                    ${escapeHtml(cor.cornome)} ${cor.procorqtde ? `(Qtd: ${cor.procorqtde})` : ''}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="alert alert-info small" role="alert">
              <i class="bi bi-info-circle"></i>
              A quantidade será controlada pelo grupo. O grupo dita a quantidade disponível para todas as peças.
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" id="btnConfirmarCor">Adicionar</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Remove modal anterior se existir
  const oldModal = document.getElementById("modalSelecaoCor");
  if (oldModal) oldModal.remove();
  
  // Adiciona modal ao DOM
  document.body.insertAdjacentHTML("beforeend", modalHtml);
  
  const modalElement = document.getElementById("modalSelecaoCor");
  const modal = new bootstrap.Modal(modalElement);
  
  // Evento de confirmar
  document.getElementById("btnConfirmarCor").addEventListener("click", async () => {
    const selectCor = document.getElementById("selectCor");
    const colorId = selectCor.value;
    
    if (!colorId) {
      showToast("Por favor, selecione uma cor", "error");
      return;
    }
    
    modal.hide();
    await adicionarPecaAoGrupo(peca.procod, colorId);
    
    // Remove modal do DOM após fechar
    modalElement.addEventListener("hidden.bs.modal", () => {
      modalElement.remove();
    });
  });
  
  modal.show();
}

/**
 * Adiciona uma peça ao grupo atual
 * Atualiza a lista de peças sem fechar o modal para evitar problemas de backdrop
 * @param {number} partId - ID da peça (procod)
 * @param {number|null} colorId - ID da cor selecionada (opcional)
 */
async function adicionarPecaAoGrupo(partId, colorId = null) {
  if (!currentGroupId) return;

  try {
    const body = { partId };
    if (colorId) {
      body.colorId = colorId;
    }
    
    const res = await fetch(`${BASE_URL}/part-groups/${currentGroupId}/parts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao adicionar peça");
    }

    showToast("Peça adicionada ao grupo!", "success");

    // Atualiza apenas a lista de peças disponíveis (mantém o modal aberto)
    await atualizarListaPecasDisponiveis();

    // Atualiza os detalhes do grupo em segundo plano
    abrirDetalhes(currentGroupId);
  } catch (err) {
    console.error(err);
    showToast(err.message, "error");
  }
}

/**
 * Atualiza a lista de peças disponíveis sem reabrir o modal
 * Previne o problema de múltiplos backdrops (overlay cinza)
 * Recarrega a primeira página mantendo o termo de busca
 */
async function atualizarListaPecasDisponiveis() {
  currentPage = 1;
  availableParts = [];
  await carregarPecasDisponiveis(1, false);
}

/**
 * Remove uma peça do grupo atual
 * @param {number} partId - ID da peça (procod)
 */
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

    // Atualiza os detalhes do grupo
    abrirDetalhes(currentGroupId);
    carregarGrupos();
  } catch (err) {
    console.error(err);
    showToast(err.message, "error");
  }
}

/**
 * Filtro de pesquisa para peças disponíveis
 * Adiciona evento de input para filtrar a lista em tempo real
 */
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

  // Listener para limpar backdrop quando o modal de adicionar peça é fechado
  // Corrige o problema do overlay cinza que permanece após fechar o modal
  const modalAdicionarPeca = document.getElementById("modalAdicionarPeca");
  if (modalAdicionarPeca) {
    // Evento disparado quando o modal termina de ser escondido
    modalAdicionarPeca.addEventListener("hidden.bs.modal", function () {
      limparBackdropResidual();
    });

    // Evento disparado quando o modal está sendo escondido (backup)
    modalAdicionarPeca.addEventListener("hide.bs.modal", function () {
      // Agenda limpeza para após a animação
      setTimeout(limparBackdropResidual, 350);
    });
  }

  // Adiciona listeners para todos os outros modais também
  // Usa atributo data para evitar adicionar listeners duplicados
  const todosModais = document.querySelectorAll(".modal");
  todosModais.forEach((modal) => {
    if (!modal.hasAttribute("data-backdrop-cleanup")) {
      modal.setAttribute("data-backdrop-cleanup", "true");
      modal.addEventListener("hidden.bs.modal", function () {
        limparBackdropResidual();
      });
    }
  });
});

// Inicialização: carrega os grupos ao carregar a página
(function () {
  carregarGrupos();
})();
