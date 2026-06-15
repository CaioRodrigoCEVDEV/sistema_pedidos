const params = new URLSearchParams(window.location.search);
const id = parseIntegerParam(params.get("id"));
const marcascod = parseIntegerParam(params.get("marcascod"));

function parseIntegerParam(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = String(value).trim().toLowerCase();

  if (
    normalizedValue === "" ||
    normalizedValue === "null" ||
    normalizedValue === "undefined"
  ) {
    return null;
  }

  const parsed = Number(normalizedValue);

  return Number.isInteger(parsed) ? parsed : null;
}

function buildPecasHref(modeloId, marcaId) {
  const parsedModeloId = parseIntegerParam(modeloId);
  const parsedMarcaId = parseIntegerParam(marcaId);

  if (parsedModeloId === null || parsedMarcaId === null) {
    return null;
  }

  const query = new URLSearchParams({
    id: String(parsedModeloId),
    marcascod: String(parsedMarcaId),
  });

  return `modelo/pecas?${query.toString()}`;
}

//popular table com os dados do modelo
document.addEventListener("DOMContentLoaded", function () {
  if (id === null) {
    return;
  }

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
          const href = buildPecasHref(dado.modcod, dado.modmarcascod);
          tr.innerHTML = `
                      <td class="text-left">${dado.moddes}</td> 
                      <td class="text-center">
                        ${
                          href
                            ? `<a href="${href}"><button class="btn btn-outline-success btn-sm">Selecionar <i class="bi bi-caret-right-fill"></i></button></a>`
                            : '<button class="btn btn-outline-success btn-sm" disabled>Selecionar</button>'
                        }
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

    if (marcascod === null) {
      alert("Marca inválida ou não informada.");
      return;
    }

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
if (marcascod !== null) {
  fetch(`${BASE_URL}/marcas/${marcascod}`)
    .then((res) => res.json())
    .then((marcas) => {
      document.getElementById("marcaTitulo").textContent =
        marcas[0].marcasdes || "Marca não encontrada";
    })
    .catch(() => {
      document.getElementById("marcaTitulo").textContent = "";
    });
}
