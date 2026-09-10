let soldItems = [];
let selectedItem = null;

const searchForm = document.getElementById("searchForm");
const searchButton = document.getElementById("searchButton");
const salesTableBody = document.getElementById("salesTableBody");
const salesEmpty = document.getElementById("salesEmpty");
const historyTableBody = document.getElementById("historyTableBody");
const resultCount = document.getElementById("resultCount");
const returnModalElement = document.getElementById("returnModal");
const returnModal = bootstrap.Modal.getOrCreateInstance(returnModalElement);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value, withTime = false) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", withTime
    ? { dateStyle: "short", timeStyle: "short" }
    : { dateStyle: "short", timeZone: "UTC" });
}

function showFeedback(message, type = "success") {
  const area = document.getElementById("feedbackArea");
  area.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show shadow-sm" role="alert">
      ${escapeHtml(message)}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
    </div>`;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Não foi possível concluir a operação");
  }
  return data;
}

function renderSoldItems() {
  resultCount.textContent = String(soldItems.length);
  salesEmpty.classList.toggle("d-none", soldItems.length > 0);
  salesTableBody.innerHTML = soldItems
    .map((item, index) => `
      <tr>
        <td>
          <strong>#${escapeHtml(item.pvcod)}</strong>
          <div class="metadata">${escapeHtml(item.pvcanal || "-")}</div>
        </td>
        <td>${formatDate(item.pvdtcad)}</td>
        <td>
          <div class="piece-name">${escapeHtml(item.prodes)}</div>
          <div class="metadata">Cód. ${escapeHtml(item.procod)} · ${escapeHtml(item.vendedor)}</div>
        </td>
        <td>${escapeHtml(item.cornome || "Sem cor")}</td>
        <td class="text-center">${escapeHtml(item.quantidade_vendida)}</td>
        <td class="text-center">${escapeHtml(item.quantidade_devolvida)}</td>
        <td class="text-center">
          <span class="quantity-pill bg-success-subtle text-success-emphasis">
            ${escapeHtml(item.quantidade_disponivel)}
          </span>
        </td>
        <td class="text-end">${formatCurrency(item.valor_unitario)}</td>
        <td class="text-center">
          <button type="button" class="btn btn-sm btn-primary return-action" data-index="${index}">
            <i class="bi bi-arrow-return-left me-1"></i>Devolver
          </button>
        </td>
      </tr>`)
    .join("");

  document.querySelectorAll(".return-action").forEach((button) => {
    button.addEventListener("click", () => openReturnModal(Number(button.dataset.index)));
  });
}

function renderHistory(items) {
  if (!items.length) {
    historyTableBody.innerHTML = '<tr><td colspan="9" class="text-center text-muted p-4">Nenhuma devolução registrada.</td></tr>';
    return;
  }
  historyTableBody.innerHTML = items.map((item) => `
    <tr>
      <td>${formatDate(item.devdtcad, true)}</td>
      <td><strong>#${escapeHtml(item.devcod)}</strong></td>
      <td>#${escapeHtml(item.pvcod)}</td>
      <td>
        <div class="piece-name">${escapeHtml(item.prodes)}</div>
        <div class="metadata">Cód. ${escapeHtml(item.procod)}</div>
      </td>
      <td>${escapeHtml(item.cornome || "Sem cor")}</td>
      <td class="text-center">${escapeHtml(item.quantidade)}</td>
      <td>${escapeHtml(item.devmotivo)}</td>
      <td>
        <span class="badge ${item.repor_estoque ? "text-bg-success" : "text-bg-secondary"}">
          ${item.repor_estoque ? "Reposto" : "Não reposto"}
        </span>
      </td>
      <td>${escapeHtml(item.usuario)}</td>
    </tr>`).join("");
}

async function loadSoldItems() {
  const params = new URLSearchParams();
  const q = document.getElementById("searchInput").value.trim();
  const dataInicio = document.getElementById("dateStart").value;
  const dataFim = document.getElementById("dateEnd").value;
  if (q) params.set("q", q);
  if (dataInicio) params.set("dataInicio", dataInicio);
  if (dataFim) params.set("dataFim", dataFim);

  searchButton.disabled = true;
  searchButton.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Buscando';
  salesTableBody.innerHTML = '<tr><td colspan="9" class="text-center p-4"><span class="spinner-border spinner-border-sm me-2"></span>Carregando...</td></tr>';
  try {
    soldItems = await requestJson(`${BASE_URL}/devolucoes/itens?${params}`);
    renderSoldItems();
  } catch (error) {
    soldItems = [];
    renderSoldItems();
    showFeedback(error.message, "danger");
  } finally {
    searchButton.disabled = false;
    searchButton.innerHTML = '<i class="bi bi-search me-1"></i> Buscar';
  }
}

async function loadHistory() {
  try {
    const history = await requestJson(`${BASE_URL}/devolucoes/historico`);
    renderHistory(history);
  } catch (error) {
    historyTableBody.innerHTML = '<tr><td colspan="9" class="text-center text-danger p-4">Erro ao carregar o histórico.</td></tr>';
  }
}

function openReturnModal(index) {
  selectedItem = soldItems[index];
  if (!selectedItem) return;
  const max = Number(selectedItem.quantidade_disponivel);
  document.getElementById("returnSubtitle").textContent = `Pedido #${selectedItem.pvcod}`;
  document.getElementById("selectedPiece").innerHTML = `
    <div class="piece-name">${escapeHtml(selectedItem.prodes)}</div>
    <div class="metadata">${escapeHtml(selectedItem.cornome || "Sem cor")} · ${formatCurrency(selectedItem.valor_unitario)}</div>`;
  const quantityInput = document.getElementById("returnQuantity");
  quantityInput.value = "1";
  quantityInput.max = String(max);
  document.getElementById("quantityHelp").textContent = `Máximo disponível: ${max}`;
  document.getElementById("returnReason").value = "";
  document.getElementById("returnNotes").value = "";
  document.getElementById("returnToStock").checked = true;
  returnModal.show();
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadSoldItems();
});

document.getElementById("returnForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedItem) return;
  const button = document.getElementById("confirmReturnButton");
  const quantidade = Number(document.getElementById("returnQuantity").value);
  const max = Number(selectedItem.quantidade_disponivel);
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > max) {
    showFeedback(`Informe uma quantidade entre 1 e ${max}.`, "warning");
    return;
  }

  button.disabled = true;
  button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Registrando';
  try {
    const result = await requestJson(`${BASE_URL}/devolucoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pvcod: selectedItem.pvcod,
        procod: selectedItem.procod,
        pviprocorid: selectedItem.pviprocorid,
        quantidade,
        motivo: document.getElementById("returnReason").value,
        observacao: document.getElementById("returnNotes").value.trim(),
        reporEstoque: document.getElementById("returnToStock").checked,
      }),
    });
    returnModal.hide();
    showFeedback(`Devolução #${result.devolucao.codigo} registrada com sucesso.`);
    await Promise.all([loadSoldItems(), loadHistory()]);
  } catch (error) {
    showFeedback(error.message, "danger");
  } finally {
    button.disabled = false;
    button.innerHTML = '<i class="bi bi-check-lg me-1"></i>Confirmar devolução';
  }
});

document.addEventListener("DOMContentLoaded", () => {
  loadSoldItems();
  loadHistory();
});
