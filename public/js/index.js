const params = new URLSearchParams(window.location.search);
const id = params.get('id');

//popular table com os dados do modelo
document.addEventListener("DOMContentLoaded", function () {
fetch(`http://127.0.0.1:3000/marcas/`)
    .then((res) => res.json())
    .then((dados) => {
      const corpoTabela = document.getElementById("marcaTitulo");
      corpoTabela.innerHTML = ""; // Limpa o conteúdo atual da tabela

      dados.forEach((dado) => {
        const div = document.createElement("div");
        div.innerHTML = `
                        <div class="col-md-4 mb-3">
                            <div class="card">
                                <div class="card-body">
                                    <a href="modelo?id=${dado.marcascod}&marcascod=${dado.marcascod}"><button class="btn btn-primary btn-block">${dado.marcasdes}</button></a>
                                </div>
                            </div>
                        </div>
                        `;
        corpoTabela.appendChild(div);
      });
    })
    .catch((erro) => console.error(erro));
});
