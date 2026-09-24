/**
 * Controle de Estoque por Grupo de Compatibilidade
 *
 * Esta tela utiliza a mesma lógica de dados do relatório Top Peças para
 * identificar os grupos de compatibilidade com maior volume de vendas e
 * permitir ajuste rápido de estoque e configuração de quantidade ideal.
 */

var currentData = [];
var currentFilters = {
  dataInicio: "",
  dataFim: "",
  marca: "",
};

// Ordenação atual da listagem (client-side, não altera a ordem no banco).
// A coluna "Grupo" inicia selecionada em ordem alfabética crescente.
var sortCol = "grupo";
var sortDir = "asc"; // 'asc' | 'desc'

// Peso de cada status para permitir ordenação estável sem alterar a regra.
var STATUS_RANK = {
  "Abaixo do ideal": 0,
  Adequado: 1,
  "Sem ideal": 2,
};

var buscaDebounceTimer = null;

// Elementos DOM
var buscaGrupoInput = document.getElementById("buscaGrupo");
var dataInicioInput = document.getElementById("dataInicio");
var dataFimInput = document.getElementById("dataFim");
var marcaSelect = document.getElementById("marcaSelect");
var btnFiltrar = document.getElementById("btnFiltrar");
var btnLimpar = document.getElementById("btnLimpar");
var gruposTableBody = document.getElementById("gruposTableBody");
var gruposMobileList = document.getElementById("gruposMobileList");
var emptyState = document.getElementById("emptyState");
var loadingState = document.getElementById("loadingState");
var resultsInfo = document.getElementById("resultsInfo");

// Carrega marcas para o select
async function loadMarcas() {
  try {
    const response = await fetch("/marcas", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Erro ao carregar marcas");
    const marcas = await response.json();

    marcaSelect.innerHTML = '<option value="">Todas</option>';
    marcas.forEach((marca) => {
      const option = document.createElement("option");
      option.value = marca.marcascod;
      option.textContent = marca.marcasdes;
      marcaSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar marcas:", error);
  }
}

/**
 * Determina o status do estoque de um grupo comparado à quantidade ideal
 * @param {number} estoqueAtual - Estoque atual do grupo
 * @param {number|null} qtdeIdeal - Quantidade ideal configurada
 * @returns {{ label: string, badgeClass: string }}
 */
function calcularStatus(estoqueAtual, qtdeIdeal) {
  if (qtdeIdeal === null || qtdeIdeal === undefined) {
    return { label: "Sem ideal", badgeClass: "badge-sem-ideal" };
  }
  if (Number(estoqueAtual) >= Number(qtdeIdeal)) {
    return { label: "Adequado", badgeClass: "badge-adequado" };
  }
  return { label: "Abaixo do ideal", badgeClass: "badge-abaixo" };
}

/**
 * Normaliza texto para comparação: sem acentos, minúsculo.
 * @param {*} valor
 * @returns {string}
 */
function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Chave de ordenação do nome do grupo. Nomes iniciados por número ficam
 * depois dos iniciados por letra (ex.: ... G8, 11 ASUGAR), mantendo a
 * ordenação alfabética A→Z percebida na listagem.
 * @param {string} nome
 * @returns {{ bucket: number, texto: string }}
 */
function chaveGrupo(nome) {
  const texto = normalizarTexto(nome);
  const bucket = /^[0-9]/.test(texto) ? 1 : 0;
  return { bucket, texto };
}

/**
 * Valor usado para ordenar uma linha em determinada coluna.
 * Retorna null quando o valor não existe, para que seja posicionado por último.
 * @param {object} row
 * @param {string} col
 * @returns {string|number|null}
 */
function valorOrdenacao(row, col) {
  switch (col) {
    case "grupo":
      return row.grupo ?? null;
    case "qtde_vendida":
      return row.qtde_vendida === null || row.qtde_vendida === undefined
        ? null
        : Number(row.qtde_vendida);
    case "estoque_atual":
      return row.estoque_atual === null || row.estoque_atual === undefined
        ? null
        : Number(row.estoque_atual);
    case "qtde_ideal":
      return row.qtde_ideal === null || row.qtde_ideal === undefined
        ? null
        : Number(row.qtde_ideal);
    case "status":
      return STATUS_RANK[calcularStatus(row.estoque_atual, row.qtde_ideal).label] ?? null;
    default:
      return null;
  }
}

/**
 * Compara dois valores de ordenação. Nulos vão sempre para o fim,
 * independente da direção. Números são comparados numericamente.
 * @param {string|number|null} a
 * @param {string|number|null} b
 * @param {'asc'|'desc'} dir
 * @param {string} col
 * @returns {number}
 */
function compararValores(a, b, dir, col) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  let cmp;
  if (col === "grupo") {
    const ka = chaveGrupo(a);
    const kb = chaveGrupo(b);
    cmp =
      ka.bucket !== kb.bucket
        ? ka.bucket - kb.bucket
        : ka.texto.localeCompare(kb.texto, "pt-BR", { numeric: true });
  } else if (typeof a === "number" && typeof b === "number") {
    cmp = a - b;
  } else {
    cmp = String(a).localeCompare(String(b), "pt-BR");
  }

  return dir === "asc" ? cmp : -cmp;
}

/**
 * Filtra os grupos pelo termo de busca (parcial, case-insensitive).
 * @param {object[]} data
 * @param {string} termo
 * @returns {object[]}
 */
function filtrarGrupos(data, termo) {
  const query = normalizarTexto(termo);
  if (!query) return [...data];
  return data.filter((row) => normalizarTexto(row.grupo).includes(query));
}

/**
 * Ordena os grupos pela coluna/direção informadas, sem alterar o array original.
 * @param {object[]} data
 * @param {string} col
 * @param {'asc'|'desc'} dir
 * @returns {object[]}
 */
function ordenarGrupos(data, col, dir) {
  const ordenado = [...data];
  ordenado.sort((a, b) => {
    const cmp = compararValores(valorOrdenacao(a, col), valorOrdenacao(b, col), dir, col);
    if (cmp !== 0) return cmp;
    // Desempate determinístico pelo nome do grupo.
    return compararValores(valorOrdenacao(a, "grupo"), valorOrdenacao(b, "grupo"), "asc", "grupo");
  });
  return ordenado;
}

/**
 * Atualiza os indicadores visuais e de acessibilidade dos cabeçalhos.
 */
function atualizarIndicadoresOrdenacao() {
  document.querySelectorAll(".th-sortable").forEach((th) => {
    const col = th.dataset.col;
    const ativo = col === sortCol;
    th.setAttribute("aria-sort", ativo ? (sortDir === "asc" ? "ascending" : "descending") : "none");

    const icon = th.querySelector(".sort-icon");
    if (icon) {
      icon.className = ativo
        ? sortDir === "asc"
          ? "bi bi-arrow-up sort-icon"
          : "bi bi-arrow-down sort-icon"
        : "bi bi-arrow-down-up sort-icon";
    }
  });
}

/**
 * Aplica busca + ordenação sobre os dados atuais e renderiza a tabela.
 */
function renderLista() {
  const termo = buscaGrupoInput ? buscaGrupoInput.value : "";
  const filtrados = filtrarGrupos(currentData, termo);
  const ordenados = ordenarGrupos(filtrados, sortCol, sortDir);
  renderTable(ordenados);
  atualizarIndicadoresOrdenacao();
}

// Renderiza os grupos na tabela
// Monta o card mobile de um grupo. Usa as mesmas classes/controles da linha
// da tabela para reaproveitar salvarIdeal/ajustarEstoque passando o card.
function criarCardGrupoMobile(row, status, estoqueAtual, qtdeIdealVal) {
  const card = document.createElement("div");
  card.className = "ou-mobile-card";
  card.dataset.groupId = row.id;
  card.innerHTML = `
    <div class="ou-mobile-card__head">
      <span class="ou-mobile-card__avatar" aria-hidden="true"><i class="bi bi-collection"></i></span>
      <span class="ou-mobile-card__identity">
        <span class="ou-mobile-card__name">${escapeHtml(row.grupo || "-")}</span>
        <span class="ou-mobile-card__fantasia">
          <span class="badge ${status.badgeClass} status-badge">${status.label}</span>
        </span>
      </span>
    </div>
    <div class="ou-mobile-card__info">
      <div class="ou-mobile-card__block">
        <span class="ou-mobile-card__label">Qtde Vendida</span>
        <span class="ou-mobile-card__value">${row.qtde_vendida != null ? parseInt(row.qtde_vendida, 10).toLocaleString("pt-BR") : "0"}</span>
      </div>
      <div class="ou-mobile-card__block">
        <span class="ou-mobile-card__label">Estoque Atual</span>
        <span class="ou-mobile-card__value"><span class="estoque-atual-display">${estoqueAtual.toLocaleString("pt-BR")}</span></span>
      </div>
    </div>
    <div class="ou-mobile-card__actions">
      <div class="ou-mobile-card__action">
        <span class="ou-mobile-card__label">Ideal</span>
        <input type="number" class="form-control form-control-sm input-ajuste input-ideal" value="${qtdeIdealVal}" min="0" placeholder="—" title="Quantidade ideal de estoque para este grupo" />
        <button class="btn btn-outline-secondary btn-sm btn-salvar-ideal" title="Salvar quantidade ideal"><i class="bi bi-floppy"></i></button>
      </div>
      <div class="ou-mobile-card__action">
        <span class="ou-mobile-card__label">Adicionar</span>
        <input type="number" class="form-control form-control-sm input-ajuste input-adicionar" value="" min="1" placeholder="0" title="Quantidade a adicionar ao estoque" />
        <button class="btn btn-success btn-sm btn-adicionar" title="Adicionar ao estoque"><i class="bi bi-plus-lg"></i></button>
      </div>
      <div class="ou-mobile-card__action">
        <span class="ou-mobile-card__label">Reduzir</span>
        <input type="number" class="form-control form-control-sm input-ajuste input-reduzir" value="" min="1" placeholder="0" title="Quantidade a reduzir do estoque" />
        <button class="btn btn-danger btn-sm btn-reduzir" title="Reduzir do estoque"><i class="bi bi-dash-lg"></i></button>
      </div>
      <span class="spinner-border spinner-border-sm text-primary row-spinner" role="status" style="display:none"></span>
    </div>
  `;

  card
    .querySelector(".btn-salvar-ideal")
    .addEventListener("click", () => salvarIdeal(card, row.id));
  card
    .querySelector(".btn-adicionar")
    .addEventListener("click", () => ajustarEstoque(card, row.id, "adicionar"));
  card
    .querySelector(".btn-reduzir")
    .addEventListener("click", () => ajustarEstoque(card, row.id, "reduzir"));

  return card;
}

function renderTable(data) {
  gruposTableBody.innerHTML = "";
  if (gruposMobileList) gruposMobileList.innerHTML = "";

  if (!data || data.length === 0) {
    emptyState.style.display = "block";
    resultsInfo.textContent = "0 grupos";
    return;
  }

  emptyState.style.display = "none";

  data.forEach((row) => {
    const status = calcularStatus(row.estoque_atual, row.qtde_ideal);
    const estoqueAtual = Number(row.estoque_atual) || 0;
    const qtdeIdealVal =
      row.qtde_ideal !== null && row.qtde_ideal !== undefined
        ? Number(row.qtde_ideal)
        : "";

    const tr = document.createElement("tr");
    tr.dataset.groupId = row.id;

    tr.innerHTML = `
      <td><strong>${escapeHtml(row.grupo || "-")}</strong></td>
      <td class="text-center">${row.qtde_vendida != null ? parseInt(row.qtde_vendida, 10).toLocaleString("pt-BR") : "0"}</td>
      <td class="text-center">
        <span class="fw-bold estoque-atual-display">${estoqueAtual.toLocaleString("pt-BR")}</span>
      </td>
      <td class="text-center">
        <div class="d-flex align-items-center justify-content-center gap-1">
          <input
            type="number"
            class="form-control form-control-sm input-ajuste input-ideal"
            value="${qtdeIdealVal}"
            min="0"
            placeholder="—"
            title="Quantidade ideal de estoque para este grupo"
          />
          <button
            class="btn btn-outline-secondary btn-sm btn-salvar-ideal"
            title="Salvar quantidade ideal"
          >
            <i class="bi bi-floppy"></i>
          </button>
        </div>
      </td>
      <td class="text-center">
        <span class="badge ${status.badgeClass} status-badge">${status.label}</span>
      </td>
      <td class="text-center">
        <div class="d-flex align-items-center justify-content-center gap-1">
          <input
            type="number"
            class="form-control form-control-sm input-ajuste input-adicionar"
            value=""
            min="1"
            placeholder="0"
            title="Quantidade a adicionar ao estoque"
          />
          <button
            class="btn btn-success btn-sm btn-adicionar"
            title="Adicionar ao estoque"
          >
            <i class="bi bi-plus-lg"></i>
          </button>
        </div>
      </td>
      <td class="text-center">
        <div class="d-flex align-items-center justify-content-center gap-1">
          <input
            type="number"
            class="form-control form-control-sm input-ajuste input-reduzir"
            value=""
            min="1"
            placeholder="0"
            title="Quantidade a reduzir do estoque"
          />
          <button
            class="btn btn-danger btn-sm btn-reduzir"
            title="Reduzir do estoque"
          >
            <i class="bi bi-dash-lg"></i>
          </button>
        </div>
      </td>
      <td class="text-center">
        <span class="spinner-border spinner-border-sm text-primary row-spinner" role="status" style="display:none"></span>
      </td>
    `;

    // Salvar quantidade ideal
    tr.querySelector(".btn-salvar-ideal").addEventListener("click", () =>
      salvarIdeal(tr, row.id),
    );

    // Adicionar ao estoque
    tr.querySelector(".btn-adicionar").addEventListener("click", () =>
      ajustarEstoque(tr, row.id, "adicionar"),
    );

    // Reduzir do estoque
    tr.querySelector(".btn-reduzir").addEventListener("click", () =>
      ajustarEstoque(tr, row.id, "reduzir"),
    );

    gruposTableBody.appendChild(tr);
    if (gruposMobileList) {
      gruposMobileList.appendChild(
        criarCardGrupoMobile(row, status, estoqueAtual, qtdeIdealVal),
      );
    }
  });

  resultsInfo.textContent = `${data.length} grupo${data.length !== 1 ? "s" : ""}`;
}

/**
 * Salva a quantidade ideal de um grupo
 * @param {HTMLElement} tr - Linha da tabela
 * @param {number} groupId - ID do grupo
 */
async function salvarIdeal(tr, groupId) {
  const inputIdeal = tr.querySelector(".input-ideal");
  const spinner = tr.querySelector(".row-spinner");
  const rawVal = inputIdeal.value.trim();
  const qtdeIdeal = rawVal === "" ? null : parseInt(rawVal, 10);

  if (rawVal !== "" && (isNaN(qtdeIdeal) || qtdeIdeal < 0)) {
    alert("Quantidade ideal inválida. Informe um número inteiro maior ou igual a zero.");
    return;
  }

  try {
    spinner.style.display = "inline-block";

    const response = await fetch(`/part-groups/${groupId}/ideal`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qtde_ideal: qtdeIdeal }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Erro ao salvar quantidade ideal");
    }

    const updated = await response.json();

    // Atualiza o status na linha
    const estoqueAtual = Number(
      tr.querySelector(".estoque-atual-display").textContent.replace(/\./g, "").replace(",", "."),
    ) || 0;
    const status = calcularStatus(estoqueAtual, updated.qtde_ideal);
    tr.querySelector(".status-badge").className = `badge ${status.badgeClass} status-badge`;
    tr.querySelector(".status-badge").textContent = status.label;

    // Atualiza no dataset local
    const idx = currentData.findIndex((r) => r.id == groupId);
    if (idx !== -1) currentData[idx].qtde_ideal = updated.qtde_ideal;

    showToast("Quantidade ideal salva com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao salvar quantidade ideal:", error);
    alert(error.message || "Erro ao salvar quantidade ideal");
  } finally {
    spinner.style.display = "none";
  }
}

/**
 * Ajusta o estoque de um grupo (adicionar ou reduzir)
 * @param {HTMLElement} tr - Linha da tabela
 * @param {number} groupId - ID do grupo
 * @param {"adicionar"|"reduzir"} operacao - Tipo de operação
 */
async function ajustarEstoque(tr, groupId, operacao) {
  const inputEl =
    operacao === "adicionar"
      ? tr.querySelector(".input-adicionar")
      : tr.querySelector(".input-reduzir");
  const spinner = tr.querySelector(".row-spinner");

  const rawVal = inputEl.value.trim();
  const qty = parseInt(rawVal, 10);

  if (!rawVal || isNaN(qty) || qty <= 0) {
    alert(`Informe uma quantidade válida para ${operacao === "adicionar" ? "adicionar ao" : "reduzir do"} estoque.`);
    return;
  }

  const delta = operacao === "adicionar" ? qty : -qty;
  const reason =
    operacao === "adicionar" ? "Reposicao_Estoque" : "Reducao_Estoque";

  try {
    spinner.style.display = "inline-block";

    const response = await fetch(`/part-groups/${groupId}/adjust-stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta, reason }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Erro ao ajustar estoque");
    }

    const updated = await response.json();
    const novoEstoque = Number(updated.stock_quantity) || 0;

    // Atualiza o estoque exibido na linha
    tr.querySelector(".estoque-atual-display").textContent =
      novoEstoque.toLocaleString("pt-BR");

    // Atualiza o status
    const qtdeIdealCurrent =
      currentData.find((r) => r.id == groupId)?.qtde_ideal ?? null;
    const status = calcularStatus(novoEstoque, qtdeIdealCurrent);
    tr.querySelector(".status-badge").className = `badge ${status.badgeClass} status-badge`;
    tr.querySelector(".status-badge").textContent = status.label;

    // Atualiza no dataset local
    const idx = currentData.findIndex((r) => r.id == groupId);
    if (idx !== -1) currentData[idx].estoque_atual = novoEstoque;

    // Limpa o input usado
    inputEl.value = "";

    showToast(
      `Estoque ${operacao === "adicionar" ? "adicionado" : "reduzido"} com sucesso! ${updated.message || ""}`,
      "success",
    );
  } catch (error) {
    console.error("Erro ao ajustar estoque:", error);
    alert(error.message || "Erro ao ajustar estoque");
  } finally {
    spinner.style.display = "none";
  }
}

// Busca dados de estoque dos grupos
async function fetchData() {
  try {
    loadingState.style.display = "block";
    emptyState.style.display = "none";
    gruposTableBody.innerHTML = "";

    const params = new URLSearchParams();
    if (currentFilters.dataInicio) params.append("dataInicio", currentFilters.dataInicio);
    if (currentFilters.dataFim) params.append("dataFim", currentFilters.dataFim);
    if (currentFilters.marca) params.append("marca", currentFilters.marca);

    const response = await fetch(`/v2/relatorios/estoque-grupos?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Erro ao buscar dados");
    }

    const data = await response.json();
    currentData = data;

    loadingState.style.display = "none";
    renderLista();
  } catch (error) {
    console.error("Erro ao buscar dados:", error);
    loadingState.style.display = "none";
    emptyState.style.display = "block";
    alert(error.message || "Erro ao carregar dados de estoque dos grupos");
  }
}

// Exibe uma notificação toast simples
function showToast(message, type = "success") {
  const toastContainer = getOrCreateToastContainer();
  const id = `toast-${Date.now()}`;
  const bgClass = type === "success" ? "bg-success" : "bg-danger";

  const toastEl = document.createElement("div");
  toastEl.id = id;
  toastEl.className = `toast align-items-center text-white ${bgClass} border-0`;
  toastEl.setAttribute("role", "alert");
  toastEl.setAttribute("aria-live", "assertive");
  toastEl.setAttribute("aria-atomic", "true");
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${escapeHtml(message)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
    </div>
  `;

  toastContainer.appendChild(toastEl);
  const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
  toast.show();
  toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
}

function getOrCreateToastContainer() {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container position-fixed bottom-0 end-0 p-3";
    container.style.zIndex = "1100";
    document.body.appendChild(container);
  }
  return container;
}

// Escapa HTML para evitar XSS
function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

// Atualiza a coluna/direção de ordenação e re-renderiza a listagem
function selecionarOrdenacao(col) {
  if (sortCol === col) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortCol = col;
    sortDir = "asc";
  }
  renderLista();
}

// Event Listeners
btnFiltrar.addEventListener("click", () => {
  currentFilters = {
    dataInicio: dataInicioInput.value,
    dataFim: dataFimInput.value,
    marca: marcaSelect.value,
  };
  fetchData();
});

btnLimpar.addEventListener("click", () => {
  dataInicioInput.value = "";
  dataFimInput.value = "";
  marcaSelect.value = "";
  if (buscaGrupoInput) buscaGrupoInput.value = "";
  currentFilters = { dataInicio: "", dataFim: "", marca: "" };
  currentData = [];
  gruposTableBody.innerHTML = "";
  emptyState.style.display = "none";
  resultsInfo.textContent = "0 grupos";
  atualizarIndicadoresOrdenacao();
});

// Busca parcial pelo nome do grupo (client-side, sobre os dados já carregados)
if (buscaGrupoInput) {
  buscaGrupoInput.addEventListener("input", () => {
    clearTimeout(buscaDebounceTimer);
    buscaDebounceTimer = setTimeout(renderLista, 150);
  });
}

// Ordenação pelos cabeçalhos (clique, Enter e Espaço)
document.querySelectorAll(".th-sortable").forEach((th) => {
  th.addEventListener("click", () => selecionarOrdenacao(th.dataset.col));
  th.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selecionarOrdenacao(th.dataset.col);
    }
  });
});

// Inicialização
ouOnLoad(() => {
  loadMarcas();
  fetchData();
});
