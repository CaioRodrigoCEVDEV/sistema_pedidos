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

// Ícone do tipo vem de public/js/tipo-icon.js (fonte única, compartilhada
// com a lista de peças).
const getTipoIcon = (nome) => window.OrderUpTipoIcon(nome);

// Plural simples do nome do tipo (1ª palavra), com fallback neutro.
// Ex.: TELA -> telas, PLACA DE CARGA -> placas de carga.
function pluralizarTipo(nome) {
  const texto = String(nome || "").trim();
  if (!texto) return null;

  const partes = texto.split(/\s+/);
  const palavra = partes[0].toLowerCase();
  const resto = partes.slice(1).join(" ").toLowerCase();

  let plural;
  if (/[aeiou]$/.test(palavra)) plural = palavra + "s";
  else if (/[rz]$/.test(palavra)) plural = palavra + "es";
  else if (/m$/.test(palavra)) plural = palavra.slice(0, -1) + "ns";
  else if (/s$/.test(palavra)) plural = palavra;
  else return null; // pluralização incerta -> usa "itens"

  return resto ? `${plural} ${resto}` : plural;
}

// Texto da quantidade real de peças do tipo, deixando claro que são
// variantes daquele tipo. Ex.: "8 tipos de telas disponíveis",
// "1 tipo de bateria disponível".
function textoQuantidade(total, tipoNome) {
  const n = Number(total) || 0;
  const singular = String(tipoNome || "").trim().toLowerCase();

  if (n === 1) {
    return `1 tipo de ${singular || "item"} disponível`;
  }

  const plural = pluralizarTipo(tipoNome);
  return plural
    ? `${n} tipos de ${plural} disponíveis`
    : `${n} itens disponíveis`;
}

// Monta o card de categoria (inteiro clicável) para um tipo de peça.
function criarCardTipo(dado) {
  const href = buildListaPecasHref(
    dado.tipocod,
    dado.promarcascod,
    dado.promodcod
  );
  const nome = String(dado.tipodes || "Tipo").replace(/</g, "&lt;");
  const icone = getTipoIcon(dado.tipodes);
  const quantidade = textoQuantidade(dado.total, dado.tipodes);

  if (!href) {
    const card = document.createElement("div");
    card.className = "ou-catalog-card ou-catalog-card--disabled";
    card.innerHTML = `
      <span class="ou-catalog-card__icon"><i class="bi ${icone}" aria-hidden="true"></i></span>
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
    `Ver peças do tipo ${dado.tipodes || "Tipo"} — ${quantidade}`
  );
  card.innerHTML = `
    <span class="ou-catalog-card__icon"><i class="bi ${icone}" aria-hidden="true"></i></span>
    <span class="ou-catalog-card__body">
      <span class="ou-catalog-card__name">${nome}</span>
      <span class="ou-catalog-card__qty">${quantidade}</span>
    </span>
    <span class="ou-catalog-card__arrow" aria-hidden="true"><i class="bi bi-arrow-right"></i></span>
  `;
  return card;
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

  fetch(`${BASE_URL}/tipo/${id}?comTotal=1`)
    .then((res) => res.json())
    .then((dados) => {
      if (!corpoTabela) return;
      corpoTabela.innerHTML = ""; // Limpa o conteúdo atual

      if (!Array.isArray(dados) || dados.length === 0) {
        corpoTabela.innerHTML = `<div class="ou-empty"><span class="ou-empty__icon"><i class="bi bi-inbox"></i></span><div class="ou-empty__title">Nenhum tipo encontrado</div><div class="ou-empty__text">Nenhum tipo de peça para este modelo.</div></div>`;
        return;
      }

      dados.forEach((dado) => {
        corpoTabela.appendChild(criarCardTipo(dado));
      });
    })
    .catch((erro) => {
      console.error(erro);
      if (corpoTabela) corpoTabela.innerHTML = `<div class="ou-empty"><span class="ou-empty__icon"><i class="bi bi-exclamation-triangle"></i></span><div class="ou-empty__title">Erro ao carregar</div><div class="ou-empty__text">Tente novamente em instantes.</div></div>`;
    });
});

// Filtro local por tipo (mantém a regra: apenas esconde/mostra os cards)
document.addEventListener("DOMContentLoaded", function () {
  const input = document.getElementById("pesquisa");
  if (!input) return;
  input.addEventListener("input", function () {
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

    // Estado vazio amigável quando a busca não retorna nenhum tipo
    const semResultado = document.getElementById("tiposSemResultado");
    const grid = document.getElementById("corpoTabela");
    const esconderGrid = pesquisa !== "" && cards.length > 0 && visiveis === 0;
    if (semResultado) semResultado.style.display = esconderGrid ? "" : "none";
    if (grid) grid.style.display = esconderGrid ? "none" : "";
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
