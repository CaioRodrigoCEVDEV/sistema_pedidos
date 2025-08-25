const params = new URLSearchParams(window.location.search);
const id = params.get("id");
const marcascod = params.get("marcascod");

//popular table com os dados do modelo
document.addEventListener("DOMContentLoaded", function () {
  fetch(`${BASE_URL}/modelo/${id}`)
    .then((res) => res.json())
    .then((dados) => {
      const corpoTabela = document.getElementById("corpoTabela");
      corpoTabela.innerHTML = ""; // Limpa o conteúdo atual da tabela

        dados.sort((a, b) => {
          const nomeA = a.moddes.replace(/\s/g, "");
          const nomeB = b.moddes.replace(/\s/g, "");
          return nomeA.localeCompare(nomeB, "pt-BR", { numeric: true });
        });

        dados.forEach((dado) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
                      <td class="text-center">${dado.moddes}</td> 
                      <td class="text-center">
                        <a href="modelo/pecas?id=${dado.modcod}&marcascod=${dado.modmarcascod}"><button class="btn btn-outline-success btn-sm">Selecionar <i class="bi bi-caret-right-fill"></i></button></a>
                      </td>
                        `;
        corpoTabela.appendChild(tr);
      });
    })
    .catch((erro) => console.error(erro));
});

//função para criar modelo
document
  .getElementById("cadastrarModelo")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    data.modmarcascod = marcascod; // Adiciona o id da marca ao objeto de dados

    fetch(`${BASE_URL}/modelo`, {
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

// função para pesquisar modelo usando o input com id "pesquisa" usando a table com id "corpoTabela"
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
