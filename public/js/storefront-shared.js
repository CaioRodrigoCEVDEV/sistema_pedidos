/**
 * OrderUp Storefront — helpers compartilhados (loja pública).
 * Usado por index / modelo / pecas / lista-pecas.
 * Depende apenas de Bootstrap 5 (opcional) e dos tokens --ou-*.
 */
(function () {
  "use strict";

  var LOGO_FALLBACK = "https://cdn.simpleicons.org/cog/000";

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem("cart") || "[]");
    } catch (e) {
      return [];
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function formatBRL(value) {
    return "R$ " + (Number(value) || 0).toFixed(2).replace(".", ",");
  }

  // Bloco de identidade do item do carrinho (reutilizado no modal e na página):
  // logo da marca + contexto (marca · modelo · tipo com ícone) + nome + unitário.
  function montarIdentidadeItem(item) {
    var nome = escapeHtml(item.nome || "Produto");
    var marca = String(item.marca || "").trim();
    var modelo = String(item.modelo || "").trim();
    var tipo = String(item.tipo || "").trim();
    var valor = Number(item.preco) || 0;

    var logo = { primary: LOGO_FALLBACK };
    if (marca && window.OrderUpBrandLogo && window.OrderUpBrandLogo.get) {
      logo = window.OrderUpBrandLogo.get(marca);
    }
    var icone =
      tipo && window.OrderUpTipoIcon ? window.OrderUpTipoIcon(tipo) : "bi-tools";

    var partes = [];
    if (marca) {
      partes.push('<span class="ou-cart-id__label">' + escapeHtml(marca) + "</span>");
    }
    if (modelo) {
      partes.push('<span class="ou-cart-id__label">' + escapeHtml(modelo) + "</span>");
    }
    if (tipo) {
      partes.push(
        '<span class="ou-cart-id__type"><i class="bi ' +
          icone +
          '" aria-hidden="true"></i>' +
          escapeHtml(tipo) +
          "</span>"
      );
    }
    var contexto = partes.length
      ? '<div class="ou-cart-id__context">' +
        partes.join('<span class="ou-cart-id__sep" aria-hidden="true">·</span>') +
        "</div>"
      : "";

    var wrap = document.createElement("div");
    wrap.className = "ou-cart-id";
    wrap.innerHTML =
      '<span class="ou-cart-id__logo"><img src="' +
      logo.primary +
      '" alt="" loading="lazy" /></span>' +
      '<div class="ou-cart-id__body">' +
      contexto +
      '<h3 class="ou-cart-id__name">' +
      nome +
      "</h3>" +
      '<div class="ou-cart-id__unit">Unitário: ' +
      formatBRL(valor) +
      "</div>" +
      "</div>";

    var img = wrap.querySelector("img");
    if (img) {
      img.onerror = function () {
        img.onerror = null;
        img.src = LOGO_FALLBACK;
      };
    }
    return wrap;
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
    '<div class="modal fade" id="cartModal" tabindex="-1" aria-labelledby="cartModalLabel" aria-hidden="true">' +
    '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable ou-cart-modal__dialog" role="document">' +
    '<div class="modal-content">' +
    '<div class="modal-header ou-cart-modal__header">' +
    '<h5 class="modal-title ou-cart-modal__title" id="cartModalLabel">' +
    '<span class="ou-cart-modal__icon"><i class="bi bi-cart2" aria-hidden="true"></i></span>' +
    "Itens no Carrinho" +
    "</h5>" +
    '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>' +
    "</div>" +
    '<div class="modal-body ou-cart-modal__body" id="cartItems"></div>' +
    '<div class="modal-footer ou-cart-modal__footer">' +
    '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>' +
    "</div>" +
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
    box.innerHTML = "";
    var cart = getCart();

    if (cart.length === 0) {
      box.innerHTML =
        '<div class="ou-empty"><span class="ou-empty__icon"><i class="bi bi-cart"></i></span>' +
        '<div class="ou-empty__title">Seu carrinho está vazio</div>' +
        '<div class="ou-empty__text">Adicione peças pelo catálogo.</div></div>';
    } else {
      var list = document.createElement("ul");
      list.className = "ou-cart-modal__list";

      cart.forEach(function (item, idx) {
        var li = document.createElement("li");
        li.className = "ou-cart-modal__item";
        li.appendChild(montarIdentidadeItem(item));

        var actions = document.createElement("div");
        actions.className = "ou-cart-modal__actions";

        var qty = document.createElement("span");
        qty.className = "ou-cart-modal__qty";
        qty.textContent = "qtd. " + (Number(item.qt) || 0);
        actions.appendChild(qty);

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-outline-danger btn-sm btn-icon";
        btn.title = "Remover";
        btn.setAttribute("aria-label", "Remover item");
        btn.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
        btn.addEventListener("click", function () {
          removerItemCarrinho(idx);
        });
        actions.appendChild(btn);

        li.appendChild(actions);
        list.appendChild(li);
      });

      box.appendChild(list);
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
    montarIdentidadeItem: montarIdentidadeItem,
    formatBRL: formatBRL,
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
