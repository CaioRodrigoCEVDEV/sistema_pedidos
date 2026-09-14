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

  return `pecas?${query.toString()}`;
}

//popular lista com os dados do modelo
document.addEventListener("DOMContentLoaded", function () {
  const corpoTabela = document.getElementById("corpoTabela");
  if (id === null) {
    if (corpoTabela) corpoTabela.innerHTML = `<div class="ou-empty"><span class="ou-empty__icon"><i class="bi bi-phone"></i></span><div class="ou-empty__title">Marca não informada</div><div class="ou-empty__text">Volte e selecione uma marca.</div></div>`;
    return;
  }

  fetch(`${BASE_URL}/modelo/${id}`)
    .then((res) => res.json())
    .then((dados) => {
      if (!corpoTabela) return;
      corpoTabela.innerHTML = ""; // Limpa o conteúdo atual

      if (!Array.isArray(dados) || dados.length === 0) {
        corpoTabela.innerHTML = `<div class="ou-empty"><span class="ou-empty__icon"><i class="bi bi-inbox"></i></span><div class="ou-empty__title">Nenhum modelo encontrado</div><div class="ou-empty__text">Nenhum modelo cadastrado para esta marca.</div></div>`;
        return;
      }

      dados.forEach((dado) => {
        const href = buildPecasHref(dado.modcod, dado.modmarcascod);
        const item = document.createElement("div");
        item.className = "ou-result-item";
        const safeName = String(dado.moddes || "Modelo").replace(/</g, "&lt;");
        item.innerHTML = `
          <div class="ou-result-item__main">
            <div class="ou-result-item__name">${safeName}</div>
          </div>
          ${
            href
              ? `<a href="${href}"><button type="button" class="btn btn-primary btn-sm">Selecionar <i class="bi bi-arrow-right-short"></i></button></a>`
              : '<button type="button" class="btn btn-secondary btn-sm" disabled>Selecionar</button>'
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

// função para pesquisar modelo usando o input com id "pesquisa"
document.getElementById("pesquisa").addEventListener("input", function () {
  const pesquisa = this.value.toLowerCase();
  const linhas = document.querySelectorAll("#corpoTabela .ou-result-item");

  linhas.forEach((linha) => {
    const celula = linha.querySelector(".ou-result-item__name");
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

function toBase64Url(obj) {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return JSON.parse(atob(base64));
}
