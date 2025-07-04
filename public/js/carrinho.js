const params = new URLSearchParams(window.location.search);

const id = params.get("id");
const modelo = params.get("modelo");
const marcascod = params.get("marcascod");
const qtde = params.get("qtde");

function renderCart() {
  const corpoTabela = document.getElementById("carrinhoCorpo");
  const totalCarrinhoElement = document.getElementById("totalCarrinho");
  corpoTabela.innerHTML = ""; // Limpa a tabela antes de renderizar

  let cart = JSON.parse(localStorage.getItem("cart") || "[]");
  let totalValue = 0;

  if (cart.length === 0) {
    corpoTabela.innerHTML =
      '<tr><td colspan="4" class="text-center">Seu carrinho está vazio.</td></tr>';
    totalCarrinhoElement.innerHTML = "0.00";
    // Opcional: remover o parâmetro 'cart' da URL se o carrinho do localStorage estiver vazio
    const url = new URL(window.location);
    if (url.searchParams.has("cart")) {
      url.searchParams.delete("cart");
      window.history.replaceState(
        {},
        document.title,
        url.pathname + url.search
      );
    }
    return;
  }

  cart.forEach((item, index) => {
    // Adicionado index para identificar o item
    const nome = item.nome || "---";
    const qtde = item.qt || 0;
    const valor = parseFloat(item.preco) || 0;
    const itemTotal = valor * qtde;
    totalValue += itemTotal;

    const tr = document.createElement("tr");
    // Usar item.id se disponível e único, caso contrário, index é uma fallback.
    // Assumindo que item.id existe e é o procod.
    const itemId = item.id;

    tr.innerHTML = `
            <td>${nome}</td>
            <td class="text-center">
                <div style="display: flex; align-items: center; justify-content: center;">
                    <button class="btn btn-sm btn-outline-secondary" onclick="decrementQuantity('${itemId}')" style="flex-shrink: 0;">-</button>
                    <span class="mx-2" style="min-width: 20px; text-align: center;">${qtde}</span>
                    <button class="btn btn-sm btn-outline-secondary" onclick="incrementQuantity('${itemId}')" style="flex-shrink: 0;">+</button>
                </div>
            </td>
            <td>${valor.toFixed(2)}</td>
            <td>${itemTotal.toFixed(2)}</td> 
        `;
    corpoTabela.appendChild(tr);
  });

  totalCarrinhoElement.innerHTML = totalValue.toFixed(2);

  // Atualiza o parâmetro 'cart' na URL para refletir o estado do localStorage
  // Isso é útil se o usuário recarregar a página ou compartilhar o link,
  // embora o localStorage seja a fonte primária de verdade dentro da sessão.
  try {
    const cartJson = encodeURIComponent(
      btoa(unescape(encodeURIComponent(JSON.stringify(cart))))
    );
    const url = new URL(window.location);
    if (cart.length > 0) {
      url.searchParams.set("cart", cartJson);
    } else {
      url.searchParams.delete("cart"); // Remove se o carrinho estiver vazio
    }
    window.history.replaceState({}, document.title, url.pathname + url.search);
  } catch (e) {
    console.error("Error updating URL cart parameter:", e);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const urlParams = new URLSearchParams(window.location.search);
  const cartParam = urlParams.get("cart");
  let cartFromUrl = [];

  if (cartParam) {
    try {
      const jsonStr = decodeURIComponent(atob(decodeURIComponent(cartParam)));
      cartFromUrl = JSON.parse(jsonStr);
    } catch (erro) {
      console.error("Erro ao processar carrinho da URL:", erro);
      // Se houver erro ao ler da URL, priorizar o localStorage ou começar vazio.
    }
  }

  // Sincronizar localStorage com dados da URL se vierem da URL e o localStorage estiver vazio ou diferente
  // Normalmente, o localStorage deve ser a fonte de verdade se já populado.
  // Se o carrinho da URL existir, ele populará o localStorage.
  let localCart = JSON.parse(localStorage.getItem("cart") || "[]");
  if (cartFromUrl.length > 0) {
    // Aqui você pode adicionar uma lógica de mesclagem se necessário,
    // por agora, vamos sobrescrever o localStorage se a URL tiver um carrinho.
    // Isso é útil se o link do carrinho foi compartilhado.
    localStorage.setItem("cart", JSON.stringify(cartFromUrl));
  } else if (localCart.length > 0 && !cartParam) {
    // Se não há cartParam mas há localCart, atualiza a URL com o localCart
    try {
      const cartJson = encodeURIComponent(
        btoa(unescape(encodeURIComponent(JSON.stringify(localCart))))
      );
      const url = new URL(window.location);
      url.searchParams.set("cart", cartJson);
      window.history.replaceState(
        {},
        document.title,
        url.pathname + url.search
      );
    } catch (e) {
      console.error("Error setting URL from localStorage:", e);
    }
  }

  renderCart();
});

window.incrementQuantity = function (itemId) {
  let cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const itemIndex = cart.findIndex((item) => item.id === itemId);

  if (itemIndex > -1) {
    cart[itemIndex].qt += 1;
    localStorage.setItem("cart", JSON.stringify(cart));
    renderCart();
    atualizarIconeCarrinho(); // Se houver um ícone de carrinho global para atualizar
  }
};

window.decrementQuantity = function (itemId) {
  let cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const itemIndex = cart.findIndex((item) => item.id === itemId);

  if (itemIndex > -1) {
    cart[itemIndex].qt -= 1;
    if (cart[itemIndex].qt <= 0) {
      cart.splice(itemIndex, 1); // Remove item if quantity is 0 or less
    }
    localStorage.setItem("cart", JSON.stringify(cart));
    renderCart();
    atualizarIconeCarrinho(); // Se houver um ícone de carrinho global para atualizar
  }
};

// Função para atualizar o ícone do carrinho (exemplo, pode já existir em outro script)
// Se não existir ou precisar ser adaptada, defina-a aqui ou garanta que está acessível.
function atualizarIconeCarrinho() {
  // Esta função pode precisar ser importada ou adaptada de pecas.js ou globalmente
  // Por enquanto, é um placeholder se não estiver já definida e funcionando globalmente.
  // console.log("atualizarIconeCarrinho chamada em carrinho.js");
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  // Exemplo de lógica de atualização de badge (simplificado):
  const totalItems = cart.reduce((sum, item) => sum + item.qt, 0);
  const badgeElement = document.getElementById("cartBadge"); // Supondo que exista um badge com este ID
  if (badgeElement) {
    badgeElement.textContent = totalItems > 0 ? totalItems : "";
    badgeElement.style.display = totalItems > 0 ? "flex" : "none";
  }
  // Se você tiver um ícone de carrinho mais complexo ou em outro local (ex: header),
  // ajuste o seletor e a lógica de atualização conforme necessário.
}
// Chame atualizarIconeCarrinho no carregamento da página também, se necessário
document.addEventListener("DOMContentLoaded", atualizarIconeCarrinho);

window.addEventListener("pageshow", function (event) {
  // carrinho.js already calls renderCart() on DOMContentLoaded,
  // and renderCart() itself updates the total and the items based on localStorage.
  // It also calls atualizarIconeCarrinho indirectly if it's part of renderCart or if renderCart affects the badge count.
  // However, to be absolutely sure the badge is updated if only localStorage changed
  // and the page is restored from bfcache (where DOMContentLoaded might not fire again),
  // we explicitly call renderCart() which includes total and item updates,
  // and ensure atualizarIconeCarrinho is also called if it's a separate global concern.
  renderCart(); // This will re-read from localStorage and update the table and totals.
  atualizarIconeCarrinho(); // Explicitly update badge, in case renderCart doesn't cover it or it's managed separately.
});

//Emojis para mensagens
let listaEmoji = "\u{1F9FE}";
let caixaEmoji = "\u{1F4E6}";
let celularEmoji = "\u{1F4F2}";
let sacoDinheiroEmoji = "\u{1F4B0}";
let dinheiroEmoji = "\u{1F4B5}";
let lojaEmoji = "\u{1F3EC}";
let maoEmoji = "\u{1F91D}";
let marcadorEmoji = "\u{25CF}";
let confirmeEmoji = "\u{2705}";
let caminhaoEmoji = "\u{1F69A}";
let pessoaEmoji = "\u{1F464}";
let observacaoEmoji = "\u{1F4CC}";

// função para retirar balcão pegar o id do produto e a quantidade e valor total gerar um formulario e abrir conversa no whatsapp
function enviarWhatsApp() {
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const observacoes = document.getElementById("observacoes").value.trim();

  if (cart.length === 0) {
    alert("Seu carrinho está vazio!");
    return;
  }

  let mensagem = `${caixaEmoji} Pedido de Peças:\n\n${listaEmoji} Lista de peças\n\n`;
  let totalValue = 0;

  cart.forEach((item) => {
    const nome = item.nome || "---";
    const qtde = item.qt || 0;
    const valor = parseFloat(item.preco) || 0;
    totalValue += valor * qtde;

    mensagem += `${marcadorEmoji} Descrição: ${nome}\n`;
    mensagem += `${marcadorEmoji} Quantidade: ${qtde}\n`;
    mensagem += `${dinheiroEmoji} Valor Unit.: R$ ${valor.toFixed(2)}\n\n`;
  });

  if (observacoes) {
    mensagem += `${observacaoEmoji} Observações: ${observacoes}\n\n`;
  }

  mensagem += `${sacoDinheiroEmoji} Total: R$ ${totalValue.toFixed(2)}\n\n`;
  mensagem += ` ${lojaEmoji}${maoEmoji} Retirar no balcão\n\n`;
  mensagem += `${celularEmoji} Por favor, confirme o pedido. ${confirmeEmoji}`;

  const whatsappUrl = `https://api.whatsapp.com/send?phone=5561995194930&text=${encodeURIComponent(
    mensagem
  )}`;
  window.open(whatsappUrl, "_blank");

  // Limpa o carrinho no localStorage e na tela
  localStorage.setItem("cart", JSON.stringify([]));
  renderCart(); // Isso vai limpar a tabela e zerar o total

  // Remove o parâmetro cart da URL
  const url = new URL(window.location);
  url.searchParams.delete("cart");
  window.history.replaceState({}, document.title, url.pathname + url.search);

  // Redireciona para o index após um pequeno delay
  setTimeout(() => {
    window.location.href = "index";
  }, 500);
  // atualizarIconeCarrinho(); // renderCart já deve ter chamado isso ou atualizado o necessário
}

// quando clicar lá no botão de entrega, abrir um popup com nome completo e endereço
function enviarWhatsAppEntrega() {
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  if (cart.length === 0) {
    alert("Seu carrinho está vazio!");
    return;
  }

  // Cria o overlay do popup
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.background = "rgba(0,0,0,0.35)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = 9999;

  // Cria o popup
  const popup = document.createElement("div");
  popup.style.background = "#fff";
  popup.style.padding = "32px 28px 24px 28px";
  popup.style.borderRadius = "16px";
  popup.style.boxShadow = "0 8px 32px rgba(0,0,0,0.18)";
  popup.style.minWidth = "340px";
  popup.style.maxWidth = "90vw";
  popup.style.fontFamily = "Segoe UI, Arial, sans-serif";
  popup.innerHTML = `
        <h2 style="margin-top:0;margin-bottom:18px;font-size:2rem;font-weight:700;color:#222;text-align:center;">Entrega</h2>
        <div style="margin-bottom:16px;">
            <label style="font-size:1rem;color:#444;">Nome completo:</label>
            <input type="text" id="popupNomeCompleto" style="width:100%;padding:10px 12px;margin-top:4px;margin-bottom:8px;border:1.5px solid #bbb;border-radius:6px;font-size:1rem;outline:none;transition:border-color 0.2s;" autofocus>
        </div>
        <div style="margin-bottom:20px;">
            <label style="font-size:1rem;color:#444;">Endereço:</label>
            <input type="text" id="popupEndereco" style="width:100%;padding:10px 12px;margin-top:4px;margin-bottom:8px;border:1.5px solid #bbb;border-radius:6px;font-size:1rem;outline:none;transition:border-color 0.2s;">
        </div>
        <div style="display:flex;gap:16px;justify-content:center;">
            <button id="popupEnviarBtn" style="padding:10px 28px;background:#198754;color:#fff;border:none;border-radius:6px;font-size:1rem;font-weight:600;cursor:pointer;transition:background 0.2s;">Enviar</button>
            <button id="popupCancelarBtn" style="padding:10px 28px;background:#eee;color:#444;border:none;border-radius:6px;font-size:1rem;font-weight:600;cursor:pointer;transition:background 0.2s;">Cancelar</button>
        </div>
    `;

  // Efeitos de foco nos inputs
  popup.querySelectorAll("input").forEach((input) => {
    input.addEventListener("focus", function () {
      this.style.borderColor = "#198754";
    });
    input.addEventListener("blur", function () {
      this.style.borderColor = "#bbb";
    });
  });

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  document.getElementById("popupCancelarBtn").onclick = function () {
    document.body.removeChild(overlay);
  };

  document.getElementById("popupEnviarBtn").onclick = function () {
    const nomeCompleto = document
      .getElementById("popupNomeCompleto")
      .value.trim();
    const endereco = document.getElementById("popupEndereco").value.trim();
    const observacoes = document.getElementById("observacoes").value.trim();

    if (!nomeCompleto || !endereco) {
      alert("Nome completo e endereço são obrigatórios.");
      return;
    }

    let mensagem = `${caixaEmoji} Pedido de Peças:\n\n${listaEmoji} Lista de peças\n`;
    let totalValue = 0;

    cart.forEach((item) => {
      const nome = item.nome || "---";
      const qtde = item.qt || 0;
      const valor = parseFloat(item.preco) || 0;
      totalValue += valor * qtde;

      mensagem += `${marcadorEmoji} Descrição: ${nome}\n`;
      mensagem += `${marcadorEmoji} Quantidade: ${qtde}\n`;
      mensagem += `${dinheiroEmoji} Valor Unit.: R$ ${valor.toFixed(2)}\n\n`;
    });

    if (observacoes) {
      mensagem += `${observacaoEmoji} Observações: ${observacoes}\n\n`;
    }

    mensagem += `${sacoDinheiroEmoji} Total: R$ ${totalValue.toFixed(2)}\n\n`;
    mensagem += `${pessoaEmoji} Nome Completo: ${nomeCompleto}\n`;
    mensagem += `${marcadorEmoji} Endereço: ${endereco}\n`; // Adicionado marcador para endereço
    mensagem += `${caminhaoEmoji} Entrega\n\n`;
    mensagem += `${celularEmoji} Por favor, confirme o pedido. ${confirmeEmoji}`;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=5561995194930&text=${encodeURIComponent(
      mensagem
    )}`;
    window.open(whatsappUrl, "_blank");

    // Limpa o carrinho no localStorage e na tela
    localStorage.setItem("cart", JSON.stringify([]));
    renderCart(); // Limpa a tabela e zera o total

    // Remove o parâmetro cart da URL
    const url = new URL(window.location);
    url.searchParams.delete("cart");
    window.history.replaceState({}, document.title, url.pathname + url.search);

    // Remove popup
    document.body.removeChild(overlay);

    // Redireciona para o index após um pequeno delay
    setTimeout(() => {
      window.location.href = "index";
    }, 500);
    // atualizarIconeCarrinho(); // renderCart já deve ter chamado isso ou atualizado o necessário
  };
}
