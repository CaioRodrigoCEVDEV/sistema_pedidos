const params = new URLSearchParams(window.location.search);

const id = params.get('id');
const marcascod = params.get('marcascod');

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
                        <a href="lista-pecas?id=${dado.tipocod}&marcascod=${dado.promarcascod}&modelo=${dado.promodcod}"><button class="btn btn-success btn-sm">Selecionar</button></a>
                      </td>
                        `;
        corpoTabela.appendChild(tr);
      });
    })
    .catch((erro) => console.error(erro));
});

// Busca o nome da marca pelo id usando fetch e exibe no elemento com id 'marcaTitulo'
fetch(`http://127.0.0.1:3000/marcas/${marcascod}`)
  .then(res => res.json())
  .then(marcas => {
    document.getElementById('marcaTitulo').textContent = marcas[0].marcasdes || 'Marca não encontrada';
  })
  .catch(() => {
    document.getElementById('marcaTitulo').textContent = '';
  });