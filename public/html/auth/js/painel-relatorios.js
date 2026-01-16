document.addEventListener("DOMContentLoaded", async () => {
  // Elementos do DOM
  const formFiltros = document.getElementById("formFiltros");
  const btnLimpar = document.getElementById("btnLimpar");
  const btnExportPDF = document.getElementById("btnExportPDF");
  const btnExportXLS = document.getElementById("btnExportXLS");
  const selectMarca = document.getElementById("marca");
  const selectGroupBy = document.getElementById("groupBy");
  const loading = document.getElementById("loading");
  const tabelaResultado = document.getElementById("tabelaResultado");
  const tabelaHeader = document.getElementById("tabelaHeader");
  const tabelaBody = document.getElementById("tabelaBody");
  const totalRegistros = document.getElementById("totalRegistros");
  const mensagemVazia = document.getElementById("mensagemVazia");
  const mensagemInicial = document.getElementById("mensagemInicial");

  let dadosAtuais = null;
  let filtrosAtuais = null;

  // Carrega marcas
  // Note: Uses existing /marcas endpoint (from marcasRoutes)
  async function carregarMarcas() {
    try {
      const response = await fetch(`${BASE_URL}/marcas`, {
        credentials: "include",
      });

      if (!response.ok) throw new Error("Erro ao carregar marcas");

      const marcas = await response.json();
      
      selectMarca.innerHTML = '<option value="todas" selected>Todas</option>';
      marcas.forEach((marca) => {
        const option = document.createElement("option");
        option.value = marca.marcascod;
        option.textContent = marca.marcasdes;
        selectMarca.appendChild(option);
      });
    } catch (error) {
      console.error("Erro ao carregar marcas:", error);
    }
  }

  // Mostra/esconde elementos
  function mostrarLoading() {
    loading.style.display = "block";
    tabelaResultado.style.display = "none";
    mensagemVazia.style.display = "none";
    mensagemInicial.style.display = "none";
  }

  function mostrarTabela() {
    loading.style.display = "none";
    tabelaResultado.style.display = "block";
    mensagemVazia.style.display = "none";
    mensagemInicial.style.display = "none";
    btnExportPDF.disabled = false;
    btnExportXLS.disabled = false;
  }

  function mostrarMensagemVazia() {
    loading.style.display = "none";
    tabelaResultado.style.display = "none";
    mensagemVazia.style.display = "block";
    mensagemInicial.style.display = "none";
    btnExportPDF.disabled = true;
    btnExportXLS.disabled = true;
  }

  function mostrarMensagemInicial() {
    loading.style.display = "none";
    tabelaResultado.style.display = "none";
    mensagemVazia.style.display = "none";
    mensagemInicial.style.display = "block";
    btnExportPDF.disabled = true;
    btnExportXLS.disabled = true;
  }

  // Renderiza cabeçalho da tabela
  function renderizarCabecalho(groupBy) {
    tabelaHeader.innerHTML = "";
    
    if (groupBy === "grupo") {
      tabelaHeader.innerHTML = `
        <th>Grupo</th>
        <th>Qtde Vendida</th>
        <th>Modelos</th>
        <th>Marcas</th>
      `;
    } else {
      tabelaHeader.innerHTML = `
        <th>Peça</th>
        <th>Qtde Vendida</th>
        <th>Modelo</th>
        <th>Grupo</th>
      `;
    }
  }

  // Renderiza dados na tabela
  function renderizarDados(dados, groupBy) {
    tabelaBody.innerHTML = "";

    if (!dados || dados.length === 0) {
      mostrarMensagemVazia();
      return;
    }

    dados.forEach((item) => {
      const tr = document.createElement("tr");
      
      if (groupBy === "grupo") {
        tr.innerHTML = `
          <td>${item.grupo || "Sem Grupo"}</td>
          <td>${item.qtde_vendida}</td>
          <td>${item.modelos || "-"}</td>
          <td>${item.marcas || "-"}</td>
        `;
      } else {
        tr.innerHTML = `
          <td>${item.peca || "-"}</td>
          <td>${item.qtde_vendida}</td>
          <td>${item.modelo || "-"}</td>
          <td>${item.grupo || "-"}</td>
        `;
      }
      
      tabelaBody.appendChild(tr);
    });

    totalRegistros.textContent = `Total: ${dados.length} registro(s)`;
    mostrarTabela();
  }

  // Busca dados do relatório
  async function buscarRelatorio(event) {
    event.preventDefault();

    const formData = new FormData(formFiltros);
    const params = new URLSearchParams();

    const dataInicio = formData.get("dataInicio");
    const dataFim = formData.get("dataFim");
    const marca = formData.get("marca");
    const groupBy = formData.get("groupBy");

    if (dataInicio) params.append("dataInicio", dataInicio);
    if (dataFim) params.append("dataFim", dataFim);
    if (marca && marca !== "todas") params.append("marca", marca);
    params.append("groupBy", groupBy);

    // Salva filtros para exportação
    filtrosAtuais = params;

    mostrarLoading();

    try {
      const response = await fetch(
        `${BASE_URL}/v2/relatorios/top-pecas?${params.toString()}`,
        { credentials: "include" }
      );

      if (!response.ok) throw new Error("Erro ao buscar dados");

      const dados = await response.json();
      dadosAtuais = dados;

      renderizarCabecalho(groupBy);
      renderizarDados(dados, groupBy);
    } catch (error) {
      console.error("Erro ao buscar relatório:", error);
      alert("Erro ao buscar dados do relatório. Tente novamente.");
      mostrarMensagemInicial();
    }
  }

  // Exporta para PDF
  function exportarPDF() {
    if (!filtrosAtuais) return;

    const url = `${BASE_URL}/v2/relatorios/top-pecas/pdf?${filtrosAtuais.toString()}`;
    window.open(url, "_blank");
  }

  // Exporta para Excel
  function exportarXLS() {
    if (!filtrosAtuais) return;

    const url = `${BASE_URL}/v2/relatorios/top-pecas/xls?${filtrosAtuais.toString()}`;
    window.open(url, "_blank");
  }

  // Limpa filtros
  function limparFiltros() {
    formFiltros.reset();
    dadosAtuais = null;
    filtrosAtuais = null;
    mostrarMensagemInicial();
  }

  // Event listeners
  formFiltros.addEventListener("submit", buscarRelatorio);
  btnLimpar.addEventListener("click", limparFiltros);
  btnExportPDF.addEventListener("click", exportarPDF);
  btnExportXLS.addEventListener("click", exportarXLS);

  // Inicialização
  await carregarMarcas();
});
