const params = new URLSearchParams(window.location.search);

const id = params.get("id");
const marcascod = params.get("marcascod");

//popular table com os dados do modelo
document.addEventListener("DOMContentLoaded", function () {
  fetch(`${BASE_URL}/tipo/${id}`)
    .then((res) => res.json())
    .then((dados) => {
      const corpoTabela = document.getElementById("corpoTabela");
      corpoTabela.innerHTML = ""; // Limpa o conteúdo atual da tabela

      dados.forEach((dado) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
                      <td class="text-center">${dado.tipodes}</td>
                      <td class="text-center">
                        <a href="pecas/lista?id=${dado.tipocod}&marcascod=${dado.promarcascod}&modelo=${dado.promodcod}"><button class="btn btn-outline-success btn-sm">Selecionar <i class="bi bi-caret-right-fill"></i></button></a>
                      </td>
                        `;
        corpoTabela.appendChild(tr);
      });
    })
    .catch((erro) => console.error(erro));
});

//função para criar modelo
document
  .getElementById("cadastrarTipoPeca")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    fetch(`${BASE_URL}/tipo`, {
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

// Busca o nome da marca pelo id usando fetch e exibe no elemento com id 'marcaTitulo'
fetch(`${BASE_URL}/marcas/${marcascod}`, { cache: "no-store" })
  .then((res) => res.json())
  .then((marcas) => {
    document.getElementById("marcaTitulo").textContent =
      marcas[0].marcasdes || "Marca não encontrada";
  })
  .catch(() => {
    document.getElementById("marcaTitulo").textContent = "";
  });
