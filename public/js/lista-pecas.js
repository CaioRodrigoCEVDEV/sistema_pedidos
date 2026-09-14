const params = new URLSearchParams(window.location.search);

const id = parseIntegerParam(params.get("id"));
const modelo = parseIntegerParam(params.get("modelo"));
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

// Busca o nome do modelo pelo id e exibe no elemento com id 'modeloTitulo'
if (modelo !== null) {
  fetch(`${BASE_URL}/mod/${modelo}`)
    .then((res) => res.json())
    .then((modeloData) => {
      const nome = Array.isArray(modeloData)
        ? modeloData[0]?.moddes
        : modeloData?.moddes;
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

document.addEventListener("DOMContentLoaded", function () {
  const produtosUrl = buildProdutosUrl(id, marcascod, modelo);

  if (!produtosUrl) {
    return;
  }

  fetch(produtosUrl)
    .then((res) => res.json())
    .then((dados) => {
      const corpoTabela = document.getElementById("corpoTabela");
      if (!corpoTabela) return;
      corpoTabela.innerHTML = ""; // Limpa o conteúdo atual
      //console.log(dados);

      if (!Array.isArray(dados) || dados.length === 0) {
        corpoTabela.innerHTML = `<div class="ou-empty"><span class="ou-empty__icon"><i class="bi bi-inbox"></i></span><div class="ou-empty__title">Nenhuma peça encontrada</div><div class="ou-empty__text">Nenhuma peça cadastrada para este filtro.</div></div>`;
        return;
      }

      dados.forEach((dado) => {
        const item = document.createElement("div");
        item.className = "ou-result-item";
        item.dataset.preco = dado.provl;
        const isDisabled = dado.prosemest === "S";
        const safeName = String(dado.prodes || "Peça").replace(/</g, "&lt;");
        const safeTipo = String(dado.tipodes || "").replace(/</g, "&lt;");
        item.innerHTML = `
            <div class="ou-result-item__main">
              <div class="ou-result-item__name">${safeName}</div>
              <div class="ou-result-item__meta">${safeTipo}</div>
            </div>
            <div class="ou-result-item__price">${formatarMoeda(dado.provl)}</div>
            ${isDisabled ? `<span class="ou-badge ou-badge--danger">Em Falta</span>` : ""}
            <button class="${
                isDisabled
                  ? "btn btn-secondary btn-sm"
                  : "btn btn-success btn-sm"
              }" ${
          isDisabled
            ? 'disabled title="Em Falta"'
            : `onclick="adicionarAoCarrinho('${dado.procod}')"`
        }>
          ${isDisabled ? "Em Falta" : "Adicionar"}
            </button>
          `;

        corpoTabela.appendChild(item);
      });
    })
    .catch((erro) => {
      console.error(erro);
      const corpoTabela = document.getElementById("corpoTabela");
      if (corpoTabela) corpoTabela.innerHTML = `<div class="ou-empty"><span class="ou-empty__icon"><i class="bi bi-exclamation-triangle"></i></span><div class="ou-empty__title">Erro ao carregar</div><div class="ou-empty__text">Tente novamente em instantes.</div></div>`;
    });
});

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

window.adicionarAoCarrinho = async function (procod) {
  const qtde = 1;
  const button = event.target;
  const itemDiv = button.closest(".ou-result-item") || button.closest(".cart-item");

  if (!itemDiv) {
    console.error("Elemento do item não encontrado.");
    return;
  }

  const nome = itemDiv.querySelector(".ou-result-item__name, .item-name")?.textContent || "Produto";
  const preco = parseFloat(itemDiv.dataset.preco || "0");
  const tipo = itemDiv.querySelector(".ou-result-item__meta, .item-tipo")?.textContent || "";
  const marca = document.getElementById("marcaTitulo")?.textContent || "";

  try {
    const response = await fetch(`/proCoresDisponiveis/${procod}`);
    const cores = await response.json();

     console.log("Cores disponíveis:", cores);

    if (cores && cores.length > 0 && cores[0].cornome !== "") {
      exibirComboBoxCores(cores, procod, nome, tipo, marca, preco, qtde);
    } else {
      adicionarProdutoAoCarrinho(procod, nome, tipo, marca, preco, qtde);
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
 * @param {number} preco - Preço do produto
 * @param {number} qtde - Quantidade a adicionar
 */
function exibirComboBoxCores(cores, procod, nome, tipo, marca, preco, qtde) {
  // Cria o backdrop (overlay cinza de fundo)
  const backdrop = document.createElement("div");
  backdrop.id = "modal-cor-backdrop";
  backdrop.style.position = "fixed";
  backdrop.style.top = "0";
  backdrop.style.left = "0";
  backdrop.style.width = "100%";
  backdrop.style.height = "100%";
  backdrop.style.backgroundColor = "rgba(0, 0, 0, 0.4)";
  backdrop.style.zIndex = "9998";

  // Cria o modal
  const modal = document.createElement("div");
  modal.id = "modal-cor-selecao";
  modal.style.position = "fixed";
  modal.style.top = "50%";
  modal.style.left = "50%";
  modal.style.transform = "translate(-50%, -50%)";
  modal.style.background = "var(--ou-surface, #fff)";
  modal.style.color = "var(--ou-text, #0f172a)";
  modal.style.padding = "20px";
  modal.style.borderRadius = "18px";
  modal.style.border = "1px solid var(--ou-border-soft, #eaeef5)";
  modal.style.boxShadow = "var(--ou-shadow-lg, 0 18px 48px rgba(15,23,42,.12))";
  modal.style.zIndex = "9999";

  // Monta HTML do modal com indicação de cores sem estoque
  modal.innerHTML = `
    <style>
      #modal-cor-container {
        max-width: 300px;
        font-family: sans-serif;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      #modal-cor-container p {
        font-size: 16px;
        margin: 0;
        font-weight: 600;
        text-align: center;
      }
      #modal-cor-container select {
        width: 100%;
        padding: 8px;
        font-size: 14px;
        border-radius: 6px;
        border: 1px solid #ccc;
      }
      #modal-cor-botoes {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      #modal-cor-botoes button {
        padding: 6px 12px;
        font-size: 14px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      #btn-confirmar-cor {
        background-color: #28a745;
        color: white;
      }
      #btn-confirmar-cor:hover {
        background-color: #218838;
      }
      #btn-cancelar-cor {
        background-color: #dc3545;
        color: white;
      }
      #btn-cancelar-cor:hover {
        background-color: #c82333;
      }
      #select-cor option[disabled] {
        color: #888;
        background: #f5f5f5;
        font-style: italic;
      }
    </style>

    <div id="modal-cor-container">
      <p>Escolha a cor do produto:</p>
      <select id="select-cor">
  ${cores
    .map((cor) => {
      const idCor = cor.corcod;

      console.log("Cor id:",  idCor);
      const semEstoque = cor.procorsemest === "S";
      const label = `${cor.cornome}${semEstoque ? " (Sem estoque)" : ""}`;

      return `
        <option value="${idCor}" data-nome="${cor.cornome}"
          ${semEstoque ? 'disabled data-semest="S"' : ""}>
          ${label}
        </option>
      `;
    })
    .join("")}
</select>
      <div id="modal-cor-botoes">
        <button id="btn-cancelar-cor">Cancelar</button>
        <button id="btn-confirmar-cor">Confirmar</button>
      </div>
    </div>
    <script>
      (function(){
        const select = document.getElementById('select-cor');
        const confirmBtn = document.getElementById('btn-confirmar-cor');
        // Se todas as opções estiverem sem estoque, desabilita confirmar
        if ([...select.options].every(o => o.disabled)) {
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Indisponível';
          confirmBtn.style.backgroundColor = '#999';
          confirmBtn.style.cursor = 'not-allowed';
        } else {
          // Seleciona automaticamente a primeira opção disponível
          const firstAvailable = [...select.options].find(o => !o.disabled);
          if (firstAvailable) firstAvailable.selected = true;
        }
      })();
    </script>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  /**
   * Função para fechar o modal e remover o backdrop
   * Garante que o overlay cinza seja removido corretamente
   */
  function fecharModalCores() {
    if (modal && modal.parentNode) {
      modal.remove();
    }
    if (backdrop && backdrop.parentNode) {
      backdrop.remove();
    }
  }

  // Fecha o modal ao clicar no backdrop (overlay cinza)
  backdrop.addEventListener("click", function () {
    fecharModalCores();
  });

  // Handler do botão Confirmar - usa addEventListener para consistência
  const btnConfirmar = document.getElementById("btn-confirmar-cor");
  btnConfirmar.addEventListener("click", function () {
    const corSelecionada =
      document.getElementById("select-cor").options[
        document.getElementById("select-cor").selectedIndex
      ].text;
    const idComCor = `${procod}-${corSelecionada}`;
    const nomeComCor = `${nome} (${corSelecionada})`;
    const idCorSelecionada = Number(document.getElementById("select-cor").value) || null;

    adicionarProdutoAoCarrinho(
      idComCor,
      nomeComCor,
      tipo,
      marca,
      preco,
      qtde,
      corSelecionada,
      idCorSelecionada
    );

    fecharModalCores();
  });

  // Handler do botão Cancelar - usa addEventListener para consistência
  const btnCancelar = document.getElementById("btn-cancelar-cor");
  btnCancelar.addEventListener("click", function () {
    fecharModalCores();
  });
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
 */

function adicionarProdutoAoCarrinho(
  id,
  nome,
  tipo,
  marca,
  preco,
  qtde,
  corSelecionada,
  idCorSelecionada
) {
  let cart = JSON.parse(localStorage.getItem("cart") || "[]");

  const idx = cart.findIndex((item) => item.id === id);
  if (idx > -1) {
    cart[idx].qt += qtde;
  } else {
    cart.push({ id, nome, tipo, marca, preco, qt: qtde, corSelecionada,idCorSelecionada });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  if (window.ouStorefront) {
    window.ouStorefront.atualizarIconeCarrinho();
    window.ouStorefront.mostrarPopupAdicionado();
  }
}
