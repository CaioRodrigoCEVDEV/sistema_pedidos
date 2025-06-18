const params = new URLSearchParams(window.location.search);

const id = params.get('id');
const modelo = params.get('modelo');
const marcascod = params.get('marcascod');

document.addEventListener("DOMContentLoaded", function () {
    fetch(`http://127.0.0.1:3000/pro/${id}?marca=${marcascod}&modelo=${modelo}`)
        .then((res) => res.json())
        .then((dados) => {
            const corpoTabela = document.getElementById("corpoTabela");
            corpoTabela.innerHTML = ""; // Limpa o conteúdo atual da tabela

            dados.forEach((dado) => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                  <td>${dado.prodes}</td>
                  <td>${dado.provl}</td>
                  <td><input type="number" style="width:40px" id="qtde_peca_${dado.procod}"></td>
                  <td>
                    <button class="btn btn-success btn-sm" onclick="adicionarAoCarrinho('${dado.procod}')">Adicionar</button>
                  </td>
                `;

                // Função global para adicionar ao carrinho com a quantidade informada
                window.adicionarAoCarrinho = function(procod) {
                  const input = document.getElementById(`qtde_peca_${procod}`);
                  const qtde = input ? input.value : 1;
                  window.location.href = `carrinho?id=${procod}&qtde=${qtde}`;
                };
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

// Busca o nome da marca pelo id usando fetch e exibe no elemento com id 'marcaTitulo'
fetch(`http://127.0.0.1:3000/marcas/${marcascod}`)
  .then(res => res.json())
  .then(marcas => {
    document.getElementById('marcaTitulo').textContent = marcas[0].marcasdes || 'Marca não encontrada';
  })
  .catch(() => {
    document.getElementById('marcaTitulo').textContent = '';
  });