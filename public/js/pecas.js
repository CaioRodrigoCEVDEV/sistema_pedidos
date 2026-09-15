const params = new URLSearchParams(window.location.search);

const id = parseIntegerParam(params.get("id"));
const marcascod = parseIntegerParam(params.get("marcascod"));
const modeloscod = parseIntegerParam(params.get("modeloscod"));

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

function buildListaPecasHref(tipoId, marcaId, modeloId) {
  const parsedTipoId = parseIntegerParam(tipoId);
  const parsedMarcaId = parseIntegerParam(marcaId);
  const parsedModeloId = parseIntegerParam(modeloId);

  if (parsedTipoId === null || parsedMarcaId === null || parsedModeloId === null) {
    return null;
  }

  const query = new URLSearchParams({
    id: String(parsedTipoId),
    marcascod: String(parsedMarcaId),
    modelo: String(parsedModeloId),
  });

  return `lista-pecas?${query.toString()}`;
}

//Busca o nome do modelo pelo id usando fetch e exibe no elemento com id 'modeloTitulo'
if (id !== null) {
  fetch(`${BASE_URL}/mod/${id}`)
    .then((res) => res.json())
    .then((modelo) => {
      const nome = Array.isArray(modelo) ? modelo[0]?.moddes : modelo?.moddes;
      document.getElementById("modeloTitulo").textContent =
        nome || "Modelo não encontrado";
    })

    .catch(() => {
      document.getElementById("modeloTitulo").textContent = "";
    });
}

//popular lista com os dados do modelo
document.addEventListener("DOMContentLoaded", function () {
  const corpoTabela = document.getElementById("corpoTabela");
  if (id === null) {
    if (corpoTabela) corpoTabela.innerHTML = `<div class="ou-empty"><span class="ou-empty__icon"><i class="bi bi-tools"></i></span><div class="ou-empty__title">Modelo não informado</div><div class="ou-empty__text">Volte e selecione um modelo.</div></div>`;
    return;
  }

  fetch(`${BASE_URL}/tipo/${id}`)
    .then((res) => res.json())
    .then((dados) => {
      if (!corpoTabela) return;
      corpoTabela.innerHTML = ""; // Limpa o conteúdo atual

      if (!Array.isArray(dados) || dados.length === 0) {
        corpoTabela.innerHTML = `<div class="ou-empty"><span class="ou-empty__icon"><i class="bi bi-inbox"></i></span><div class="ou-empty__title">Nenhum tipo encontrado</div><div class="ou-empty__text">Nenhum tipo de peça para este modelo.</div></div>`;
        return;
      }

      dados.forEach((dado) => {
        const href = buildListaPecasHref(
          dado.tipocod,
          dado.promarcascod,
          dado.promodcod,
        );
        const item = document.createElement("div");
        item.className = "ou-result-item";
        const safeName = String(dado.tipodes || "Tipo").replace(/</g, "&lt;");
        item.innerHTML = `
          <div class="ou-result-item__main">
            <div class="ou-result-item__name">${safeName}</div>
          </div>
          ${
            href
              ? `<a href="${href}"><button class="btn btn-primary btn-sm">Selecionar <i class="bi bi-arrow-right-short"></i></button></a>`
              : '<button class="btn btn-secondary btn-sm" disabled>Selecionar</button>'
          }
        `;
        corpoTabela.appendChild(item);
      });
    })
    .catch((erro) => {
      console.error(erro);
      if (corpoTabela) corpoTabela.innerHTML = `<div class="ou-empty"><span class="ou-empty__icon"><i class="bi bi-exclamation-triangle"></i></span><div class="ou-empty__title">Erro ao carregar</div><div class="ou-empty__text">Tente novamente em instantes.</div></div>`;
    });
});

// Filtro local por tipo
document.addEventListener("DOMContentLoaded", function () {
  const input = document.getElementById("pesquisa");
  if (!input) return;
  input.addEventListener("input", function () {
    const pesquisa = this.value.toLowerCase();
    document.querySelectorAll("#corpoTabela .ou-result-item").forEach((linha) => {
      const celula = linha.querySelector(".ou-result-item__name");
      const txt = celula ? celula.textContent.toLowerCase() : "";
      linha.style.display = txt.includes(pesquisa) ? "" : "none";
    });
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

// Carrinho/badge/modal/toast centralizados em storefront-shared.js.
// Mantido apenas o adicionar específico desta página (sem cores).
window.adicionarAoCarrinho = function (procod) {
  const input = document.getElementById(`qtde_peca_${procod}`);
  const qtde = input ? parseInt(input.value, 10) || 1 : 1;

  // Busca os dados do item correspondente (lista nova ou tabela legada)
  const row = input ? input.closest(".ou-result-item, tr") : null;
  const nome = row ? (row.querySelector(".ou-result-item__name") || row.querySelector("td") || {}).textContent || "Produto" : "Produto";
  const preco = parseFloat((row && row.dataset && row.dataset.preco) || 0);

  // Recupera o carrinho do localStorage
  let cart = JSON.parse(localStorage.getItem("cart") || "[]");

  // Verifica se o item já existe no carrinho
  const idx = cart.findIndex((item) => item.id === procod);
  if (idx > -1) {
    cart[idx].qt += qtde;
  } else {
    cart.push({ id: procod, nome, qt: qtde, preco });
  }

  // Salva o carrinho atualizado
  localStorage.setItem("cart", JSON.stringify(cart));

  // Atualiza ícone do carrinho
  if (window.ouStorefront) window.ouStorefront.atualizarIconeCarrinho();

  // Mostra popup de confirmação
  if (window.ouStorefront) window.ouStorefront.mostrarPopupAdicionado();
};
