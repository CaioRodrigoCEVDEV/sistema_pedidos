(function () {
const params = new URLSearchParams(window.location.search);

const id = parseIntegerParam(params.get("id"));
const modelo = parseIntegerParam(params.get("modelo"));
const marcascod = parseIntegerParam(params.get("marcascod"));

// Nome do modelo (preenchido ao carregar) — guardado no item do carrinho
// para enriquecer a exibição (campo opcional; itens antigos não possuem).
let modeloAtual = "";

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

function buildProdutosUrl(tipoId, marcaId, modeloId) {
  const parsedTipoId = parseIntegerParam(tipoId);
  const parsedMarcaId = parseIntegerParam(marcaId);
  const parsedModeloId = parseIntegerParam(modeloId);

  if (parsedTipoId === null || parsedMarcaId === null || parsedModeloId === null) {
    return null;
  }

  const query = new URLSearchParams({
    marca: String(parsedMarcaId),
    modelo: String(parsedModeloId),
  });

  return `${BASE_URL}/pro/${parsedTipoId}?${query.toString()}`;
}

function buildTipoUrl(tipoId, modeloId) {
  const parsedTipoId = parseIntegerParam(tipoId);
  const parsedModeloId = parseIntegerParam(modeloId);

  if (parsedTipoId === null || parsedModeloId === null) {
    return null;
  }

  const query = new URLSearchParams({ modelo: String(parsedModeloId) });

  return `${BASE_URL}/modtipo/${parsedTipoId}?${query.toString()}`;
}

/**
 * Formata um valor numérico para moeda brasileira (BRL)
 * @param {number} valor - Valor a ser formatado
 * @returns {string} Valor formatado (ex: R$ 10,00)
 */
function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Estado da listagem (dados já carregados; filtro/ordenação locais).
let todasAsPecas = [];
let pesquisaAtual = "";
let ordenacaoAtual = "ordem-asc";
let dadosCarregados = false;
let pecasVisiveis = [];
let podeCompartilharPecas = false;

async function validarCompartilhamento() {
  const botao = document.getElementById("compartilharPecas");
  podeCompartilharPecas = false;
  if (botao) botao.hidden = true;
  try {
    const resposta = await fetch(`${BASE_URL}/me/usuario`, {
      credentials: "include", cache: "no-store",
    });
    const usuario = resposta.ok ? await resposta.json() : null;
    podeCompartilharPecas = Boolean(usuario?.usunome);
  } catch (_) {
    podeCompartilharPecas = false;
  }
  if (botao) {
    botao.hidden = !podeCompartilharPecas;
    botao.disabled = !podeCompartilharPecas || pecasVisiveis.length === 0;
  }
}

function compartilharPecas() {
  if (!podeCompartilharPecas || !dadosCarregados || !pecasVisiveis.length) return;
  const marca = document.getElementById("marcaTitulo")?.textContent || "";
  const itens = pecasVisiveis.map((peca) => ({
    nome: peca.prodes || "Peça",
    tipo: peca.tipodes || "",
    modelo: modeloAtual,
    marca,
    qt: 1,
    preco: peca.provlpromo != null ? peca.provlpromo : peca.provl,
  }));
  const mensagem = window.OrderUpMensagemPecas(itens, "", "ORÇAMENTO DE PEÇAS:", true);
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`;
  const popup = window.open(url, "_blank");
  if (popup) popup.opener = null;
  else window.location.href = url;
}

document.getElementById("compartilharPecas")?.addEventListener("click", compartilharPecas);

// Contador de resultados com concordância singular/plural.
function atualizarContadorPecas(total) {
  const el = document.getElementById("resultadoQuantidade");
  if (!el) return;
  const n = Number(total) || 0;
  if (n === 0) el.textContent = "Nenhuma peça encontrada";
  else if (n === 1) el.textContent = "1 peça encontrada";
  else el.textContent = `${n} peças encontradas`;
}

// Status de estoque derivado dos dados reais (sem inventar quantidade).
// prosemest 'S' = sem estoque; proacabando 'S' = últimas unidades.
function obterStatusPeca(dado) {
  if (dado.prosemest === "S") {
    return {
      classe: "ou-product-card__status--out",
      texto: "Sem estoque",
      disponivel: false,
    };
  }
  if (dado.proacabando === "S") {
    return {
      classe: "ou-product-card__status--low",
      texto: "Últimas unidades",
      disponivel: true,
    };
  }
  return {
    classe: "ou-product-card__status--in",
    texto: "Em estoque",
    disponivel: true,
  };
}

// Monta o card da peça reaproveitando os padrões visuais do catálogo.
function criarCardPeca(dado) {
  const status = obterStatusPeca(dado);
  const nome = String(dado.prodes || "Peça").replace(/</g, "&lt;");
  const tipo = String(dado.tipodes || "").replace(/</g, "&lt;");
  const icone = window.OrderUpTipoIcon(dado.tipodes);

  // Preço sempre vindo do servidor: provlpromo é o preço promocional efetivo
  // (null quando não há promoção ativa).
  const precoOriginal = Number(dado.provl) || 0;
  const temPromocao =
    dado.provlpromo !== null && dado.provlpromo !== undefined;
  const preco = temPromocao ? Number(dado.provlpromo) || 0 : precoOriginal;
  const desconto =
    temPromocao && precoOriginal > 0
      ? Math.round((1 - preco / precoOriginal) * 100)
      : 0;

  const botao = status.disponivel
    ? `<button type="button" class="btn btn-success btn-sm ou-product-card__add" data-add-procod="${dado.procod}" onclick="adicionarAoCarrinho('${dado.procod}')">Adicionar</button>`
    : '<button type="button" class="btn btn-secondary btn-sm ou-product-card__add" disabled title="Indisponível">Indisponível</button>';

  const badgePromo = temPromocao
    ? `<span class="ou-product-card__promo" title="Produto em promoção"><i class="bi bi-tag-fill" aria-hidden="true"></i>${desconto > 0 ? "-" + desconto + "%" : "PROMO"}</span>`
    : "";

  const precoHtml = temPromocao
    ? `<div class="ou-product-card__price ou-product-card__price--promo">
         <span class="ou-product-card__price-old">${formatarMoeda(precoOriginal)}</span>
         <span class="ou-product-card__price-value">${formatarMoeda(preco)}</span>
       </div>`
    : `<div class="ou-product-card__price">${formatarMoeda(preco)}</div>`;

  const card = document.createElement("article");
  card.className = "ou-product-card";
  card.dataset.preco = preco;
  card.dataset.precoOriginal = temPromocao ? precoOriginal : "";
  card.innerHTML = `
    <span class="ou-product-card__icon"><i class="bi ${icone}" aria-hidden="true"></i></span>
    <div class="ou-product-card__main">
      <h3 class="ou-product-card__name">${nome}</h3>
      <div class="ou-product-card__meta">
        ${badgePromo}
        ${tipo ? `<span class="ou-product-card__type">${tipo}</span>` : ""}
        <span class="ou-product-card__status ${status.classe}">${status.texto}</span>
      </div>
    </div>
    <div class="ou-product-card__aside">
      ${precoHtml}
      ${botao}
    </div>
  `;
  return card;
}

// Aplica pesquisa + ordenação sobre os dados já carregados e renderiza.
function renderPecas() {
  if (!dadosCarregados) return; // mantém o loading até a primeira carga
  const corpoTabela = document.getElementById("corpoTabela");
  if (!corpoTabela) return;

  const termo = pesquisaAtual.trim().toLowerCase();
  const lista = todasAsPecas.filter((dado) =>
    String(dado.prodes || "").toLowerCase().includes(termo)
  );

  const [campo, direcao] = ordenacaoAtual.split("-");
  if (campo === "nome") {
    lista.sort((a, b) =>
      String(a.prodes || "").localeCompare(String(b.prodes || ""), "pt-BR", {
        sensitivity: "base",
        numeric: true,
      })
    );
  } else if (campo === "preco") {
    lista.sort((a, b) => (Number(a.provl) || 0) - (Number(b.provl) || 0));
  }
  if (direcao === "desc") lista.reverse();
  pecasVisiveis = lista;
  const compartilhar = document.getElementById("compartilharPecas");
  if (compartilhar) compartilhar.disabled = !podeCompartilharPecas || lista.length === 0;

  corpoTabela.innerHTML = "";
  lista.forEach((dado) => corpoTabela.appendChild(criarCardPeca(dado)));

  atualizarContadorPecas(lista.length);

  const semResultado = document.getElementById("pecasSemResultado");
  const semProdutos = todasAsPecas.length === 0;
  const semBusca = !semProdutos && lista.length === 0 && termo !== "";

  if (semProdutos) {
    corpoTabela.innerHTML = `<div class="ou-empty"><span class="ou-empty__icon"><i class="bi bi-inbox"></i></span><div class="ou-empty__title">Nenhuma peça encontrada</div><div class="ou-empty__text">Nenhuma peça cadastrada para este filtro.</div></div>`;
    corpoTabela.style.display = "";
    if (semResultado) semResultado.style.display = "none";
    return;
  }

  corpoTabela.style.display = semBusca ? "none" : "";
  if (semResultado) semResultado.style.display = semBusca ? "" : "none";
}

// Feedback rápido no próprio botão após adicionar (sem modal).
function mostrarFeedbackAdicionado(procod) {
  const btn = document.querySelector(
    `#corpoTabela [data-add-procod="${procod}"]`
  );
  if (!btn || btn.dataset.feedbackAtivo === "1") return;

  btn.dataset.feedbackAtivo = "1";
  const original = btn.innerHTML;
  btn.innerHTML = 'Adicionado <i class="bi bi-check-lg" aria-hidden="true"></i>';

  window.setTimeout(() => {
    btn.innerHTML = original;
    delete btn.dataset.feedbackAtivo;
  }, 1600);
}

// Busca o nome do modelo pelo id e exibe no elemento com id 'modeloTitulo'
if (modelo !== null) {
  fetch(`${BASE_URL}/mod/${modelo}`)
    .then((res) => res.json())
    .then((modeloData) => {
      const nome = Array.isArray(modeloData)
        ? modeloData[0]?.moddes
        : modeloData?.moddes;
      modeloAtual = nome || "";
      document.getElementById("modeloTitulo").textContent =
        nome || "Modelo não encontrado";
    })

    .catch(() => {
      document.getElementById("modeloTitulo").textContent = "";
    });
}

// Popula o tipo da peça no breadcrumb
const tipoUrl = buildTipoUrl(id, modelo);

if (tipoUrl) {
  fetch(tipoUrl)
    .then((res) => res.json())
    .then((modtipo) => {
      const nome = Array.isArray(modtipo)
        ? modtipo[0]?.tipodes
        : modtipo?.tipodes;
      document.getElementById("tipoPeca").textContent =
        nome || "Modelo não encontrado";
    })

    .catch(() => {
      document.getElementById("modeloTitulo").textContent = "";
    });
}

ouOnLoad(function () {
  validarCompartilhamento();
  const produtosUrl = buildProdutosUrl(id, marcascod, modelo);

  if (!produtosUrl) {
    return;
  }

  fetch(produtosUrl)
    .then((res) => res.json())
    .then((dados) => {
      todasAsPecas = Array.isArray(dados) ? dados : [];
      dadosCarregados = true;
      renderPecas();
    })
    .catch((erro) => {
      console.error(erro);
      const corpoTabela = document.getElementById("corpoTabela");
      todasAsPecas = [];
      dadosCarregados = true;
      atualizarContadorPecas(0);
      if (corpoTabela) corpoTabela.innerHTML = `<div class="ou-empty"><span class="ou-empty__icon"><i class="bi bi-exclamation-triangle"></i></span><div class="ou-empty__title">Erro ao carregar</div><div class="ou-empty__text">Tente novamente em instantes.</div></div>`;
    });
});

// Pesquisa em tempo real (filtragem local, sem nova chamada à API)
const inputPesquisa = document.getElementById("pesquisa");
if (inputPesquisa) {
  inputPesquisa.addEventListener("input", function () {
    pesquisaAtual = this.value;
    renderPecas();
  });
}

// Ordenação (local)
const selectOrdenacao = document.getElementById("ordenacao");
if (selectOrdenacao) {
  ordenacaoAtual = selectOrdenacao.value || "ordem-asc";
  selectOrdenacao.addEventListener("change", function () {
    ordenacaoAtual = this.value;
    renderPecas();
  });
}

// Limpar pesquisa (estado vazio)
const btnLimparPesquisa = document.getElementById("limparPesquisa");
if (btnLimparPesquisa) {
  btnLimparPesquisa.addEventListener("click", function () {
    if (inputPesquisa) {
      inputPesquisa.value = "";
      inputPesquisa.focus();
    }
    pesquisaAtual = "";
    renderPecas();
  });
}

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

window.adicionarAoCarrinho = async function (procod) {
  const qtde = 1;
  const button = event.target;
  const itemDiv = button.closest(".ou-product-card") || button.closest(".cart-item");

  if (!itemDiv) {
    console.error("Elemento do item não encontrado.");
    return;
  }

  const nome = itemDiv.querySelector(".ou-product-card__name, .item-name")?.textContent || "Produto";
  const preco = parseFloat(itemDiv.dataset.preco || "0");
  const precoOriginal = parseFloat(itemDiv.dataset.precoOriginal || "0") || null;
  const tipo = itemDiv.querySelector(".ou-product-card__type, .item-tipo")?.textContent || "";
  const marca = document.getElementById("marcaTitulo")?.textContent || "";

  try {
    const response = await fetch(`/proCoresDisponiveis/${procod}`);
    const cores = await response.json();

    if (cores && cores.length > 0 && cores[0].cornome !== "") {
      exibirComboBoxCores(cores, procod, nome, tipo, marca, preco, qtde, precoOriginal);
    } else {
      adicionarProdutoAoCarrinho(procod, nome, tipo, marca, preco, qtde, null, null, precoOriginal);
      mostrarFeedbackAdicionado(procod);
    }
  } catch (error) {
    console.error("Erro ao buscar cores:", error);
    showToast("Erro ao verificar cores do produto.", "error");
  }
};

/**
 * Exibe um modal para seleção de cor do produto
 * Cria um backdrop (overlay cinza) e um modal customizado para selecionar a cor
 * @param {Array} cores - Lista de cores disponíveis
 * @param {number} procod - Código do produto
 * @param {string} nome - Nome do produto
 * @param {string} tipo - Tipo do produto
 * @param {string} marca - Marca do produto
 * @param {number} preco - Preço do produto (promocional quando aplicável)
 * @param {number} qtde - Quantidade a adicionar
 * @param {number|null} precoOriginal - Preço original (para exibir desconto)
 */
function exibirComboBoxCores(cores, procod, nome, tipo, marca, preco, qtde, precoOriginal) {
  window.ouEscolherCor({ cores, nome, onConfirm(cor) {
    const corSelecionada = cor.cornome;
    adicionarProdutoAoCarrinho(
      `${procod}-${corSelecionada}`, `${nome} (${corSelecionada})`,
      tipo, marca, preco, qtde, corSelecionada, Number(cor.corcod) || null, precoOriginal
    );
    mostrarFeedbackAdicionado(procod);
  } });
}

/**
 * Adiciona um produto ao carrinho do localStorage
 * @param {string} id - Identificador único do produto (pode incluir cor)
 * @param {string} nome - Nome do produto
 * @param {string} tipo - Tipo do produto
 * @param {string} marca - Marca do produto
 * @param {number} preco - Preço do produto
 * @param {number} qtde - Quantidade a adicionar
 * @param {string} corSelecionada - Cor selecionada (opcional)
 * @param {string} idCorSelecionada - ID da cor selecionada (opcional)
 * @param {number|null} precoOriginal - Preço original (opcional)
 */

function adicionarProdutoAoCarrinho(
  id,
  nome,
  tipo,
  marca,
  preco,
  qtde,
  corSelecionada,
  idCorSelecionada,
  precoOriginal
) {
  let cart = JSON.parse(localStorage.getItem("cart") || "[]");

  const idx = cart.findIndex((item) => item.id === id);
  if (idx > -1) {
    cart[idx].qt += qtde;
    if (precoOriginal) cart[idx].precoOriginal = precoOriginal;
    cart[idx].preco = preco;
  } else {
    cart.push({
      id,
      nome,
      tipo,
      marca,
      modelo: modeloAtual,
      preco,
      precoOriginal: precoOriginal || null,
      qt: qtde,
      corSelecionada,
      idCorSelecionada,
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  if (window.ouStorefront) {
    window.ouStorefront.atualizarIconeCarrinho();
    window.ouStorefront.mostrarPopupAdicionado();
  }
}

})();
