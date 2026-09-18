/**
 * OrderUp Storefront — Vitrines da página inicial.
 * Busca as vitrines ativas em /showcases e monta os carrosséis respeitando a
 * ordem/configuração definida no painel. Sem itens, a seção não é exibida.
 * Reutiliza o visual do card de peça (.ou-product-card) do catálogo.
 */
(function () {
  "use strict";

  var container = document.getElementById("showcasesArea");
  if (!container) return;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  // Mesma leitura de status usada na lista de peças (dados reais do catálogo).
  function obterStatusPeca(item) {
    if (String(item.prosemest || "").toUpperCase() === "S") {
      return {
        classe: "ou-product-card__status--out",
        texto: "Sem estoque",
      };
    }
    if (String(item.proacabando || "").toUpperCase() === "S") {
      return {
        classe: "ou-product-card__status--low",
        texto: "Últimas unidades",
      };
    }
    return {
      classe: "ou-product-card__status--in",
      texto: "Em estoque",
    };
  }

  // Mantém o fluxo atual do catálogo: tipo -> marca -> modelo -> lista de
  // peças. Sem contexto completo, cai para a lista de modelos da marca.
  function montarHref(item) {
    if (item.tipocod && item.marcascod && item.modcod) {
      var query = new URLSearchParams({
        id: String(item.tipocod),
        marcascod: String(item.marcascod),
        modelo: String(item.modcod),
      });
      return "lista-pecas?" + query.toString();
    }
    if (item.marcascod) {
      return (
        "modelo?id=" +
        encodeURIComponent(item.marcascod) +
        "&marcascod=" +
        encodeURIComponent(item.marcascod)
      );
    }
    return null;
  }

  function obterCarrinho() {
    if (window.ouStorefront && typeof window.ouStorefront.getCart === "function") {
      var viaStorefront = window.ouStorefront.getCart();
      if (Array.isArray(viaStorefront)) return viaStorefront;
    }
    try {
      var cart = JSON.parse(localStorage.getItem("cart") || "[]");
      return Array.isArray(cart) ? cart : [];
    } catch (e) {
      return [];
    }
  }

  function adicionarAoCarrinho(card) {
    if (!card) return;
    var procod = card.dataset.procod;
    if (procod == null || procod === "") return;

    var cart = obterCarrinho();
    var idx = -1;
    for (var i = 0; i < cart.length; i++) {
      if (String(cart[i] && cart[i].id) === String(procod)) {
        idx = i;
        break;
      }
    }

    if (idx > -1) {
      cart[idx].qt = (Number(cart[idx].qt) || 0) + 1;
    } else {
      cart.push({
        id: procod,
        nome: card.dataset.nome || "Produto",
        tipo: card.dataset.tipo || "",
        marca: card.dataset.marca || "",
        modelo: card.dataset.modelo || "",
        preco: Number(card.dataset.preco) || 0,
        qt: 1,
      });
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    if (window.ouStorefront) {
      window.ouStorefront.atualizarIconeCarrinho();
      window.ouStorefront.mostrarPopupAdicionado();
    }
  }

  function tratarAdicionar(event) {
    var alvo = event.target;
    var add = alvo && alvo.closest ? alvo.closest(".ou-product-card__add") : null;
    if (!add) return;
    event.preventDefault();
    event.stopPropagation();
    adicionarAoCarrinho(add.closest(".ou-product-card"));
  }

  function criarCard(item) {
    var status = obterStatusPeca(item);
    var icone =
      window.OrderUpTipoIcon && item.tipodes
        ? window.OrderUpTipoIcon(item.tipodes)
        : "bi-tools";
    var href = montarHref(item);
    var contexto = [item.marcasdes, item.moddes].filter(Boolean).join(" · ");
    var marca = String(item.marcasdes || "").trim();
    var logo =
      window.OrderUpBrandLogo && marca
        ? window.OrderUpBrandLogo.get(marca)
        : { primary: (window.OrderUpBrandLogo && window.OrderUpBrandLogo.fallback) || "https://cdn.simpleicons.org/cog/000" };

    var card = document.createElement(href ? "a" : "div");
    card.className = "ou-product-card ou-product-card--shelf";
    if (href) card.href = href;
    card.dataset.procod = item.procod;
    card.dataset.nome = item.prodes || "Produto";
    card.dataset.tipo = item.tipodes || "";
    card.dataset.marca = item.marcasdes || "";
    card.dataset.modelo = item.moddes || "";
    card.dataset.preco = Number(item.provl) || 0;
    card.setAttribute(
      "aria-label",
      (item.prodes || "Produto") + (href ? " — ver produto" : "")
    );

    card.innerHTML =
      '<span class="ou-product-card__brand">' +
      '<img class="ou-product-card__brand-img" src="' +
      logo.primary +
      '" alt="' +
      (marca ? escapeHtml(marca) : "Marca") +
      '" loading="lazy" />' +
      "</span>" +
      '<div class="ou-product-card__main">' +
      '<h3 class="ou-product-card__name">' +
      escapeHtml(item.prodes || "Produto") +
      "</h3>" +
      '<div class="ou-product-card__meta">' +
      (item.tipodes
        ? '<span class="ou-product-card__type"><i class="bi ' +
          icone +
          '" aria-hidden="true"></i>' +
          escapeHtml(item.tipodes) +
          "</span>"
        : "") +
      '<span class="ou-product-card__status ' +
      status.classe +
      '">' +
      status.texto +
      "</span>" +
      "</div>" +
      (contexto
        ? '<div class="ou-product-card__context">' +
          escapeHtml(contexto) +
          "</div>"
        : "") +
      "</div>" +
      '<div class="ou-product-card__aside">' +
      '<div class="ou-product-card__price">' +
      formatarMoeda(item.provl) +
      "</div>" +
      '<span class="btn btn-primary btn-sm ou-product-card__add" role="button" tabindex="0" aria-label="Adicionar ' +
      escapeHtml(item.prodes || "Produto") +
      ' ao carrinho">Adicionar ao carrinho</span>' +
      "</div>";

    var logoImg = card.querySelector(".ou-product-card__brand-img");
    if (logoImg) {
      logoImg.onerror = function () {
        logoImg.onerror = null;
        logoImg.src =
          (window.OrderUpBrandLogo && window.OrderUpBrandLogo.fallback) ||
          "https://cdn.simpleicons.org/cog/000";
      };
    }

    return card;
  }

  function ligarCarrossel(section, track) {
    var nav = section.querySelector(".ou-showcase__nav");
    var arrows = nav.querySelectorAll(".ou-showcase__arrow");

    function passo() {
      var item = track.querySelector(".ou-showcase__item");
      if (!item) return track.clientWidth;
      var estilo = window.getComputedStyle(track);
      var gap = parseFloat(estilo.columnGap || estilo.gap || "12") || 12;
      return item.getBoundingClientRect().width + gap;
    }

    function atualizarNav() {
      var maxScroll = track.scrollWidth - track.clientWidth;
      // Ignora o padding do trilho (0.2rem de cada lado) para não exibir as
      // setas quando o conteúdo cabe.
      var overflow = maxScroll > 16;
      nav.hidden = !overflow;
      if (!overflow) return;
      arrows[0].disabled = track.scrollLeft <= 2;
      arrows[1].disabled = track.scrollLeft >= maxScroll - 2;
    }

    for (var i = 0; i < arrows.length; i++) {
      arrows[i].addEventListener("click", function () {
        var direcao = Number(this.getAttribute("data-dir")) || 1;
        track.scrollBy({ left: direcao * passo(), behavior: "smooth" });
      });
    }

    track.addEventListener("scroll", atualizarNav, { passive: true });

    track.addEventListener("keydown", function (event) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        track.scrollBy({ left: passo(), behavior: "smooth" });
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        track.scrollBy({ left: -passo(), behavior: "smooth" });
      }
    });

    if (window.ResizeObserver) {
      new ResizeObserver(atualizarNav).observe(track);
    } else {
      window.addEventListener("resize", atualizarNav);
    }

    window.requestAnimationFrame(atualizarNav);
  }

  function criarVitrine(showcase) {
    var titulo = String(showcase.title || "").trim() || "Vitrine";
    var section = document.createElement("section");
    section.className = "ou-showcase";
    section.setAttribute("data-type", showcase.type || "");

    section.innerHTML =
      '<div class="ou-results-head ou-showcase__head">' +
      '<div class="ou-results-head__heading">' +
      '<h2 class="ou-results-head__title">' +
      escapeHtml(titulo) +
      "</h2>" +
      "</div>" +
      '<div class="ou-showcase__nav" hidden>' +
      '<button type="button" class="ou-showcase__arrow" data-dir="-1" aria-label="Produtos anteriores de ' +
      escapeHtml(titulo) +
      '"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>' +
      '<button type="button" class="ou-showcase__arrow" data-dir="1" aria-label="Próximos produtos de ' +
      escapeHtml(titulo) +
      '"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>' +
      "</div>" +
      "</div>" +
      '<div class="ou-showcase__track" role="region" aria-label="' +
      escapeHtml(titulo) +
      '" tabindex="0"></div>';

    var track = section.querySelector(".ou-showcase__track");

    var itens = (showcase.items || []).filter(function (item) {
      return String(item.prosemest || "").trim().toUpperCase() !== "S";
    });

    if (!itens.length) return null;

    itens.forEach(function (item) {
      var wrapper = document.createElement("div");
      wrapper.className = "ou-showcase__item";
      wrapper.appendChild(criarCard(item));
      track.appendChild(wrapper);
    });

    ligarCarrossel(section, track);
    return section;
  }

  function renderizar(showcases) {
    container.innerHTML = "";
    showcases.forEach(function (showcase) {
      var section = criarVitrine(showcase);
      if (section) container.appendChild(section);
    });
    container.hidden = container.children.length === 0;
  }

  async function carregar() {
    try {
      var response = await fetch(BASE_URL + "/showcases", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao buscar vitrines");

      var data = await response.json();
      var showcases = Array.isArray(data.showcases) ? data.showcases : [];
      renderizar(showcases);
    } catch (error) {
      // As vitrines complementam a home: em caso de falha, a página segue
      // funcionando normalmente sem elas.
      console.error("Erro ao carregar vitrines:", error);
      container.hidden = true;
    }
  }

  container.addEventListener("click", tratarAdicionar);
  container.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") tratarAdicionar(event);
  });

  document.addEventListener("DOMContentLoaded", carregar);
})();
