const params = new URLSearchParams(window.location.search);

const id = params.get("id");
const modelo = params.get("modelo");
const marcascod = params.get("marcascod");

// console.log("ID:", id);

function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

document.addEventListener("DOMContentLoaded", function () {
  fetch(`${BASE_URL}/pro/${id}?marca=${marcascod}&modelo=${modelo}`)
    .then((res) => res.json())
    .then((dados) => {
      const corpoTabela = document.getElementById("corpoTabela");
      corpoTabela.innerHTML = ""; // Limpa o conteúdo atual da tabela

      dados.forEach((dado) => {
        const tr = document.createElement("tr");
        tr.dataset.preco = dado.provl;
        tr.innerHTML = `
            <td>${dado.prodes}</td>
            <td>${formatarMoeda(dado.provl)}</td>
            
            <td>
            <input type="number" style="width:40px" id="qtde_peca_${
              dado.procod
            }">
              <button class="btn btn-success btn-sm" onclick="adicionarAoCarrinho('${
                dado.procod
              }')">Adicionar</button>
            </td>
          `;

        // Removido: função duplicada e desnecessária aqui, pois já está definida globalmente abaixo.
        corpoTabela.appendChild(tr);
      });
    })
    .catch((erro) => console.error(erro));
});

//função para criar modelo
document
  .getElementById("cadastrarListaPeca")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    data.promarcascod = marcascod; // Adiciona o código da marca ao objeto data
    data.promodcod = modelo; // Adiciona o código do modelo ao objeto data
    data.protipocod = id; // Adiciona o código do tipo ao objeto data

    fetch(`${BASE_URL}/pro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((resposta) => {
        alert("Dados salvos com sucesso!");
        console.log(resposta);
        location.reload(); // Atualiza a página após gravar
      })
      .catch((erro) => {
        alert("Erro ao salvar os dados.");
        console.error(erro);
      });
  });

document.getElementById("pesquisa").addEventListener("input", function () {
  const pesquisa = this.value.toLowerCase();
  const linhas = document.querySelectorAll("#corpoTabela tr");

  linhas.forEach((linha) => {
    const celula = linha.querySelector("td");
    if (celula) {
      const conteudoCelula = celula.textContent.toLowerCase();
      linha.style.display = conteudoCelula.includes(pesquisa) ? "" : "none";
    }
  });
});

// Busca o nome da marca pelo id usando fetch e exibe no elemento com id 'marcaTitulo'
fetch(`${BASE_URL}/marcas/${marcascod}`)
  .then((res) => res.json())
  .then((marcas) => {
    document.getElementById("marcaTitulo").textContent =
      marcas[0].marcasdes || "Marca não encontrada";
  })
  .catch(() => {
    document.getElementById("marcaTitulo").textContent = "";
  });

// Ordenação das colunas ao clicar no cabeçalho da tabela
document.addEventListener("DOMContentLoaded", function () {
  const headers = document.querySelectorAll("table th");
  headers.forEach((header, index) => {
    header.style.cursor = "pointer";
    header.addEventListener("click", () => sortTable(index));
  });
});

function sortTable(colIndex) {
  const tbody = document.getElementById("corpoTabela");
  const rows = Array.from(tbody.querySelectorAll("tr"));

  const asc =
    tbody.dataset.sortColumn == colIndex && tbody.dataset.sortOrder === "asc"
      ? false
      : true;

  rows.sort((a, b) => {
    const aCell = a.children[colIndex].textContent.trim();
    const bCell = b.children[colIndex].textContent.trim();

    if (colIndex === 1) {
      // Coluna de valor numérico (formato de moeda)
      const aVal = parseFloat(aCell.replace(/[^0-9,-]+/g, "").replace(",", ".")) || 0;
      const bVal = parseFloat(bCell.replace(/[^0-9,-]+/g, "").replace(",", ".")) || 0;
      return asc ? aVal - bVal : bVal - aVal;
    } else {
      return asc ? aCell.localeCompare(bCell) : bCell.localeCompare(aCell);
    }
  });

  rows.forEach((row) => tbody.appendChild(row));
  tbody.dataset.sortOrder = asc ? "asc" : "desc";
  tbody.dataset.sortColumn = colIndex;
}
