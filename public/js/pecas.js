const params = new URLSearchParams(window.location.search);

const id = params.get('id');

//popular table com os dados do modelo
document.addEventListener("DOMContentLoaded", function () {
fetch(`http://127.0.0.1:3000/tipo/${id}`)
    .then((res) => res.json())
    .then((dados) => {
      const corpoTabela = document.getElementById("corpoTabela");
      corpoTabela.innerHTML = ""; // Limpa o conteúdo atual da tabela

      dados.forEach((dado) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
                      <td class="text-center"><a href="">${dado.tipodes}</a></td>
                      <td>
                        <a href="lista-pecas?id=${dado.tipocod}&marca=${dado.promarcascod}&modelo=${dado.promodcod}"><button class="btn btn-success btn-sm">Selecionar</button></a>
                      </td>
                        `;
        corpoTabela.appendChild(tr);
      });
    })
    .catch((erro) => console.error(erro));
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
})