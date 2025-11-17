const marcasEstoque = document.getElementById("filtroMarcaSelect");
const modelosEstoque = document.getElementById("filtroModeloSelect");
const btnAplicarEstoque = document.getElementById("btnAplicarFiltroEstoque");
const btnLimparEstoque = document.getElementById("btnLimparFiltroEstoque");
const estoqueSelect = document.getElementById("filtroEstoqueSelect");

async function adicionarEstoque(procod, quantidade, cor = null) {
  try {
    console.log("Adicionando estoque:", procod, quantidade, cor);
    const response = await fetch(`${BASE_URL}/pro/estoque/${procod}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ quantidade, cor }),
    });
    if (response.ok) {
      alert("Estoque atualizado com sucesso!");
      location.reload(); // Recarrega a página para atualizar a tabela
    } else {
      alert("Erro ao atualizar o estoque front-end.");
    }
  } catch (error) {
    console.error("Erro ao atualizar o estoque:", error);
    alert("Erro ao atualizar o estoque.");
  }
}

(function () {
  async function buscarMarcasEstoque() {
    try {
      const res = await fetch(`${BASE_URL}/marcas/`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar marcas: " + res.status);
      const data = await res.json();
      marcasEstoque.innerHTML = '<option value="todas">Todas</option>'; // limpa e adiciona opção 'todas'
      data.forEach((marca) => {
        const option = document.createElement("option");
        option.value = marca.marcascod;
        option.textContent = marca.marcasdes;
        marcasEstoque.appendChild(option);
      });
    } catch (err) {
      console.error(err);
      marcasEstoque.innerHTML =
        '<option value="todas">Erro ao carregar marcas</option>';
    }
  }

  async function buscarTodosModelos() {
    try {
      const res = await fetch(`${BASE_URL}/modelos/`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar modelos: " + res.status);
      const data = await res.json();
      modelosEstoque.innerHTML = '<option value="todos">Todos</option>'; // limpa e adiciona opção 'todos'
      data.forEach((modelo) => {
        const option = document.createElement("option");
        option.value = modelo.modcod;
        option.textContent = modelo.moddes;
        modelosEstoque.appendChild(option);
      });
    } catch (err) {
      console.error(err);
      modelosEstoque.innerHTML =
        '<option value="todos">Erro ao carregar modelos</option>';
    }
  }

  async function buscarModelosEstoque(marcaCod = null) {
    try {
      // Verifica se é "todas" ou null/undefined
      if (!marcaCod || marcaCod === "todas") {
        await buscarTodosModelos();
        return;
      }

      // Se chegou aqui, é um código de marca válido
      let url = `${BASE_URL}/modelo/${marcaCod}`;

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar modelos: " + res.status);

      const data = await res.json();
      modelosEstoque.innerHTML = '<option value="todos">Todos</option>';
      data.forEach((modelo) => {
        const option = document.createElement("option");
        option.value = modelo.modcod;
        option.textContent = modelo.moddes;
        modelosEstoque.appendChild(option);
      });
    } catch (err) {
      console.error(err);
      modelosEstoque.innerHTML =
        '<option value="todos">Erro ao carregar modelos</option>';
    }
  }

  // Adiciona listener para quando a marca for alterada
  marcasEstoque.addEventListener("change", function () {
    buscarModelosEstoque(this.value);
  });

  // Chama as funções para popular os selects ao carregar a página
  buscarMarcasEstoque();

  // função que faz fetch (adapte a URL / parâmetros conforme sua API)
  async function fetchBuscarEstoque(params = {}) {
    const tabelaEstoque = document.getElementById("tabela-estoque");
    const { marca, modelo, estoque } = params;
    // backend espera rotas com path params: /v2/proComEstoque/:marca/:modelo ou /v2/proSemEstoque/:marca/:modelo
    const marcaParam =
      marca && marca !== "todas" ? encodeURIComponent(marca) : "todas";
    const modeloParam =
      modelo && modelo !== "todos" ? encodeURIComponent(modelo) : "todos";

    const temFiltro =
      (marca && marca !== "todas") || (modelo && modelo !== "todos");

    // Define a URL baseada no filtro de estoque
    let url;
    console.log("Estoque selecionado:", estoque);
    if (estoque === "0") {
      // com estoque
      url = temFiltro
        ? `${BASE_URL}/v2/proComEstoque/${marcaParam}/${modeloParam}`
        : `${BASE_URL}/v2/proComEstoque`;
    } else if (estoque === "1") {
      // sem estoque
      url = temFiltro
        ? `${BASE_URL}/v2/proSemEstoque/${marcaParam}/${modeloParam}`
        : `${BASE_URL}/v2/proSemEstoque`;
    } else {
      // Se não houver filtro de estoque selecionado, não busca nada
      tabelaEstoque.innerHTML =
        '<tr><td colspan="7" class="text-center">Selecione um filtro de estoque.</td></tr>';
      return;
    }

    console.log("Buscando estoque com URL:", url);

    const renderTabela = (tbody, dados) => {
      tbody.innerHTML = "";
      if (!dados || dados.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="7" class="text-center">Nenhum produto encontrado.</td></tr>';
        return;
      }
      dados.forEach((dado) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${dado.prodes}</td>
          <td>${dado.marcasdes}</td>
          <td>${dado.moddes}</td>
          <td>${dado.tipodes}</td>
          <td>${dado.cordes}</td>
          <td>
            <div class="d-flex gap-2">
              <div class="row">
                <div class="col">
                  <input type="text" class="form-control" placeholder="Quantidade"
                    aria-label="Quantidade" aria-describedby="basic-addon1">
                </div>
                <div class="col">
                  <button class="btn btn-success"
                    onclick="adicionarEstoque(${dado.procod}, this.closest('.row').querySelector('input').value, ${dado.procorcorescod})">
                    Adicionar
                  </button>
                </div>
              </div>
            </div>
          </td>
          <td class="text-center">${dado.qtde}</td>
        `;
        tbody.appendChild(tr);
      });
    };

    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar estoque.");

      const dados = await res.json();
      renderTabela(tabelaEstoque, dados);
    } catch (err) {
      console.error(err);
      tabelaEstoque.innerHTML =
        '<tr><td colspan="7" class="text-center">Erro ao carregar.</td></tr>';
    }
  }

  btnAplicarEstoque.addEventListener("click", function () {
    const estoqueSelect = document.getElementById("filtroEstoqueSelect");
    fetchBuscarEstoque({
      marca: marcasEstoque.value,
      modelo: modelosEstoque.value,
      estoque: estoqueSelect.value,
    });
  });

  btnLimparEstoque.addEventListener("click", async function () {
    marcasEstoque.value = "todas";
    await buscarTodosModelos(); // repopula modelos sem filtro
    modelosEstoque.value = "todos";
    const estoqueSelect = document.getElementById("filtroEstoqueSelect");
    estoqueSelect.value = ""; // Reseta o filtro de estoque
    const tabelaEstoque = document.getElementById("tabela-estoque");
    tabelaEstoque.innerHTML = "";
  });
})();
