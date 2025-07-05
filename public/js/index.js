const params = new URLSearchParams(window.location.search);
const id = params.get("id");

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
      const holder = document.getElementById("marcaTitulo");
      if (!holder) return;
      holder.innerHTML = ""; // zera antes

      let html = '<div class="row">';
      dados.forEach((dado, i) => {
        html += `
        
          <div class="col-6 col-sm-6 col-md-4 mb-3 d-flex justify-content-center">
            <a href="modelo?id=${dado.marcascod}&marcascod=${dado.marcascod}" class="w-100">
              <button class="btn btn-md btn-outline-dark w-100">${dado.marcasdes}</button>
            </a>
          </div>`;

      });
      html += "</div>";

      holder.innerHTML = html;
    })
    .catch(console.error);
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
    console.log("Cart antes de serializar:", cart);
    goToCartBtn.href = cart.length > 0 ? `carrinho?cart=${cartJson}` : "#";
    goToCartBtn.textContent = "Ir para o carrinho";
    goToCartBtn.style.marginLeft = "8px";
    goToCartBtn.onclick = function (e) {
      if (cart.length === 0) {
        e.preventDefault();
        return;
      }
      // Explicitly hide the modal before navigating (consistent with pecas.js and lista-pecas.js)
      $("#cartModal").modal("hide");
    };

    cartModalFooter.appendChild(goToCartBtn);
  }
});

// Modifique a função adicionarAoCarrinho para salvar o preço no carrinho
window.adicionarAoCarrinho = function (procod) {
  const input = document.getElementById(`qtde_peca_${procod}`);
  const qtde = input ? parseInt(input.value, 10) || 1 : 1;

  // Busca os dados da linha correspondente
  const tr = input.closest("tr");
  const nome = tr.querySelector("td").textContent;
  const preco = tr.querySelectorAll("td")[1].textContent; // dado.provl

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
  atualizarIconeCarrinho();

  // Mostra popup de confirmação
  mostrarPopupAdicionado();
};

document.addEventListener("DOMContentLoaded", atualizarIconeCarrinho);

// Função global para remover item do carrinho
window.removerItemCarrinho = function (idx) {
  let cart = JSON.parse(localStorage.getItem("cart") || "[]");
  cart.splice(idx, 1);
  localStorage.setItem("cart", JSON.stringify(cart));
  atualizarIconeCarrinho();
  // Reabrir/atualizar modal
  document.getElementById("openCartModal").click();
};

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
        tr.innerHTML = `
          <td>${produto.prodes}</td>
          <td>${formatarMoeda(produto.provl)}</td>
          <td>
              <button class="btn btn-success btn-sm" onclick="adicionarAoCarrinho('${produto.procod}')">Adicionar</button>
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
    console.log("Cart antes de serializar:", cart);
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

// Modifique a função adicionarAoCarrinho para salvar o preço no carrinho
window.adicionarAoCarrinho = function (procod) {
  const qtde = 1; // Default quantity to 1

  // Busca os dados da linha correspondente
  // Precisamos encontrar a linha da tabela (tr) de uma forma diferente agora que o input se foi.
  // Assumindo que o botão clicado está dentro da célula (td) que está dentro da linha (tr)
  const button = event.target; // Get the button that was clicked
  const tr = button.closest("tr");
  const nome = tr.querySelector("td").textContent;
  const preco = tr.querySelectorAll("td")[1].textContent; // dado.provl

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
  atualizarIconeCarrinho();

  // Mostra popup de confirmação
  mostrarPopupAdicionado();
};

document.addEventListener("DOMContentLoaded", atualizarIconeCarrinho);

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
