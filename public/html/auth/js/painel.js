const params = new URLSearchParams(window.location.search);
const id = params.get("id");
let marcascod = null;
let marcacodModelo = null;
let tipo = null;
let modelo = null;

function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

document.addEventListener("DOMContentLoaded", () => {
  fetch(`${BASE_URL}/marcas/`)
    .then((res) => res.json())
    .then((dados) => {
      const holder = document.getElementById("painelMarca");
      if (!holder) return;
      holder.innerHTML = ""; // zera antes

      let html = '<option value="">Selecione uma marca</option>';
      dados.forEach((marca) => {
        html += `<option value="${marca.marcascod}"${
          id == marca.marcascod ? " selected" : ""
        }>${marca.marcasdes}</option>`;
      });
      const select = document.getElementById("painelMarca");
      if (select) {
        select.innerHTML = html;
      }

      holder.innerHTML = html;

      holder.addEventListener("change", (e) => {
        marcacodModelo = e.target.value;
      });
    })
    .catch(console.error);
});

document.addEventListener("DOMContentLoaded", () => {
  fetch(`${BASE_URL}/marcas/`)
    .then((res) => res.json())
    .then((dados) => {
      const holder = document.getElementById("selectPainelMarca");
      if (!holder) return;
      holder.innerHTML = ""; // zera antes

      let html = '<option value="">Selecione uma marca</option>';
      dados.forEach((marca) => {
        html += `<option value="${marca.marcascod}"${
          id == marca.marcascod ? " selected" : ""
        }>${marca.marcasdes}</option>`;
      });
      const select = document.getElementById("paineselectPainelMarcalMarca");
      if (select) {
        select.innerHTML = html;
      }

      holder.innerHTML = html;

      const tipoHolder = document.getElementById("selectPainelTipo");
      if (tipoHolder) {
        tipoHolder.addEventListener("change", (e) => {
          tipo = e.target.value; // Atualiza o código do tipo selecionado
          console.log("Tipo selecionado:", tipo);
        });
      }

      holder.addEventListener("change", (e) => {
        marcascod = e.target.value; // Atualiza o código da marca selecionada
        // Atualiza os modelos com base na marca selecionada
        fetch(`${BASE_URL}/modelo/${marcascod}`)
          .then((res) => res.json())
          .then((dados) => {
            const modeloHolder = document.getElementById("selectPainelModelo");
            if (!modeloHolder) return;
            modeloHolder.innerHTML =
              '<option value="">Selecione o Modelo</option>';
            dados.forEach((modelo) => {
              modeloHolder.innerHTML += `<option value="${modelo.modcod}">${modelo.moddes}</option>`;
            });
            console.log("Marca selecionada:", marcascod);

            modeloHolder.addEventListener("change", (e) => {
              modelo = e.target.value; // Atualiza o código do modelo selecionado
              console.log("Modelo selecionado:", modelo);
            });
          })
          .catch(console.error);
      });
    })
    .catch(console.error);
});

document.addEventListener("DOMContentLoaded", () => {
  fetch(`${BASE_URL}/tipos/`)
    .then((res) => res.json())
    .then((dados) => {
      const holder = document.getElementById("selectPainelTipo");
      if (!holder) return;
      holder.innerHTML = ""; // zera antes

      let html = '<option value="">Selecione o tipo</option>';
      dados.forEach((tipo) => {
        html += `<option value="${tipo.tipocod}"${
          id == tipo.tipocod ? " selected" : ""
        }>${tipo.tipodes}</option>`;
      });
      const select = document.getElementById("selectPainelTipo");
      if (select) {
        select.innerHTML = html;
      }

      holder.innerHTML = html;
    })
    .catch(console.error);
});

//Função para criar marca
document
  .getElementById("cadastrarPainelMarca")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    fetch(`${BASE_URL}/marcas`, {
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

//função para criar modelo
document
  .getElementById("cadastrarPainelModelo")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    data.modmarcascod = marcacodModelo;

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

//função para criar modelo
document
  .getElementById("cadastrarPainelTipo")
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

//função para criar modelo
document
  .getElementById("cadastrarPainelPeca")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    data.promarcascod = marcascod; // Adiciona o código da marca ao objeto data
    data.promodcod = modelo; // Adiciona o código do modelo ao objeto data
    data.protipocod = tipo; // Adiciona o código do tipo ao objeto data

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

const inputPesquisa = document.getElementById("pesquisa");
const tabelaArea = document.getElementById("tabelaArea");
const cardsArea = document.getElementById("cardsArea");
const corpoTabela = document.getElementById("corpoTabela");

inputPesquisa.addEventListener("input", function () {
  const pesquisa = this.value.trim().toLowerCase();

  if (!pesquisa) {
    tabelaArea.style.display = "none"; // esconde tabela
    cardsArea.style.display = "block"; // mostra cards
    corpoTabela.innerHTML = ""; // limpa tabela
    return;
  }

  fetch(`${BASE_URL}/pros/`)
    .then((res) => res.json())
    .then((produtos) => {
      const filtrados = produtos.filter(
        (produto) =>
          produto.prodes && produto.prodes.toLowerCase().includes(pesquisa)
      );

      if (filtrados.length === 0) {
        tabelaArea.style.display = "none"; // esconde tabela se nada encontrado
        cardsArea.style.display = "block"; // mostra cards
        corpoTabela.innerHTML = "";
        return;
      }

      corpoTabela.innerHTML = "";
      filtrados.forEach((produto) => {
        const tr = document.createElement("tr");
        tr.dataset.preco = produto.provl;
        tr.innerHTML = `
          <td>${produto.prodes}</td>
          <td>${formatarMoeda(produto.provl)}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="editarProduto('${produto.procod}')">
              <i class="fa fa-edit"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="excluirProduto('${produto.procod}')">
              <i class="fa fa-trash"></i>
            </button>
          </td>
        `;
        corpoTabela.appendChild(tr);
      });

      tabelaArea.style.display = "block"; // mostra tabela
      cardsArea.style.display = "none"; // esconde cards
    })
    .catch((error) => {
      console.error("Erro no fetch:", error);
      tabelaArea.style.display = "none";
      cardsArea.style.display = "block";
      corpoTabela.innerHTML = "";
    });
});

function editarProduto(codigo) {
  fetch(`${BASE_URL}/pro/painel/${codigo}`)
    .then((res) => res.json())
    .then((produto) => {
      console.log(codigo, produto);
      // Cria o popup
      let popup = document.createElement("div");
      popup.id = "popupEditarProduto";
      popup.style.position = "fixed";
      popup.style.top = "0";
      popup.style.left = "0";
      popup.style.width = "100vw";
      popup.style.height = "100vh";
      popup.style.background = "rgba(0,0,0,0.5)";
      popup.style.display = "flex";
      popup.style.alignItems = "center";
      popup.style.justifyContent = "center";
      popup.style.zIndex = "9999";

      // Preenche os campos com os dados carregados do produto
      popup.innerHTML = `
        <div style="background:#fff;padding:24px;border-radius:8px;min-width:300px;max-width:90vw;">
          <h5>Editar Produto</h5>
          <form id="formEditarProduto">
            <div class="mb-3">
              <label for="editarDescricao" class="form-label">Descrição</label>
              <input type="text" class="form-control" id="editarDescricao" name="prodes" value="${
                produto[0].prodes || ""
              }" required>
            </div>
            <div class="mb-3">
              <label for="editarValor" class="form-label">Valor</label>
              <input type="number" step="0.01" class="form-control" id="editarValor" name="provl" value="${
                produto[0].provl || ""
              }" required>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
              <button type="button" class="btn btn-secondary" id="cancelarEditarProduto">Cancelar</button>
              <button type="submit" class="btn btn-primary">Salvar</button>
            </div>
          </form>
        </div>
      `;

      document.body.appendChild(popup);

      document.getElementById("cancelarEditarProduto").onclick = function () {
        document.body.removeChild(popup);
      };

      document.getElementById("formEditarProduto").onsubmit = function (e) {
        e.preventDefault();
        const prodes = document.getElementById("editarDescricao").value.trim();
        const provl = document.getElementById("editarValor").value;

        fetch(`${BASE_URL}/pro/${codigo}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prodes, provl }),
        })
          .then((res) => res.json())
          .then(() => {
            alert("Produto atualizado com sucesso!");
            document.body.removeChild(popup);
            location.reload();
          })
          .catch((erro) => {
            alert("Erro ao atualizar o produto.");
            console.error(erro);
          });
      };
    })
    .catch((erro) => {
      alert("Erro ao buscar os dados do produto.");
      console.error(erro);
    });
}

// Função para excluir produto
function excluirProduto(codigo) {
  if (confirm("Tem certeza que deseja excluir este produto?")) {
    fetch(`${BASE_URL}/pro/${codigo}`, {
      method: "DELETE",
    })
      .then((res) => res.json())
      .then((resposta) => {
        alert("Produto excluído com sucesso!");
        location.reload(); // Atualiza a página após exclusão
      })
      .catch((erro) => {
        alert("Erro ao excluir o produto.");
        console.error(erro);
      });
  }
}

// Impede que o dropdown feche ao clicar em qualquer elemento dentro dele
document.querySelectorAll(".dropdown-menu").forEach(function (menu) {
  menu.addEventListener("click", function (e) {
    e.stopPropagation();
  });
});

// Carrega os totais de marcas, modelos, tipos e peças
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const [marcas, modelos, tipos, pecas] = await Promise.all([
      fetch(`${BASE_URL}/marcas`).then((r) => r.json()),
      fetch(`${BASE_URL}/modelos`).then((r) => r.json()),
      fetch(`${BASE_URL}/tipos`).then((r) => r.json()),
      fetch(`${BASE_URL}/pros`).then((r) => r.json()),
    ]);

    document.getElementById("totalMarcas").textContent = marcas.length;
    document.getElementById("totalModelos").textContent = modelos.length;
    document.getElementById("totalTipos").textContent = tipos.length;
    document.getElementById("totalPecas").textContent = pecas.length;
  } catch (err) {
    console.error("Erro ao carregar totais", err);
  }
});
