const params = new URLSearchParams(window.location.search);
const id = params.get("id");

function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Logo/ícone de marca vem de public/js/brand-logo.js (fonte única,
// compartilhada com a tela de modelos).
const getBrandLogo = (name) => window.OrderUpBrandLogo.get(name);

// Mapa marcascod -> marcasdes (preenchido ao carregar /marcas/) para
// identificar o logo da marca nos resultados da busca de modelos.
let marcasPorCodigo = {};
let marcasPromise = null;

function carregarMarcas() {
  if (!marcasPromise) {
    marcasPromise = fetch(`${BASE_URL}/marcas/`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao buscar marcas: " + res.status);
        return res.json();
      })
      .then((dados) => {
        const lista = Array.isArray(dados) ? dados : [];
        marcasPorCodigo = {};
        lista.forEach((item) => {
          if (item && typeof item === "object" && item.marcascod != null) {
            marcasPorCodigo[String(item.marcascod)] = item.marcasdes || "";
          }
        });
        return lista;
      })
      .catch((err) => {
        marcasPromise = null; // permite nova tentativa em uma próxima busca
        throw err;
      });
  }
  return marcasPromise;
}

document.addEventListener("DOMContentLoaded", async () => {
  // ======================================================
  //  RENDERIZAÇÃO DAS MARCAS NO FRONT
  // ======================================================

  const holder = document.getElementById("marcaTitulo");

  if (!holder) {
    console.warn("Elemento #marcaTitulo não encontrado.");
    return;
  }

  holder.innerHTML = "";

  try {
    const dados = await carregarMarcas();

    if (!Array.isArray(dados) || dados.length === 0) {
      holder.innerHTML = `<div class="ou-empty"><span class="ou-empty__icon"><i class="bi bi-phone"></i></span><div class="ou-empty__title">Nenhuma marca encontrada</div><div class="ou-empty__text">Cadastre marcas no painel para exibi-las aqui.</div></div>`;
      return;
    }

    const row = document.createElement("div");
    row.className = "row g-3 g-lg-4";

    for (const item of dados) {
      const isString = typeof item === "string";

      const label = isString
        ? item
        : item.marcasdes || item.nome || item.name || item.label || "";

      const code = isString
        ? ""
        : item.marcascod || item.id || item.codigo || "";

      const logoInfo = getBrandLogo(label);

      // -----------------------------
      // CRIA COLUNA
      // -----------------------------

      const col = document.createElement("div");
      col.className = "col-6 col-md-4 col-lg-3 brand-col";

      const href =
        code !== ""
          ? `modelo?id=${encodeURIComponent(
              code
            )}&marcascod=${encodeURIComponent(code)}`
          : "modelo";

      const link = document.createElement("a");
      link.className = "brand-link";
      link.href = href;
      link.setAttribute("aria-label", label);

      const btn = document.createElement("button");
      btn.className = "ou-brand-card";
      btn.type = "button";

      const logoWrap = document.createElement("span");
      logoWrap.className = "ou-brand-logo";
      const img = document.createElement("img");
      img.src = logoInfo.primary; // tenta logo do uploads
      img.alt = `${label} logo`;
      img.loading = "lazy";

      // FALLBACK DE IMG (SEM HEAD)
      img.onerror = () => {
        img.onerror = null;
        img.src = "https://cdn.simpleicons.org/cog/000";
      };

      const span = document.createElement("span");
      span.className = "ou-brand-name";
      span.textContent = label;

      const chevron = document.createElement("i");
      chevron.className = "bi bi-chevron-right";

      logoWrap.appendChild(img);
      btn.appendChild(logoWrap);
      btn.appendChild(span);
      btn.appendChild(chevron);
      link.appendChild(btn);
      col.appendChild(link);
      row.appendChild(col);
    }

    holder.appendChild(row);
  } catch (err) {
    console.error("Erro ao carregar marcas:", err);
    holder.innerHTML =
      `<div class="ou-empty"><span class="ou-empty__icon"><i class="bi bi-exclamation-triangle"></i></span><div class="ou-empty__title">Erro ao carregar marcas</div><div class="ou-empty__text">Verifique sua conexão e tente novamente.</div></div>`;
  }
});

const inputPesquisa = document.getElementById("pesquisa");
const tabelaArea = document.getElementById("tabelaArea");
const cardsArea = document.getElementById("cardsArea");
const corpoTabela = document.getElementById("corpoTabela");
const resultadoQuantidade = document.getElementById("resultadoQuantidade");

// Busca padronizada: sempre por modelo, independente de o usuário
// estar logado ou não (nunca busca peças/produtos diretamente).
// O token evita que uma resposta antiga sobrescreva uma busca mais recente.
let buscaToken = 0;

function exibirAreaBusca() {
  tabelaArea.style.display = "block";
  cardsArea.style.display = "none";
}

function limparBusca() {
  tabelaArea.style.display = "none"; // mostra novamente os cards de marca
  cardsArea.style.display = "block";
  corpoTabela.innerHTML = "";
  corpoTabela.classList.remove("ou-model-grid");
  if (resultadoQuantidade) resultadoQuantidade.textContent = "";
}

function renderizarCarregandoBusca() {
  exibirAreaBusca();
  corpoTabela.classList.remove("ou-model-grid");
  if (resultadoQuantidade) resultadoQuantidade.textContent = "";
  corpoTabela.innerHTML = `
    <div class="ou-loading py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Carregando...</span>
      </div>
      <span>Buscando modelos...</span>
    </div>`;
}

function renderizarVazioBusca() {
  exibirAreaBusca();
  corpoTabela.classList.remove("ou-model-grid");
  if (resultadoQuantidade) resultadoQuantidade.textContent = "";
  corpoTabela.innerHTML = `
    <div class="ou-empty">
      <span class="ou-empty__icon"><i class="bi bi-search"></i></span>
      <div class="ou-empty__title">Nenhum modelo encontrado para sua busca.</div>
      <div class="ou-empty__text">Tente outro termo ou selecione uma marca acima.</div>
    </div>`;
}

function renderizarResultadosBusca(modelos) {
  exibirAreaBusca();
  corpoTabela.classList.add("ou-model-grid");

  const total = modelos.length;
  if (resultadoQuantidade) {
    resultadoQuantidade.textContent =
      total === 1 ? "1 modelo" : `${total} modelos`;
  }

  corpoTabela.innerHTML = "";
  modelos.forEach((modelo) => {
    const marcaNome = marcasPorCodigo[String(modelo.modmarcascod)] || "";
    const logo = marcaNome
      ? getBrandLogo(marcaNome)
      : { primary: "https://cdn.simpleicons.org/cog/000" };
    const marcaHtml = marcaNome
      ? `<div class="ou-result-item__brand">${String(marcaNome).replace(
          /</g,
          "&lt;"
        )}</div>`
      : "";

    const item = document.createElement("a");
    item.className = "ou-result-item";
    item.href = `pecas?id=${encodeURIComponent(
      modelo.modcod
    )}&marcascod=${encodeURIComponent(modelo.modmarcascod)}`;
    item.setAttribute(
      "aria-label",
      marcaNome
        ? `Selecionar modelo ${modelo.moddes} da marca ${marcaNome}`
        : `Selecionar modelo ${modelo.moddes}`
    );
    item.innerHTML = `
      <span class="ou-brand-logo ou-model-card__logo" aria-hidden="true">
        <img src="${logo.primary}" alt="" loading="lazy" />
      </span>
      <div class="ou-result-item__main">
        ${marcaHtml}
        <div class="ou-result-item__name">${String(modelo.moddes).replace(
          /</g,
          "&lt;"
        )}</div>
      </div>
      <span class="btn btn-primary btn-sm ou-result-item__cta">
        Selecionar <i class="bi bi-arrow-right-short" aria-hidden="true"></i>
      </span>
    `;

    const logoImg = item.querySelector(".ou-model-card__logo img");
    if (logoImg) {
      logoImg.onerror = () => {
        logoImg.onerror = null;
        logoImg.src = "https://cdn.simpleicons.org/cog/000";
      };
    }

    corpoTabela.appendChild(item);
  });
}

async function executarBusca(pesquisa) {
  const token = ++buscaToken;
  renderizarCarregandoBusca();

  try {
    const [modelos] = await Promise.all([
      fetch(`${BASE_URL}/modelos`).then((res) => res.json()),
      carregarMarcas().catch(() => []), // garante o mapa de logos sem travar a busca
    ]);

    if (token !== buscaToken) return; // ignora resposta obsoleta

    const lista = Array.isArray(modelos) ? modelos : [];
    const filtrados = lista
      .filter(
        (modelo) =>
          modelo.moddes && modelo.moddes.toLowerCase().includes(pesquisa)
      )
      .sort((a, b) => {
        const nomeA = a.moddes.replace(/\s/g, "");
        const nomeB = b.moddes.replace(/\s/g, "");
        return nomeA.localeCompare(nomeB, "pt-BR", { numeric: true });
      });

    if (filtrados.length === 0) {
      renderizarVazioBusca();
      return;
    }
    renderizarResultadosBusca(filtrados);
  } catch (error) {
    if (token !== buscaToken) return;
    console.error("Erro no fetch:", error);
    renderizarVazioBusca();
  }
}

// Debounce: evita um GET /modelos a cada tecla digitada.
let buscaDebounceTimer = null;
inputPesquisa.addEventListener("input", function () {
  const pesquisa = this.value.trim().toLowerCase();
  clearTimeout(buscaDebounceTimer);

  if (!pesquisa) {
    limparBusca();
    return;
  }

  buscaDebounceTimer = setTimeout(() => executarBusca(pesquisa), 300);
});

// Função para atualizar o ícone do carrinho (exibe badge com quantidade de itens)
function atualizarIconeCarrinho() {
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  let badge = document.getElementById("cartBadge");
  const cartIcon =
    document.getElementById("cartIcon") ||
    document.getElementById("openCartModal");
  if (!cartIcon) return;

  if (getComputedStyle(cartIcon).position === "static") {
    cartIcon.style.position = "relative";
  }

  if (!badge) {
    badge = document.createElement("span");
    badge.id = "cartBadge";
    badge.className = "badge rounded-pill bg-danger";
    badge.style.position = "absolute";
    badge.style.top = "-6px";
    badge.style.right = "-6px";
    badge.style.minWidth = "1.25em";
    badge.style.height = "1.25em";
    badge.style.fontSize = "0.7em";
    badge.style.padding = "0.15em 0.35em";
    badge.style.display = "none";
    badge.style.alignItems = "center";
    badge.style.justifyContent = "center";
    badge.style.zIndex = 10;
    cartIcon.appendChild(badge);
  }
  const total = cart.reduce((sum, item) => sum + item.qt, 0);
  badge.textContent = total > 0 ? total : "";
  badge.style.display = total > 0 ? "inline-flex" : "none";
}

// Toast padrão OrderUp (usa .ou-toast do ui.css; cai para showToast legado)
function ouNotify(message, type = "success") {
  if (typeof showToast === "function" && !document.getElementById("ouToastContainer")) {
    showToast(message, type === "success" ? "success" : "info");
    return;
  }
  let container = document.getElementById("ouToastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "ouToastContainer";
    container.className = "ou-toast-container";
    document.body.appendChild(container);
  }
  const icons = { success: "bi-check-circle-fill", error: "bi-exclamation-circle-fill", info: "bi-info-circle-fill" };
  const el = document.createElement("div");
  el.className = `ou-toast ou-toast--${type}`;
  el.innerHTML = `<i class="bi ${icons[type] || icons.success}"></i><span></span>`;
  el.querySelector("span").textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add("ou-toast--in"));
  setTimeout(() => {
    el.classList.remove("ou-toast--in");
    setTimeout(() => el.remove(), 250);
  }, 1800);
}

// Função para mostrar popup de confirmação
function mostrarPopupAdicionado() {
  ouNotify("Item adicionado ao carrinho!", "success");
}

// Modal do carrinho centralizado em storefront-shared.js (ensureCartModal +
// openCartModal + renderCartModalItems). Sem duplicação aqui.

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
  const meta = (itemDiv.querySelector(".ou-result-item__meta")?.textContent || "").split("·").map((s) => s.trim());
  const tipo = itemDiv.querySelector(".item-tipo")?.textContent || meta[0] || "";
  const marca = itemDiv.querySelector(".item-marca")?.textContent || meta[1] || "";

  try {
    const response = await fetch(`/proCoresDisponiveis/${procod}`);
    const cores = await response.json();

    // console.log("Cores disponíveis:", cores);

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

function exibirComboBoxCores(cores, procod, nome, tipo, marca, preco, qtde) {
  const backdrop = document.createElement("div");
  backdrop.style.position = "fixed";
  backdrop.style.top = "0";
  backdrop.style.left = "0";
  backdrop.style.width = "100%";
  backdrop.style.height = "100%";
  backdrop.style.backgroundColor = "rgba(0, 0, 0, 0.4)";
  backdrop.style.zIndex = "9998";

  const modal = document.createElement("div");
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

  // Monta HTML do modal incluindo indicação de cores sem estoque (procorsemest === 'S')
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

  document.getElementById("btn-confirmar-cor").onclick = function () {
    const corSelecionada =
      document.getElementById("select-cor").options[
        document.getElementById("select-cor").selectedIndex
      ].text;
    const idComCor = `${procod}-${corSelecionada}`;
    const nomeComCor = `${nome} (${corSelecionada})`;
    const idCorSelecionada = Number(document.getElementById("select-cor").value) || null;

    console.log("ID da cor selecionada:", idCorSelecionada);

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

    modal.remove();
    backdrop.remove();
  };

  document.getElementById("btn-cancelar-cor").onclick = function () {
    modal.remove();
    backdrop.remove();
  };
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
  // console.log("cor:", corSelecionada);

  const idx = cart.findIndex((item) => item.id === id);
  if (idx > -1) {
    cart[idx].qt += qtde;
  } else {
    cart.push({ id, nome, tipo, marca, preco, qt: qtde, corSelecionada, idCorSelecionada });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  atualizarIconeCarrinho();
  mostrarPopupAdicionado();
}

// Função global para remover item do carrinho
window.removerItemCarrinho = function (idx) {
  let cart = JSON.parse(localStorage.getItem("cart") || "[]");
  cart.splice(idx, 1);
  localStorage.setItem("cart", JSON.stringify(cart));
  atualizarIconeCarrinho();
  // Reabrir/atualizar modal
  document.getElementById("openCartModal").click();
};

window.addEventListener("pageshow", function (event) {
  atualizarIconeCarrinho();
});

// Botão de instalação PWA
let deferredPrompt;
const btnInstall = document.getElementById("btnInstall");

// Captura o evento antes do Chrome exibir o banner nativo
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // impede o banner automático
  deferredPrompt = e;
  if (btnInstall) btnInstall.style.display = "inline-flex"; // mostra botão manual
});

// Quando o usuário clicar no botão
if (btnInstall) {
  btnInstall.addEventListener("click", () => {
    btnInstall.style.display = "none"; // esconde o botão
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); // dispara o banner nativo
    deferredPrompt.userChoice.then((choiceResult) => {
      console.log("Usuário escolheu:", choiceResult.outcome);
      deferredPrompt = null;
    });
  });
}

// Registro do Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").then(
    () => {
      console.log("Service Worker registrado");
    },
    (err) => {
      console.log("Service Worker indisponível:", err);
    }
  );
}
