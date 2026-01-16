let currentData = [];
let currentFilters = {
  dataInicio: "",
  dataFim: "",
  marca: "",
  groupBy: "peca",
};

// Elementos DOM
const dataInicioInput = document.getElementById("dataInicio");
const dataFimInput = document.getElementById("dataFim");
const marcaSelect = document.getElementById("marcaSelect");
const groupBySelect = document.getElementById("groupBySelect");
const btnFiltrar = document.getElementById("btnFiltrar");
const btnLimpar = document.getElementById("btnLimpar");
const btnExportPDF = document.getElementById("btnExportPDF");
const btnExportXLS = document.getElementById("btnExportXLS");
const tableHeader = document.getElementById("tableHeader");
const tableBody = document.getElementById("tableBody");
const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");
const resultsInfo = document.getElementById("resultsInfo");

// Carrega marcas para o select
async function loadMarcas() {
  try {
    const response = await fetch("/marcas");
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

// Atualiza cabeçalho da tabela baseado no tipo de agrupamento
function updateTableHeader() {
  const groupBy = groupBySelect.value;

  if (groupBy === "grupo") {
    tableHeader.innerHTML = `
          <tr>
            <th>Grupo</th>
            <th class="text-center">Qtde Vendida</th>
            <th>Modelo</th>
            <th>Peça</th>
          </tr>
        `;
  } else {
    tableHeader.innerHTML = `
          <tr>
            <th>Peça</th>
            <th class="text-center">Qtde Vendida</th>
            <th>Modelo</th>
            <th>Grupo</th>
          </tr>
        `;
  }
}

// Renderiza dados na tabela
function renderTable(data) {
  const groupBy = groupBySelect.value;
  tableBody.innerHTML = "";

  if (!data || data.length === 0) {
    emptyState.style.display = "block";
    resultsInfo.textContent = "0 registros";
    return;
  }

  emptyState.style.display = "none";

  data.forEach((row) => {
    const tr = document.createElement("tr");

    if (groupBy === "grupo") {
      tr.innerHTML = `
        <td>${row.grupo || "-"}</td>
        <td class="text-center">${row.qtde_vendida != null ? parseInt(row.qtde_vendida, 10) : 0}</td>
        <td>${row.modelo || "-"}</td>
        <td>${row.peca || "-"}</td>
        `;
    } else {
      tr.innerHTML = `
            <td>${row.peca || "-"}</td>
            <td class="text-center">${row.qtde_vendida != null ? parseInt(row.qtde_vendida, 10) : 0}</td>
            <td>${row.modelo || "-"}</td>
            <td>${row.grupo || "-"}</td>
          `;
    }

    tableBody.appendChild(tr);
  });

  resultsInfo.textContent = `${data.length} registro${data.length !== 1 ? "s" : ""}`;
}

// Busca dados do relatório
async function fetchData() {
  try {
    loadingState.style.display = "block";
    emptyState.style.display = "none";
    tableBody.innerHTML = "";

    const params = new URLSearchParams();
    if (currentFilters.dataInicio)
      params.append("dataInicio", currentFilters.dataInicio);
    if (currentFilters.dataFim)
      params.append("dataFim", currentFilters.dataFim);
    if (currentFilters.marca) params.append("marca", currentFilters.marca);
    params.append("groupBy", currentFilters.groupBy);

    const response = await fetch(
      `/v2/relatorios/top-pecas?${params.toString()}`,
    );
    if (!response.ok) throw new Error("Erro ao buscar dados");

    const data = await response.json();
    currentData = data;

    loadingState.style.display = "none";
    renderTable(data);
  } catch (error) {
    console.error("Erro ao buscar dados:", error);
    loadingState.style.display = "none";
    emptyState.style.display = "block";
    alert("Erro ao carregar dados do relatório");
  }
}

// Exporta relatório
function exportReport(format) {
  const params = new URLSearchParams();
  if (currentFilters.dataInicio)
    params.append("dataInicio", currentFilters.dataInicio);
  if (currentFilters.dataFim) params.append("dataFim", currentFilters.dataFim);
  if (currentFilters.marca) params.append("marca", currentFilters.marca);
  params.append("groupBy", currentFilters.groupBy);

  const url = `/v2/relatorios/top-pecas/${format}?${params.toString()}`;
  window.open(url, "_blank");
}

// Event Listeners
btnFiltrar.addEventListener("click", () => {
  currentFilters = {
    dataInicio: dataInicioInput.value,
    dataFim: dataFimInput.value,
    marca: marcaSelect.value,
    groupBy: groupBySelect.value,
  };
  updateTableHeader();
  fetchData();
});

btnLimpar.addEventListener("click", () => {
  dataInicioInput.value = "";
  dataFimInput.value = "";
  marcaSelect.value = "";
  groupBySelect.value = "peca";
  currentFilters = {
    dataInicio: "",
    dataFim: "",
    marca: "",
    groupBy: "peca",
  };
  updateTableHeader();
  tableBody.innerHTML = "";
  emptyState.style.display = "none";
  resultsInfo.textContent = "0 registros";
});

groupBySelect.addEventListener("change", () => {
  updateTableHeader();
});

btnExportPDF.addEventListener("click", () => {
  exportReport("pdf");
});

btnExportXLS.addEventListener("click", () => {
  exportReport("xls");
});

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  loadMarcas();
  updateTableHeader();
});
