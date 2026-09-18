(function () {
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

// Texto da quantidade real de tipos de peça do modelo.
function textoTotalTipos(total) {
  const n = Number(total) || 0;
  if (n === 0) return "Nenhum tipo de peça disponível";
  if (n === 1) return "1 tipo de peça disponível";
  return `${n} tipos de peças disponíveis`;
}

// Monta o card do modelo no mesmo padrão visual da tela de tipos.
function criarCardModelo(dado) {
  const href = buildPecasHref(dado.modcod, dado.modmarcascod);
  const nome = String(dado.moddes || "Modelo").replace(/</g, "&lt;");
  const quantidade = textoTotalTipos(dado.total_tipos);

  if (!href) {
    const card = document.createElement("div");
    card.className = "ou-catalog-card ou-catalog-card--disabled";
    card.innerHTML = `
      <span class="ou-catalog-card__icon"><i class="bi bi-phone" aria-hidden="true"></i></span>
      <span class="ou-catalog-card__body">
        <span class="ou-catalog-card__name">${nome}</span>
        <span class="ou-catalog-card__qty">${quantidade}</span>
      </span>
    `;
    return card;
  }

  const card = document.createElement("a");
  card.className = "ou-catalog-card";
  card.href = href;
  card.setAttribute(
    "aria-label",
    `Ver tipos de peça do modelo ${dado.moddes || "Modelo"} — ${quantidade}`
  );
  card.innerHTML = `
    <span class="ou-catalog-card__icon"><i class="bi bi-phone" aria-hidden="true"></i></span>
    <span class="ou-catalog-card__body">
      <span class="ou-catalog-card__name">${nome}</span>
      <span class="ou-catalog-card__qty">${quantidade}</span>
    </span>
    <span class="ou-catalog-card__arrow" aria-hidden="true"><i class="bi bi-arrow-right"></i></span>
  `;
  return card;
}

//popular lista com os dados do modelo
ouOnLoad(function () {
  const corpoTabela = document.getElementById("corpoTabela");
  if (id === null) {
    if (corpoTabela) corpoTabela.innerHTML = `<div class="ou-empty"><span class="ou-empty__icon"><i class="bi bi-phone"></i></span><div class="ou-empty__title">Marca não informada</div><div class="ou-empty__text">Volte e selecione uma marca.</div></div>`;
    return;
  }

  fetch(`${BASE_URL}/modelo/${id}?comTotal=1`)
    .then((res) => res.json())
    .then((dados) => {
      if (!corpoTabela) return;
      corpoTabela.innerHTML = ""; // Limpa o conteúdo atual

      if (!Array.isArray(dados) || dados.length === 0) {
        corpoTabela.innerHTML = `<div class="ou-empty"><span class="ou-empty__icon"><i class="bi bi-inbox"></i></span><div class="ou-empty__title">Nenhum modelo encontrado</div><div class="ou-empty__text">Nenhum modelo cadastrado para esta marca.</div></div>`;
        return;
      }

      dados.forEach((dado) => {
        corpoTabela.appendChild(criarCardModelo(dado));
      });
    })
    .catch((erro) => {
      console.error(erro);
      if (corpoTabela) corpoTabela.innerHTML = `<div class="ou-empty"><span class="ou-empty__icon"><i class="bi bi-exclamation-triangle"></i></span><div class="ou-empty__title">Erro ao carregar</div><div class="ou-empty__text">Tente novamente em instantes.</div></div>`;
    });
});

// Busca o nome da marca pelo id e exibe no breadcrumb
if (marcascod !== null) {
  fetch(`${BASE_URL}/marcas/${marcascod}`)
    .then((res) => res.json())
    .then((marcas) => {
      const el = document.getElementById("marcaTitulo");
      if (el) {
        el.textContent =
          (Array.isArray(marcas) && marcas[0] && marcas[0].marcasdes) ||
          "Marca não encontrada";
      }
    })
    .catch(() => {
      const el = document.getElementById("marcaTitulo");
      if (el) el.textContent = "";
    });
}

// função para pesquisar modelo usando o input com id "pesquisa"
document.getElementById("pesquisa").addEventListener("input", function () {
  const pesquisa = this.value.trim().toLowerCase();
  const cards = document.querySelectorAll("#corpoTabela .ou-catalog-card");
  let visiveis = 0;

  cards.forEach((card) => {
    const celula = card.querySelector(".ou-catalog-card__name");
    const txt = celula ? celula.textContent.toLowerCase() : "";
    const combina = txt.includes(pesquisa);
    card.style.display = combina ? "" : "none";
    if (combina) visiveis++;
  });

  // Estado vazio amigável quando a busca não retorna nenhum modelo
  const semResultado = document.getElementById("modelosSemResultado");
  const grid = document.getElementById("corpoTabela");
  const esconderGrid = pesquisa !== "" && cards.length > 0 && visiveis === 0;
  if (semResultado) semResultado.style.display = esconderGrid ? "" : "none";
  if (grid) grid.style.display = esconderGrid ? "none" : "";
});

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

})();
