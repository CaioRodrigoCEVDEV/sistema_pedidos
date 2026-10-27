/* OrderUp Storefront — Carrinho / Checkout (fase 6).
 * Fonte única do carrinho na página /carrinho.
 * Delega badge/toast ao storefront-shared quando disponível.
 */
(function () {
  "use strict";

  // ---------- utils ----------
  function obterEmpresa() {
    if (typeof window.obterDadosEmpresa === "function") {
      return window.obterDadosEmpresa();
    }
    return fetch((window.BASE_URL || "") + "/emp").then(function (response) {
      return response.json();
    });
  }

  function getCart() {
    try {
      var cart = JSON.parse(localStorage.getItem("cart") || "[]");
      return Array.isArray(cart) ? cart : [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem("cart", JSON.stringify(cart));
  }

  function notify(message, type, duration) {
    if (typeof window.showToast === "function") {
      window.showToast(message, type || "info", duration == null ? 3000 : duration);
      return;
    }
    if (window.ouStorefront && typeof window.ouStorefront.ouNotify === "function") {
      window.ouStorefront.ouNotify(message, type || "info");
      return;
    }
    try {
      alert(message);
    } catch (e) {}
  }

  function refreshBadge() {
    if (window.ouStorefront && typeof window.ouStorefront.atualizarIconeCarrinho === "function") {
      window.ouStorefront.atualizarIconeCarrinho();
      return;
    }
    var cart = getCart();
    var total = cart.reduce(function (s, it) { return s + (Number(it.qt) || 0); }, 0);
    var badge = document.getElementById("cartBadge");
    if (badge) {
      badge.textContent = total > 0 ? total : "";
      badge.style.display = total > 0 ? "inline-flex" : "none";
    }
  }

  function findItemIndex(cart, rawId) {
    var wanted = String(rawId == null ? "" : rawId);
    for (var i = 0; i < cart.length; i++) {
      if (String(cart[i] && cart[i].id) === wanted) return i;
    }
    return -1;
  }

  function setCheckoutLoading(loading) {
    var box = document.getElementById("divFinalizar");
    if (box) {
      box.style.pointerEvents = loading ? "none" : "auto";
      box.style.opacity = loading ? "0.6" : "1";
      box.style.userSelect = loading ? "none" : "auto";
      box.classList.toggle("is-loading", !!loading);
    }
    document
      .querySelectorAll("#divFinalizar button, #cartResumoAcoes button")
      .forEach(function (btn) {
        btn.disabled = !!loading;
      });
  }

  // Marca visualmente a forma de atendimento escolhida (a ação finaliza o pedido).
  function marcarCanalSelecionado(canal) {
    var opcoes = [
      { id: "btnBalcao", canal: "BALCAO" },
      { id: "btnEntrega", canal: "ENTREGA" },
    ];
    opcoes.forEach(function (opt) {
      var el = document.getElementById(opt.id);
      if (!el) return;
      var selecionado = opt.canal === canal;
      el.classList.toggle("is-selected", selecionado);
      el.setAttribute("aria-pressed", selecionado ? "true" : "false");
    });
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function cartTotal(cart) {
    return cart.reduce(function (s, it) {
      return s + (parseFloat(it.preco) || 0) * (Number(it.qt) || 0);
    }, 0);
  }

  function syncCartParam(cart) {
    try {
      var url = new URL(window.location);
      if (cart.length > 0) {
        var cartJson = encodeURIComponent(
          btoa(unescape(encodeURIComponent(JSON.stringify(cart))))
        );
        url.searchParams.set("cart", cartJson);
      } else {
        url.searchParams.delete("cart");
      }
      window.history.replaceState({}, document.title, url.pathname + url.search);
    } catch (e) {
      console.error("Error updating URL cart parameter:", e);
    }
  }

  function clearCartAndRender() {
    saveCart([]);
    renderCart();
    refreshBadge();
    syncCartParam([]);
  }

  // Revalida no servidor os preços dos itens do carrinho. O cliente nunca define
  // preço: o valor exibido (e usado no pedido) vem sempre de /carrinho/precos.
  async function revalidarPrecos() {
    var cart = getCart();
    if (cart.length === 0) return cart;

    try {
      var resp = await fetch((window.BASE_URL || "") + "/carrinho/precos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itens: cart.map(function (it) {
            return { id: it.id, qt: it.qt };
          }),
        }),
      });
      if (!resp.ok) return cart;

      var data = await resp.json();
      var precos = Array.isArray(data.itens) ? data.itens : [];
      var porProcod = {};
      precos.forEach(function (p) {
        var cod = parseInt(String(p.procod), 10);
        if (!isNaN(cod)) porProcod[cod] = p;
      });

      var mudou = false;
      cart.forEach(function (it) {
        var cod = parseInt(String(it.id).split("-")[0], 10);
        var p = porProcod[cod];
        if (!p) return;
        var preco = Number(p.preco) || 0;
        var temPromo = p.provlpromo !== null && p.provlpromo !== undefined;
        if (Number(it.preco) !== preco) mudou = true;
        it.preco = preco;
        it.precoOriginal = temPromo ? Number(p.provl) || 0 : null;
      });
      if (mudou) saveCart(cart);
    } catch (e) {
      console.error("Erro ao revalidar preços do carrinho:", e);
    }

    return cart;
  }

  async function carregarCarrinho() {
    await revalidarPrecos();
    renderCart();
    refreshBadge();
  }

  // ---------- render ----------
  function mostrarCarrinhoVazio(vazio) {
    var layout = document.getElementById("cartConteudo");
    var vazioEl = document.getElementById("cartVazio");
    var btnLimpar = document.getElementById("btnLimparCarrinho");
    if (layout) layout.style.display = vazio ? "none" : "";
    if (vazioEl) vazioEl.style.display = vazio ? "" : "none";
    if (btnLimpar) btnLimpar.disabled = vazio;
  }

  function atualizarResumo(cart) {
    var total = cartTotal(cart);
    var itens = cart.reduce(function (s, it) {
      return s + (Number(it.qt) || 0);
    }, 0);
    var totalEl = document.getElementById("totalCarrinho");
    var subEl = document.getElementById("cartSubtotal");
    var itensEl = document.getElementById("cartItensCount");
    if (totalEl) totalEl.textContent = formatarMoeda(total);
    if (subEl) subEl.textContent = formatarMoeda(total);
    if (itensEl) itensEl.textContent = itens === 1 ? "1 item" : itens + " itens";
  }

  function criarLinhaCarrinho(item) {
    var valor = parseFloat(item.preco) || 0;
    var qtde = Number(item.qt) || 0;
    var subtotal = valor * qtde;
    var precoOriginal =
      item.precoOriginal != null ? parseFloat(item.precoOriginal) : null;
    var temPromocao =
      precoOriginal != null && precoOriginal > valor;

    var row = document.createElement("article");
    row.className = "ou-cart-item";
    row.dataset.preco = item.preco;

    // Bloco de identidade compartilhado (logo da marca, marca/modelo/tipo,
    // ícone do tipo, nome e valor unitário) — o mesmo usado no modal.
    if (window.ouStorefront && window.ouStorefront.montarIdentidadeItem) {
      row.appendChild(window.ouStorefront.montarIdentidadeItem(item));
    }

    var side = document.createElement("div");
    side.className = "ou-cart-item__side";

    var price = document.createElement("div");
    price.className = "ou-cart-item__price";
    if (temPromocao) {
      price.classList.add("ou-cart-item__price--promo");
      var old = document.createElement("span");
      old.className = "ou-price-old";
      old.textContent = formatarMoeda(precoOriginal * qtde);
      var promo = document.createElement("span");
      promo.className = "ou-price-promo";
      promo.textContent = formatarMoeda(subtotal);
      price.appendChild(old);
      price.appendChild(promo);
    } else {
      price.textContent = formatarMoeda(subtotal);
    }

    var controls = document.createElement("div");
    controls.className = "ou-cart-item__controls";

    var qty = document.createElement("span");
    qty.className = "ou-qty";
    var btnDec = document.createElement("button");
    btnDec.className = "btn btn-sm btn-light btn-icon";
    btnDec.type = "button";
    btnDec.title = "Diminuir";
    btnDec.setAttribute("aria-label", "Diminuir quantidade");
    btnDec.textContent = "−";
    btnDec.dataset.action = "dec";
    btnDec.dataset.id = String(item.id);
    btnDec.disabled = qtde <= 1;
    var b = document.createElement("b");
    b.textContent = String(qtde);
    var btnInc = document.createElement("button");
    btnInc.className = "btn btn-sm btn-light btn-icon";
    btnInc.type = "button";
    btnInc.title = "Aumentar";
    btnInc.setAttribute("aria-label", "Aumentar quantidade");
    btnInc.textContent = "+";
    btnInc.dataset.action = "inc";
    btnInc.dataset.id = String(item.id);
    qty.appendChild(btnDec);
    qty.appendChild(b);
    qty.appendChild(btnInc);

    var btnDel = document.createElement("button");
    btnDel.className = "btn btn-sm btn-outline-danger btn-icon";
    btnDel.type = "button";
    btnDel.title = "Remover";
    btnDel.setAttribute("aria-label", "Remover item");
    btnDel.dataset.action = "del";
    btnDel.dataset.id = String(item.id);
    btnDel.innerHTML = '<i class="bi bi-trash"></i>';

    controls.appendChild(qty);
    controls.appendChild(btnDel);
    side.appendChild(price);
    side.appendChild(controls);
    row.appendChild(side);
    return row;
  }

  function renderCart() {
    var corpo = document.getElementById("carrinhoCorpo");
    if (!corpo) return;
    corpo.innerHTML = "";

    var cart = getCart();
    if (cart.length === 0) {
      atualizarResumo(cart);
      mostrarCarrinhoVazio(true);
      syncCartParam([]);
      return;
    }

    mostrarCarrinhoVazio(false);
    cart.forEach(function (item) {
      corpo.appendChild(criarLinhaCarrinho(item));
    });
    atualizarResumo(cart);
    syncCartParam(cart);
  }

  // Delegação de cliques (sem inline onclick → sem XSS via id)
  document.addEventListener("click", function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest("[data-action]") : null;
    if (!btn || !document.getElementById("carrinhoCorpo")) return;
    var action = btn.dataset.action;
    var id = btn.dataset.id;
    if (action === "inc") incrementQuantity(id);
    else if (action === "dec") decrementQuantity(id);
    else if (action === "del") removeItem(id);
  });

  function incrementQuantity(itemId) {
    var cart = getCart();
    var idx = findItemIndex(cart, itemId);
    if (idx > -1) {
      cart[idx].qt = (Number(cart[idx].qt) || 0) + 1;
      saveCart(cart);
      renderCart();
      refreshBadge();
    }
  }

  function decrementQuantity(itemId) {
    var cart = getCart();
    var idx = findItemIndex(cart, itemId);
    if (idx > -1) {
      cart[idx].qt = (Number(cart[idx].qt) || 0) - 1;
      if (cart[idx].qt <= 0) cart.splice(idx, 1);
      saveCart(cart);
      renderCart();
      refreshBadge();
    }
  }

  function removeItem(itemId) {
    var cart = getCart();
    var idx = findItemIndex(cart, itemId);
    if (idx > -1) {
      cart.splice(idx, 1);
      saveCart(cart);
      renderCart();
      refreshBadge();
    }
  }

  function limparCarrinho() {
    clearCartAndRender();
  }

  // ---------- checkout ----------
  var EMOJI = {
    caixa: "📦",
    celular: "📱",
    dinheiro: "💰",
    loja: "🏬",
    caminhao: "🚚",
    obs: "📌",
  };

  // Mensagem compartilhada (orçamento/pedido) preserva o nome completo do
  // produto, incluindo a cor quando houver (ex.: "Tela (Preto)").
  function buildMensagemOrcamento(cart, observacoes, titulo, agrupar) {
    return window.OrderUpMensagemPecas(cart, observacoes, titulo, agrupar);
  }

  // Mensagem do pedido enviada pelo WhatsApp: reutiliza o MESMO bloco de itens,
  // mas com o título "PEDIDO DE PEÇAS" e o total. Não agrupa por tipo/modelo
  // (agrupar=false): o usuário final recebe só os itens. Observações já vêm do
  // bloco; o atendimento e o número do pedido são anexados por quem chama.
  function buildMensagem(cart, total, observacoes, canal) {
    var msg = buildMensagemOrcamento(cart, observacoes, "PEDIDO DE PEÇAS:", false);
    // Linha em branco entre o último item (ou observações) e o total.
    msg += "\n" + EMOJI.dinheiro + " Total: R$ " + total.toFixed(2) + "\n";
    return msg;
  }

  async function buscarUsuario() {
    try {
      var response = await fetch((window.BASE_URL || "") + "/usuario/viuversao", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (response.ok) {
        var data = await response.json();
        return data.usucod;
      }
      console.error("Erro ao buscar usuário:", response.statusText);
      return null;
    } catch (error) {
      console.error("Erro na requisição:", error);
      return null;
    }
  }

  async function criarPedidoNoServidor(pvcod, cart, total, observacoes, canal) {
    var resp = await fetch((window.BASE_URL || "") + "/pedidos/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pvcod: pvcod,
        cart: cart,
        total: total,
        obs: observacoes,
        canal: canal,
        status: "A",
        confirmado: "N",
        codigoVendedor: (await buscarUsuario()) || null,
      }),
    });
    var data = null;
    try {
      data = await resp.json();
    } catch (e) {}
    if (!resp.ok) {
      throw new Error((data && data.error) || "Erro ao processar pedido. Tente novamente.");
    }
    return data;
  }

  async function obterProximoPvcod() {
    var resp = await fetch("/pedidos/sequencia");
    if (!resp.ok) throw new Error("Não foi possível gerar o número do pedido.");
    var seq = await resp.json();
    return seq.nextval;
  }

  async function obterWhatsApp(numero) {
    var data = await obterEmpresa();
    return (data && (numero === 2 ? data.empwhatsapp2 : data.empwhatsapp1)) || "";
  }

  // O wa.me usa o número no formato internacional, apenas com dígitos.
  function normalizarNumeroWhatsApp(numero) {
    return String(numero == null ? "" : numero).replace(/\D/g, "");
  }

  function montarUrlWhatsApp(numero, mensagem) {
    var digitos = normalizarNumeroWhatsApp(numero);
    // Sem número válido não gera link: evita abrir o WhatsApp sem destinatário.
    if (digitos.length < 10 || digitos.length > 15) return "";
    return (
      "https://wa.me/" +
      digitos +
      "?text=" +
      encodeURIComponent(String(mensagem == null ? "" : mensagem))
    );
  }

  // Abre o WhatsApp em nova aba. Se o navegador bloquear, usa a aba atual.
  // Retorna true quando conseguiu abrir em nova aba.
  function redirecionarWhats(url) {
    if (!url) return false;

    var destino = null;
    try {
      destino = window.open(url, "_blank");
    } catch (e) {
      destino = null;
    }

    if (destino) {
      try {
        destino.opener = null;
      } catch (e) {}
      return true;
    }

    // Pop-up bloqueado: abre na aba atual e não agenda o retorno ao catálogo,
    // pois isso interromperia a navegação para o WhatsApp.
    window.location.href = url;
    return false;
  }

  async function finalizarViaWhatsApp(canal) {
    var cart = getCart();
    var obsEl = document.getElementById("observacoes");
    var observacoes = obsEl ? obsEl.value.trim() : "";
    if (cart.length === 0) {
      cancelarCopiaDiferida();
      notify("Seu carrinho está vazio!", "warning");
      return;
    }
    setCheckoutLoading(true);
    try {
      var pvcod = await obterProximoPvcod();
      var total = cartTotal(cart);
      await criarPedidoNoServidor(pvcod, cart, total, observacoes, canal);

      var mensagem = buildMensagem(cart, total, observacoes, canal);
      if (canal === "ENTREGA") {
        mensagem += EMOJI.caminhao + " Entrega\n";
      } else {
        mensagem += EMOJI.loja + " Retirada: No balcão\n";
      }
      mensagem += "Pedido N°: " + pvcod + "\n";

      // A cópia já foi reservada no clique de confirmação (Safari/iOS). Se o
      // navegador não suportar ClipboardItem, copia agora como fallback.
      var copiaMensagem = concluirCopiaDiferida(mensagem);
      if (!copiaMensagem) copiaMensagem = copiarMensagemPedido(mensagem);

      var numero = "";
      try {
        numero = await obterWhatsApp(canal === "ENTREGA" ? 2 : 1);
      } catch (e) {
        console.error("Erro ao buscar número do WhatsApp:", e);
      }

      var url = montarUrlWhatsApp(numero, mensagem);
      // O pedido já foi criado: esvazia o carrinho para que uma nova tentativa
      // não gere um segundo pedido, mesmo se o WhatsApp não puder ser aberto.
      clearCartAndRender();

      if (!url) {
        setCheckoutLoading(false);
        notify(
          "Pedido N° " +
            pvcod +
            " registrado, mas o WhatsApp da loja não está configurado. Entre em contato com a loja.",
          "warning",
          8000
        );
        return;
      }

      // Aguarda a cópia terminar antes de navegar (com limite para não travar
      // a abertura do WhatsApp caso o navegador peça permissão).
      await Promise.race([
        copiaMensagem,
        new Promise(function (resolve) {
          setTimeout(resolve, 1500);
        }),
      ]);

      var abriuNovaAba = redirecionarWhats(url);
      if (abriuNovaAba) {
        // Retorna o usuário ao catálogo na aba atual.
        setTimeout(function () {
          window.location.href = "index";
        }, 500);
      }
    } catch (error) {
      console.error("Erro ao processar pedido:", error);
      cancelarCopiaDiferida(error);
      notify(error.message || "Erro ao processar pedido. Tente novamente.", "error");
      setCheckoutLoading(false);
    }
  }

  function enviarWhatsApp() {
    return finalizarViaWhatsApp("BALCAO");
  }

  function enviarWhatsAppEntrega() {
    return finalizarViaWhatsApp("ENTREGA");
  }

  function reabilitarBotoes() {
    setCheckoutLoading(false);
  }

  function obterMensagemOrcamento() {
    var cart = getCart();
    var obsEl = document.getElementById("observacoes");
    var observacoes = obsEl ? obsEl.value.trim() : "";
    if (cart.length === 0) {
      notify("Seu carrinho está vazio!", "warning");
      return null;
    }
    return buildMensagemOrcamento(cart, observacoes);
  }

  function copiarTextoParaClipboard(mensagem, onOk, onFail) {
    return new Promise(function (resolve) {
      var finalizado = false;

      function concluir(ok, err) {
        if (finalizado) return;
        finalizado = true;
        try {
          if (ok && typeof onOk === "function") onOk();
          else if (!ok && typeof onFail === "function") onFail(err);
        } finally {
          resolve(ok);
        }
      }

      function copiarComSelecao() {
        var ta = document.createElement("textarea");
        ta.value = mensagem;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "0";
        ta.style.left = "0";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        var copiou = false;
        try {
          copiou = document.execCommand("copy");
        } catch (err) {
          copiou = false;
        }
        document.body.removeChild(ta);
        if (copiou) concluir(true);
        else concluir(false, new Error("Não foi possível copiar o texto."));
      }

      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        try {
          navigator.clipboard.writeText(mensagem).then(
            function () {
              concluir(true);
            },
            copiarComSelecao
          );
          return;
        } catch (err) {
          // Cai no fallback síncrono abaixo.
        }
      }
      copiarComSelecao();
    });
  }

  function copiarOrcamentoParaClipboard() {
    var mensagem = obterMensagemOrcamento();
    if (mensagem == null) return;
    copiarTextoParaClipboard(
      mensagem,
      function () {
        notify("Orçamento copiado!", "success");
      },
      function (err) {
        notify("Erro ao copiar: " + err, "error");
      }
    );
  }

  function copiarMensagemPedido(mensagem) {
    return copiarTextoParaClipboard(
      mensagem,
      function () {
        notify("Mensagem do pedido copiada!", "success", 2500);
      },
      function (err) {
        // A cópia é um apoio ao envio; uma falha não deve impedir o WhatsApp.
        console.error("Erro ao copiar a mensagem do pedido:", err);
      }
    );
  }

  var copiaDiferida = null;

  function suportaCopiaDiferida() {
    return (
      typeof window.ClipboardItem === "function" &&
      navigator.clipboard &&
      typeof navigator.clipboard.write === "function"
    );
  }

  function cancelarCopiaDiferida(err) {
    if (!copiaDiferida) return;
    var atual = copiaDiferida;
    copiaDiferida = null;
    try {
      atual.rejeitar(err || new Error("Cópia cancelada."));
    } catch (e) {}
    if (atual.escrita && typeof atual.escrita.catch === "function") {
      atual.escrita.catch(function () {});
    }
  }

  // Inicia a escrita da área de transferência ainda dentro do gesto do
  // usuário. O texto final (com o número do pedido) é resolvido somente
  // depois que o servidor confirma a criação do pedido. Esse formato é
  // necessário no Safari do iPhone, que rejeita writeText após um await.
  function iniciarCopiaDiferida() {
    cancelarCopiaDiferida();
    if (!suportaCopiaDiferida()) return;

    var resolver;
    var rejeitar;
    var conteudo = new Promise(function (resolve, reject) {
      resolver = resolve;
      rejeitar = reject;
    });

    var escrita;
    try {
      escrita = navigator.clipboard.write([
        new window.ClipboardItem({ "text/plain": conteudo }),
      ]);
    } catch (e) {
      return;
    }

    copiaDiferida = {
      escrita: Promise.resolve(escrita),
      resolver: resolver,
      rejeitar: rejeitar,
    };
    copiaDiferida.escrita.catch(function () {});
  }

  function concluirCopiaDiferida(mensagem) {
    if (!copiaDiferida) return null;
    var atual = copiaDiferida;
    copiaDiferida = null;

    try {
      atual.resolver(new Blob([mensagem], { type: "text/plain" }));
    } catch (e) {
      atual.rejeitar(e);
    }

    return atual.escrita.then(
      function () {
        notify("Mensagem do pedido copiada!", "success", 2500);
        return true;
      },
      function (err) {
        console.error("Erro ao copiar a mensagem do pedido:", err);
        // Fallback para navegadores que não aceitaram a cópia diferida.
        return copiarMensagemPedido(mensagem);
      }
    );
  }

  // Abre o modal de confirmação (#confirmarRegistroModal) com conteúdo
  // configurável e resolve true (confirmou) / false (cancelou).
  function confirmarAcao(config) {
    config = config || {};
    return new Promise(function (resolve) {
      var modalEl = document.getElementById("confirmarRegistroModal");
      var btnConfirmar = document.getElementById("confirmarRegistroBtn");
      if (!modalEl || !btnConfirmar || !window.bootstrap) {
        var confirmado = window.confirm(
          config.fallbackMessage || "Confirmar esta ação?"
        );
        if (confirmado && typeof config.onConfirm === "function") {
          try {
            config.onConfirm();
          } catch (e) {
            console.error("Erro ao preparar a ação confirmada:", e);
          }
        }
        resolve(confirmado);
        return;
      }

      var iconEl = document.getElementById("confirmarRegistroIcon");
      var titleEl = document.getElementById("confirmarRegistroTitle");
      var descEl = document.getElementById("confirmarRegistroDesc");
      var questionEl = document.getElementById("confirmarRegistroQuestion");
      var labelEl = document.getElementById("confirmarRegistroBtnLabel");
      if (iconEl) {
        iconEl.className =
          "bi " + (config.icon || "bi-check2-circle") + " text-primary me-1";
      }
      if (titleEl) titleEl.textContent = config.title || "Confirmar";
      if (descEl) descEl.textContent = config.description || "";
      if (questionEl) questionEl.textContent = config.question || "";
      if (labelEl) labelEl.textContent = config.confirmLabel || "Confirmar";

      var modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
      var confirmou = false;
      function onConfirmar() {
        if (confirmou) return;
        confirmou = true;
        // Executa ainda dentro do clique de confirmação (gesto do usuário).
        if (typeof config.onConfirm === "function") {
          try {
            config.onConfirm();
          } catch (e) {
            console.error("Erro ao preparar a ação confirmada:", e);
          }
        }
        modal.hide();
      }
      function onHidden() {
        btnConfirmar.removeEventListener("click", onConfirmar);
        modalEl.removeEventListener("hidden.bs.modal", onHidden);
        resolve(confirmou);
      }
      btnConfirmar.addEventListener("click", onConfirmar);
      modalEl.addEventListener("hidden.bs.modal", onHidden);
      modal.show();
    });
  }

  function confirmarRegistroPedido() {
    return confirmarAcao({
      icon: "bi-check2-circle",
      title: "Registrar pedido",
      description: "O pedido será finalizado e o carrinho esvaziado.",
      question: "Deseja realmente registrar este pedido?",
      confirmLabel: "Registrar pedido",
      fallbackMessage:
        "Confirmar o registro deste pedido? O carrinho será finalizado.",
    });
  }

  // Confirma e finaliza pelo WhatsApp na forma de atendimento escolhida.
  async function finalizarCanalComConfirmacao(canal) {
    if (getCart().length === 0) {
      notify("Seu carrinho está vazio!", "warning");
      return;
    }
    var entrega = canal === "ENTREGA";
    var confirmou = await confirmarAcao({
      icon: entrega ? "bi-truck" : "bi-shop",
      title: entrega ? "Entrega" : "Retirada no balcão",
      description:
        "O pedido será finalizado, a mensagem copiada para a área de transferência e o WhatsApp aberto.",
      question: entrega
        ? "Deseja finalizar o pedido com entrega?"
        : "Deseja finalizar o pedido com retirada no balcão?",
      confirmLabel: entrega ? "Confirmar entrega" : "Confirmar retirada",
      fallbackMessage: entrega
        ? "Confirmar pedido com entrega?"
        : "Confirmar pedido com retirada no balcão?",
      // Reserva a escrita na área de transferência dentro do gesto do usuário.
      onConfirm: iniciarCopiaDiferida,
    });
    if (!confirmou) return;
    marcarCanalSelecionado(canal);
    if (entrega) return enviarWhatsAppEntrega();
    return enviarWhatsApp();
  }

  async function registrarPedido() {
    var cart = getCart();
    if (cart.length === 0) {
      notify("Seu carrinho está vazio!", "warning");
      return;
    }
    if (!(await confirmarRegistroPedido())) return;
    setCheckoutLoading(true);
    try {
      var obsEl = document.getElementById("observacoes");
      var observacoes = obsEl ? obsEl.value.trim() : "";
      var total = cartTotal(cart);
      var pvcod = await obterProximoPvcod();
      await criarPedidoNoServidor(pvcod, cart, total, observacoes, "VENDA");
      clearCartAndRender();
      notify("Pedido registrado com sucesso!", "success");
      setTimeout(function () {
        window.location.href = "index";
      }, 500);
    } catch (error) {
      console.error("Erro ao processar pedido:", error);
      notify(error.message || "Erro ao processar pedido. Tente novamente.", "error");
      setCheckoutLoading(false);
    }
  }

  async function carregarUsuarioLogado() {
    try {
      var response = await fetch((window.BASE_URL || "") + "/me/usuario", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (response.ok) {
        var data = await response.json();
        return data.usunome;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // ---------- boot ----------
  ouOnLoad(function () {
    carregarCarrinho();

    var btnLimpar = document.getElementById("btnLimparCarrinho");
    if (btnLimpar) btnLimpar.addEventListener("click", limparCarrinho);
    var btnVoltar = document.getElementById("btnVoltar");
    if (btnVoltar) btnVoltar.addEventListener("click", function () { window.history.back(); });
    var btnBalcao = document.getElementById("btnBalcao");
    if (btnBalcao) {
      btnBalcao.addEventListener("click", function () {
        finalizarCanalComConfirmacao("BALCAO");
      });
    }
    var btnEntrega = document.getElementById("btnEntrega");
    if (btnEntrega) {
      btnEntrega.addEventListener("click", function () {
        finalizarCanalComConfirmacao("ENTREGA");
      });
    }
    var btnOrc = document.getElementById("botao-orcamento");
    if (btnOrc) btnOrc.addEventListener("click", copiarOrcamentoParaClipboard);
    var btnReg = document.getElementById("botao-registrar-pedido");
    if (btnReg) btnReg.addEventListener("click", registrarPedido);

    obterEmpresa()
      .then(function (data) {
        var botaoOrcamento = document.getElementById("botao-orcamento");
        var botaoRegistrar = document.getElementById("botao-registrar-pedido");
        carregarUsuarioLogado().then(function (usuarioLogado) {
          var show = usuarioLogado ? "inline" : "none";
          if (botaoOrcamento) botaoOrcamento.style.display = show;
          if (botaoRegistrar) botaoRegistrar.style.display = show;
        });
      })
      .catch(function (error) {
        console.error("Erro ao buscar configurações da empresa:", error);
      });

    window.addEventListener("beforeunload", function () {
      try { localStorage.removeItem("usuarioLogado"); } catch (e) {}
    });
  });

  window.addEventListener("pageshow", function () {
    carregarCarrinho();
  });

  // Compat: HTML antigo em cache ainda chama via inline onclick
  window.renderCart = renderCart;
  window.limparCarrinho = limparCarrinho;
  window.incrementQuantity = incrementQuantity;
  window.decrementQuantity = decrementQuantity;
  window.removeItem = removeItem;
  window.enviarWhatsApp = enviarWhatsApp;
  window.enviarWhatsAppEntrega = enviarWhatsAppEntrega;
  window.copiarOrcamentoParaClipboard = copiarOrcamentoParaClipboard;
  window.registrarPedido = registrarPedido;
  window.reabilitarBotoes = reabilitarBotoes;
  window.buscarUsuario = buscarUsuario;
  window.formatarMoeda = window.formatarMoeda || formatarMoeda;
  window.atualizarIconeCarrinho = window.atualizarIconeCarrinho || refreshBadge;
})();
