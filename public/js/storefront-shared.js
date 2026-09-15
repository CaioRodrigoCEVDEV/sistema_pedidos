/**
 * OrderUp Storefront — helpers compartilhados (loja pública).
 * Usado por index / modelo / pecas / lista-pecas.
 * Depende apenas de Bootstrap 5 (opcional) e dos tokens --ou-*.
 */
(function () {
  "use strict";

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem("cart") || "[]");
    } catch (e) {
      return [];
    }
  }

  function ouNotify(message, type) {
    type = type || "success";
    if (typeof window.showToast === "function" && !document.getElementById("ouToastContainer")) {
      try {
        window.showToast(message, type === "success" ? "success" : type);
        return;
      } catch (e) {}
    }
    var container = document.getElementById("ouToastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "ouToastContainer";
      container.className = "ou-toast-container";
      document.body.appendChild(container);
    }
    var icons = {
      success: "bi-check-circle-fill",
      error: "bi-exclamation-circle-fill",
      warning: "bi-exclamation-triangle-fill",
      info: "bi-info-circle-fill",
    };
    var el = document.createElement("div");
    el.className = "ou-toast ou-toast--" + type;
    el.innerHTML = '<i class="bi ' + (icons[type] || icons.success) + '"></i><span></span>';
    el.querySelector("span").textContent = message;
    container.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("ou-toast--in"); });
    setTimeout(function () {
      el.classList.remove("ou-toast--in");
      setTimeout(function () { el.remove(); }, 250);
    }, 1800);
  }

  function atualizarIconeCarrinho() {
    var cart = getCart();
    var badge = document.getElementById("cartBadge");
    var cartBtn = document.getElementById("cartIcon") || document.getElementById("openCartModal");
    if (!cartBtn) return;
    try {
      if (getComputedStyle(cartBtn).position === "static") cartBtn.style.position = "relative";
    } catch (e) {}
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
      badge.style.zIndex = "10";
      cartBtn.appendChild(badge);
    }
    var total = cart.reduce(function (s, it) { return s + (Number(it.qt) || 0); }, 0);
    badge.textContent = total > 0 ? total : "";
    badge.style.display = total > 0 ? "inline-flex" : "none";
  }

  function mostrarPopupAdicionado() {
    ouNotify("Item adicionado ao carrinho!", "success");
  }

  // Modal do carrinho — fonte única (antes duplicado nos 4 HTMLs da loja).
  // Injetado via JS para não repetir ~20 linhas de markup por página.
  var CART_MODAL_HTML =
    '<div class="modal fade" id="cartModal" tabindex="-1" role="dialog" aria-labelledby="cartModalLabel" aria-hidden="true">' +
    '<div class="modal-dialog modal-dialog-centered" role="document"><div class="modal-content">' +
    '<div class="modal-header"><h5 class="modal-title" id="cartModalLabel"><i class="bi bi-cart2 me-2 text-primary"></i>Itens no Carrinho</h5>' +
    '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button></div>' +
    '<div class="modal-body" id="cartItems"></div>' +
    '<div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button></div>' +
    "</div></div></div>";

  function ensureCartModal() {
    if (!document.getElementById("cartModal")) {
      var wrap = document.createElement("div");
      wrap.innerHTML = CART_MODAL_HTML;
      document.body.appendChild(wrap.firstChild);
    }
  }

  function openCartModal() {
    ensureCartModal();
    renderCartModalItems();
    var modalEl = document.getElementById("cartModal");
    if (window.bootstrap && window.bootstrap.Modal && modalEl) {
      window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
    } else {
      // Sem Bootstrap: leva direto ao carrinho em vez de falhar silenciosamente.
      window.location.href = "carrinho";
    }
  }

  function renderCartModalItems() {
    ensureCartModal();
    var modalEl = document.getElementById("cartModal");
    var box = document.getElementById("cartItems");
    if (!box) return;
    var cart = getCart();
    if (cart.length === 0) {
      box.innerHTML = '<div class="ou-empty" style="padding:1.5rem 1rem;"><span class="ou-empty__icon"><i class="bi bi-cart"></i></span><div class="ou-empty__title">Carrinho vazio</div><div class="ou-empty__text">Adicione peças pelo catálogo.</div></div>';
    } else {
      box.innerHTML =
        '<ul class="list-group list-group-flush">' +
        cart
          .map(function (item, idx) {
            return (
              '<li class="list-group-item d-flex justify-content-between align-items-center gap-2 flex-wrap">' +
              '<span class="flex-grow-1"><span class="ou-cell-title">' +
              String(item.nome || "Produto").replace(/</g, "&lt;") +
              '</span><br><small class="ou-cell-sub">R$ ' +
              (item.preco ? Number(item.preco).toFixed(2) : "0.00") +
              " · qtd " +
              (Number(item.qt) || 0) +
              "</small></span>" +
              '<span class="d-flex align-items-center gap-2"><span class="ou-badge ou-badge--neutral">' +
              (Number(item.qt) || 0) +
              'x</span><button class="btn btn-outline-danger btn-sm btn-icon" onclick="removerItemCarrinho(' +
              idx +
              ')" title="Remover"><i class="bi bi-trash"></i></button></span></li>'
            );
          })
          .join("") +
        "</ul>";
    }
    var footer = document.querySelector("#cartModal .modal-footer");
    if (footer) {
      var old = document.getElementById("goToCartBtn");
      if (old) old.remove();
      var a = document.createElement("a");
      a.id = "goToCartBtn";
      a.className = "btn btn-primary";
      a.href = "carrinho";
      a.textContent = "Ir para o carrinho";
      a.addEventListener("click", function () {
        if (window.bootstrap && window.bootstrap.Modal && modalEl) {
          window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        }
        // Sem Bootstrap a navegação do link segue normalmente.
      });
      footer.appendChild(a);
    }
  }

  function removerItemCarrinho(idx) {
    var cart = getCart();
    cart.splice(idx, 1);
    localStorage.setItem("cart", JSON.stringify(cart));
    atualizarIconeCarrinho();
    renderCartModalItems();
  }

  // Expõe globalmente (mantém compat com páginas antigas)
  window.ouStorefront = {
    getCart: getCart,
    ouNotify: ouNotify,
    atualizarIconeCarrinho: atualizarIconeCarrinho,
    mostrarPopupAdicionado: mostrarPopupAdicionado,
    ensureCartModal: ensureCartModal,
    openCartModal: openCartModal,
    renderCartModalItems: renderCartModalItems,
    removerItemCarrinho: removerItemCarrinho,
  };
  window.atualizarIconeCarrinho = window.atualizarIconeCarrinho || atualizarIconeCarrinho;
  window.mostrarPopupAdicionado = window.mostrarPopupAdicionado || mostrarPopupAdicionado;
  window.removerItemCarrinho = window.removerItemCarrinho || removerItemCarrinho;
  window.ouNotify = window.ouNotify || ouNotify;

  document.addEventListener("DOMContentLoaded", function () {
    ensureCartModal();
    atualizarIconeCarrinho();
    var btn = document.getElementById("openCartModal");
    if (btn && !btn.dataset.ouBound) {
      btn.dataset.ouBound = "1";
      btn.addEventListener("click", openCartModal);
    }
  });
  window.addEventListener("pageshow", atualizarIconeCarrinho);
})();
