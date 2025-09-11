const params = new URLSearchParams(window.location.search);
const id = params.get("id");

function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await verificarLogin();
  fetch(`${BASE_URL}/marcas/`)
    .then((res) => res.json())
    .then((dados) => {
      const holder = document.getElementById("marcaTitulo");
      if (!holder) return;
      holder.innerHTML = ""; // zera antes

      let html = '<div class="row g-4">'; // gap entre os itens
      dados.forEach((dado) => {
        html += `
        <style> .brand-btn {
    border-radius: 12px;
    transition: all 0.2s ease-in-out;
  }
  .brand-btn:hover {
    background-color: #0d6efd;
    color: white;
    transform: translateY(-2px);
  }
  </style>
          <div class="col-6 col-md-4 col-lg-3 px-2 mb-3">
            <a href="modelo?id=${dado.marcascod}&marcascod=${dado.marcascod}" class="w-100 text-decoration-none">
              <button class="btn btn-light w-100 shadow-sm py-3 fw-semibold brand-btn">
                ${dado.marcasdes}
              </button>
            </a>
          </div>`;
      });
      html += "</div>";

      holder.innerHTML = html;
    })
    .catch(console.error);
});

const inputPesquisa = document.getElementById("pesquisa");
const tabelaArea = document.getElementById("tabelaArea");
const cardsArea = document.getElementById("cardsArea");
const corpoTabela = document.getElementById("corpoTabela");

let usuarioLogado = false;

async function verificarLogin() {
  try {
    const resp = await fetch(`${BASE_URL}/auth/listarlogin`, {
      credentials: "include",
    });
    if (!resp.ok) throw new Error("Nao logado");
    const dados = await resp.json();
    usuarioLogado = !!(dados && dados.usucod);
  } catch (err) {
    usuarioLogado = false;
  }
}

inputPesquisa.addEventListener("input", function () {
  const pesquisa = this.value.trim().toLowerCase();

  if (!pesquisa) {
    tabelaArea.style.display = "none"; // esconde tabela
    cardsArea.style.display = "block"; // mostra cards
    corpoTabela.innerHTML = ""; // limpa tabela
    return;
  }

  if (usuarioLogado) {
    fetch(`${BASE_URL}/pros`)
      .then((res) => res.json())
      .then((pecas) => {
        const filtrados = pecas.filter(
          (peca) => peca.prodes && peca.prodes.toLowerCase().includes(pesquisa)
        );

        if (filtrados.length === 0) {
          tabelaArea.style.display = "none"; // esconde tabela se nada encontrado
          cardsArea.style.display = "block"; // mostra cards
          corpoTabela.innerHTML = "";
          return;
        }

        corpoTabela.innerHTML = "";
        //adiciona o titulo apenas uma vez
        if (filtrados.length > 0) {
          const titulo = document.getElementById("titulo-peca");
          titulo.innerHTML = " Selecione a peça";
          titulo.style.textAlign = "center";
        }
        // Ordena as peças
        filtrados.forEach((peca) => {
          const item = document.createElement("div");
          item.className = "cart-item";
          item.dataset.preco = peca.provl;
          item.innerHTML = `
            <div class="item-name">${peca.prodes}</div>
            <div class="item-tipo">${peca.tipodes}</div>
            <div class="item-marca">${peca.marcasdes}</div>
            <div class="item-price">${formatarMoeda(
              peca.provl
            )} <button class="btn btn-success btn-sm btn-add" onclick="adicionarAoCarrinho('${
            peca.procod
          }')">Adicionar</button></div>

          `;
          corpoTabela.appendChild(item);
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
  } else {
    fetch(`${BASE_URL}/modelos`)
      .then((res) => res.json())
      .then((modelos) => {
        const filtrados = modelos.filter(
          (modelo) =>
            modelo.moddes && modelo.moddes.toLowerCase().includes(pesquisa)
        );

        if (filtrados.length === 0) {
          tabelaArea.style.display = "none"; // esconde tabela se nada encontrado
          cardsArea.style.display = "block"; // mostra cards
          corpoTabela.innerHTML = "";
          return;
        }

        corpoTabela.innerHTML = "";

        // Ordena os modelos
        filtrados.sort((a, b) => {
          const nomeA = a.moddes.replace(/\s/g, "");
          const nomeB = b.moddes.replace(/\s/g, "");
          return nomeA.localeCompare(nomeB, "pt-BR", { numeric: true });
        });

        // Adiciona o título apenas uma vez
        if (filtrados.length > 0) {
          const titulo = document.createElement("h3");
          titulo.textContent = " Selecione o Modelo";
          titulo.style.textAlign = "center";
          corpoTabela.appendChild(titulo);
        }

        // Loop para inserir os modelos
        filtrados.forEach((modelo) => {
          const item = document.createElement("div");
          item.className = "cart-item";
          //item.style.maxWidth = "50%"; removido feature do alan
          item.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div class="item-name">${modelo.moddes}</div>
              <a href="pecas?id=${modelo.modcod}&marcascod=${modelo.modmarcascod}">
                <button class="btn btn-success btn-sm btn-add">Selecionar</button>
              </a>
            </div>
          `;
          corpoTabela.appendChild(item);
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
  }
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
    badge.className = "badge badge-danger";
    badge.style.position = "absolute";
    badge.style.left = "0";
    badge.style.bottom = "0";
    badge.style.transform = "translate(-40%, 40%)";
    badge.style.minWidth = "1.1em";
    badge.style.height = "1.1em";
    badge.style.fontSize = "0.75em";
    badge.style.padding = "0.1em 0.3em";
    badge.style.borderRadius = "50%";
    badge.style.display = "none";
    badge.style.alignItems = "center";
    badge.style.justifyContent = "center";
    badge.style.background = "#dc3545";
    badge.style.color = "#fff";
    badge.style.boxSizing = "border-box";
    badge.style.zIndex = 10;
    badge.style.overflow = "hidden";
    badge.style.textAlign = "center";
    cartIcon.appendChild(badge);
  }
  const total = cart.reduce((sum, item) => sum + item.qt, 0);
  badge.textContent = total > 0 ? total : "";
  badge.style.display = total > 0 ? "flex" : "none";
}

// Função para mostrar popup de confirmação
function mostrarPopupAdicionado() {
  // Cria popup simples (pode customizar com Bootstrap Toast/Modal se quiser)
  let popup = document.getElementById("popupAdicionado");
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "popupAdicionado";
    popup.style.position = "fixed";
    popup.style.top = "20px";
    popup.style.right = "20px";
    popup.style.background = "#28a745";
    popup.style.color = "#fff";
    popup.style.padding = "12px 24px";
    popup.style.borderRadius = "6px";
    popup.style.zIndex = 9999;
    popup.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
    popup.style.fontWeight = "bold";
    document.body.appendChild(popup);
  }
  popup.textContent = "Item adicionado ao carrinho!";
  popup.style.display = "block";
  setTimeout(() => {
    popup.style.display = "none";
  }, 1500);
}

document.getElementById("openCartModal").addEventListener("click", function () {
  $("#cartModal").modal("show");
  // Exemplo: carregar itens do carrinho (ajuste conforme sua lógica)
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const cartItemsDiv = document.getElementById("cartItems");
  if (cart.length === 0) {
    cartItemsDiv.innerHTML = "<p>Nenhum item no carrinho.</p>";
  } else {
    cartItemsDiv.innerHTML =
      '<ul class="list-group">' +
      cart
        .map(
          (item, idx) => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          <span>${item.nome} <small class="text-muted">(R$ ${
            item.preco ? Number(item.preco).toFixed(2) : "0.00"
          })</small></span>
          <span>
            <span class="badge badge-primary badge-pill mr-2">${item.qt}</span>
            <button class="btn btn-danger btn-sm" onclick="removerItemCarrinho(${idx})">&times;</button>
          </span>
        </li>
      `
        )
        .join("") +
      "</ul>";
  }

  // Adiciona botão "Ir para o carrinho" no footer do modal
  const cartModalFooter = document.querySelector("#cartModal .modal-footer");
  if (cartModalFooter) {
    // Remove botão antigo se houver
    const oldBtn = document.getElementById("goToCartBtn");
    if (oldBtn) oldBtn.remove();

    // Cria botão
    const goToCartBtn = document.createElement("a");
    goToCartBtn.id = "goToCartBtn";
    goToCartBtn.className = "btn btn-primary ml-2";

    // Passa o carrinho como JSON na URL (codificado em base64 para evitar problemas de caracteres)
    const cartJson = encodeURIComponent(
      btoa(unescape(encodeURIComponent(JSON.stringify(cart))))
    );
    // console.log("Cart antes de serializar:", cart);
    goToCartBtn.href = cart.length > 0 ? `carrinho?cart=${cartJson}` : "#";
    goToCartBtn.textContent = "Ir para o carrinho";
    goToCartBtn.style.marginLeft = "8px";
    goToCartBtn.onclick = function (e) {
      if (cart.length === 0) {
        e.preventDefault();
        return; // Don't proceed if cart is empty
      }
      // Explicitly hide the modal before navigating
      $("#cartModal").modal("hide");
      // Allow default navigation by not calling e.preventDefault() when cart is not empty
    };

    cartModalFooter.appendChild(goToCartBtn);
  }
});

window.adicionarAoCarrinho = async function (procod) {
  const qtde = 1;
  const button = event.target;
  const itemDiv = button.closest(".cart-item");

  if (!itemDiv) {
    console.error("Elemento '.cart-item' não encontrado.");
    return;
  }

  const nome = itemDiv.querySelector(".item-name")?.textContent || "Produto";
  const preco = parseFloat(itemDiv.dataset.preco || "0");
  const tipo = itemDiv.querySelector(".item-tipo").textContent;
  const marca = itemDiv.querySelector(".item-marca").textContent;

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
    alert("Erro ao verificar cores do produto.");
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
  modal.style.background = "white";
  modal.style.padding = "20px";
  modal.style.borderRadius = "8px";
  modal.style.boxShadow = "0 2px 10px rgba(0,0,0,0.3)";
  modal.style.zIndex = "9999";

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
  </style>

  <div id="modal-cor-container">
    <p>Escolha a cor do produto:</p>
    <select id="select-cor">
      ${cores
        .map((cor) => `<option value="${cor.procod}">${cor.cornome}</option>`)
        .join("")}
    </select>
    <div id="modal-cor-botoes">
      <button id="btn-cancelar-cor">Cancelar</button>
      <button id="btn-confirmar-cor">Confirmar</button>
    </div>
  </div>
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

    adicionarProdutoAoCarrinho(
      idComCor,
      nomeComCor,
      tipo,
      marca,
      preco,
      qtde,
      corSelecionada
    );

    modal.remove();
    backdrop.remove();
  };

  document.getElementById("btn-cancelar-cor").onclick = function () {
    modal.remove();
    backdrop.remove();
  };
}

function adicionarProdutoAoCarrinho(
  id,
  nome,
  tipo,
  marca,
  preco,
  qtde,
  corSelecionada
) {
  let cart = JSON.parse(localStorage.getItem("cart") || "[]");
  // console.log("cor:", corSelecionada);

  const idx = cart.findIndex((item) => item.id === id);
  if (idx > -1) {
    cart[idx].qt += qtde;
  } else {
    cart.push({ id, nome, tipo, marca, preco, qt: qtde, corSelecionada });
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

// Controle de exibição do alerta de tutorial na página inicial
document.addEventListener("DOMContentLoaded", () => {
  const alertEl = document.getElementById("tutorialAlert");
  const closeBtn = document.getElementById("tutorialAlertClose");
  if (!alertEl) return;

  if (localStorage.getItem("tutorialAlertClosed") === "true") {
    alertEl.remove();
    return;
  }

  // Hide the alert initially and display it after a brief delay with animation
  alertEl.style.display = "none";
  setTimeout(() => {
    alertEl.style.display = "block";
    alertEl.classList.add("slide-down");
  }, 1500);

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      localStorage.setItem("tutorialAlertClosed", "true");
    });
  }
});
