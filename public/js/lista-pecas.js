const params = new URLSearchParams(window.location.search);

const id = params.get('id');
const marca = params.get('marca');
const modelo = params.get('modelo');

document.addEventListener("DOMContentLoaded", function () {
    fetch(`http://127.0.0.1:3000/pro/${id}?marca=${marca}&modelo=${modelo}`)
        .then((res) => res.json())
        .then((dados) => {
            const corpoTabela = document.getElementById("corpoTabela");
            corpoTabela.innerHTML = ""; // Limpa o conteúdo atual da tabela

            dados.forEach((dado) => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                            <td>${dado.prodes}</td>
                            <td>${dado.provl}</td>
                            <td>
                                <a href="#"><button class="btn btn-success btn-sm">Adicionar</button></a>
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