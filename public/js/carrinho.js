const params = new URLSearchParams(window.location.search);

const id = params.get("id");
const modelo = params.get("modelo");
const marcascod = params.get("marcascod");
const qtde = params.get("qtde");

function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

//função para verificar se esta logado e mostrar o botão orçamento
document.addEventListener("DOMContentLoaded", function () {
  const usuarioLogado = localStorage.getItem("usuarioLogado");
  const botaoOrcamento = document.getElementById("botao-orcamento");

  console.log(usuarioLogado);

  if (usuarioLogado) {
    botaoOrcamento.style.display = "inline";
  } else {
    botaoOrcamento.style.display = "none";
  }
});

function renderCart() {
  const corpoTabela = document.getElementById("carrinhoCorpo");
  const totalCarrinhoElement = document.getElementById("totalCarrinho");
  corpoTabela.innerHTML = ""; // Limpa a lista antes de renderizar

  let cart = JSON.parse(localStorage.getItem("cart") || "[]");
  let totalValue = 0;

  if (cart.length === 0) {
    corpoTabela.innerHTML =
      '<div class="text-center">Seu carrinho está vazio.</div>';
    totalCarrinhoElement.innerHTML = formatarMoeda(0);
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
    const nome = item.nome || " ";
    const tipo = item.tipo || " ";
    const marca = item.marca || " ";
    const cor = item.corSelecionada || " ";
    const qtde = item.qt || 0;
    const valor = parseFloat(item.preco) || 0;
    const itemTotal = valor * qtde;
    totalValue += itemTotal;

    const tr = document.createElement("div");
    tr.className = "cart-item";
    // Usar item.id se disponível e único, caso contrário, index é uma fallback.
    // Assumindo que item.id existe e é o procod.
    const itemId = item.id;

    tr.innerHTML = `
            <div class="item-name">${nome}</div>
            <div class="item-marca">${marcadorEmoji} Marca: ${marca}</div>
            <div class="item-tipo"> ${marcadorEmoji} Tipo: ${tipo}</div>
            <div class="item-qty">
                <button class="btn btn-sm btn-outline-secondary" onclick="decrementQuantity('${itemId}')">-</button>
                <span class="mx-2">${qtde}</span>
                <button class="btn btn-sm btn-outline-secondary" onclick="incrementQuantity('${itemId}')">+</button>
            </div>
            <div class="item-price">Valor Unitário: ${formatarMoeda(
              valor
            )}</div>
            <div class="item-total">SubTotal: ${formatarMoeda(itemTotal)}</div>
        `;
    corpoTabela.appendChild(tr);
  });

  totalCarrinhoElement.innerHTML = formatarMoeda(totalValue);

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
let listaEmoji = "\u{1F9FE}"; // 🧾
let caixaEmoji = "\u{1F4E6}"; // 📦
let celularEmoji = "\u{1F4F2}"; // 📲
let sacoDinheiroEmoji = "\u{1F4B0}"; // 💰
let dinheiroEmoji = "\u{1F4B5}"; // 💵
let lojaEmoji = "\u{1F3EC}"; // 🏬
let maoEmoji = "\u{1F91D}"; // 🤝
let marcadorEmoji = "\u{25CF}"; // ● (usado em outros locais)
let confirmeEmoji = "\u{2705}"; // ✅
let caminhaoEmoji = "\u{1F69A}"; // 🚚
let pessoaEmoji = "\u{1F464}"; // 👤
let observacaoEmoji = "\u{1F4CC}"; // 📌

const indent = "      "; // seis espaços para identação nas mensagens

// Novos emojis para detalhamento da mensagem
let descricaoEmoji = "\u{1F9FE}"; // 🧾
let marcaEmoji = "\u{1F3F7}"; // 🏷️
let tipoEmoji = "\u{1F9E9}"; // 🧩
let quantidadeEmoji = "\u{1F522}"; // 🔢

// função para retirar balcão pegar o id do produto e a quantidade e valor total gerar um formulario e abrir conversa no whatsapp
function enviarWhatsApp() {
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const observacoes = document.getElementById("observacoes").value.trim();

  if (cart.length === 0) {
    alert("Seu carrinho está vazio!");
    return;
  }

  let mensagem = `${caixaEmoji} Pedido de Peças:\n\n`;
  let totalValue = 0;

  cart.forEach((item) => {
    const nome = item.nome || "---";
    const qtde = item.qt || 0;
    const valor = parseFloat(item.preco) || 0;
    const marca = item.marca || "";
    const tipo = item.tipo || "";
    totalValue += valor * qtde;

    mensagem += `(${qtde}) ${nome} R$${valor.toFixed(2)}\n\n`;
  });

  if (observacoes) {
    mensagem += `${observacaoEmoji} Observações: ${observacoes}\n`;
  }
  mensagem += `${sacoDinheiroEmoji} Total: R$ ${totalValue.toFixed(2)}\n`;
  mensagem += `${lojaEmoji} Retirada: No balcão\n`;
  // mensagem += `${celularEmoji} Por favor, confirme o pedido. ${confirmeEmoji}`;

  fetch(`${BASE_URL}/emp`)
    .then((response) => response.json())
    .then((data) => {
      // Use o número
      const whatsappNumber1 = data.empwhatsapp1 || "5561991494321"; // Use a default number if not found
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${whatsappNumber1}&text=${encodeURIComponent(
        mensagem
      )}`;
      window.location.href = whatsappUrl;

      // testes;

      /// Limpa o carrinho no localStorage e na tela
      localStorage.setItem("cart", JSON.stringify([]));
      renderCart(); // Isso vai limpar a tabela e zerar o total

      // Remove o parâmetro cart da URL
      const url = new URL(window.location);
      url.searchParams.delete("cart");
      window.history.replaceState(
        {},
        document.title,
        url.pathname + url.search
      );

      // Redireciona para o index após um pequeno delay
      setTimeout(() => {
        window.location.href = "index";
      }, 500);
      // atualizarIconeCarrinho(); // renderCart já deve ter chamado isso ou atualizado o necessário
    })
    .catch((error) => {
      console.error("Erro ao buscar número do WhatsApp:", error);
      const whatsappNumber1 = data.empwhatsapp1 || "5561991494321"; // Fallback caso a API falhe
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${whatsappNumber1}&text=${encodeURIComponent(
        mensagem
      )}`;
      window.location.href = whatsappUrl;

      /// Limpa o carrinho no localStorage e na tela
      localStorage.setItem("cart", JSON.stringify([]));
      renderCart(); // Isso vai limpar a tabela e zerar o total

      // Remove o parâmetro cart da URL
      const url = new URL(window.location);
      url.searchParams.delete("cart");
      window.history.replaceState(
        {},
        document.title,
        url.pathname + url.search
      );

      // Redireciona para o index após um pequeno delay
      setTimeout(() => {
        window.location.href = "index";
      }, 500);
      // atualizarIconeCarrinho(); // renderCart já deve ter chamado isso ou atualizado o necessário
    });
}

// quando clicar lá no botão de entrega, abrir um popup com nome completo e endereço
function enviarWhatsAppEntrega() {
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const observacoes = document.getElementById("observacoes").value.trim();
  if (cart.length === 0) {
    alert("Seu carrinho está vazio!");
    return;
  }

  let mensagem = `${caixaEmoji} Pedido de Peças:\n\n`;
  let totalValue = 0;

  cart.forEach((item) => {
    const nome = item.nome || "---";
    const qtde = item.qt || 0;
    const valor = parseFloat(item.preco) || 0;
    const marca = item.marca || "";
    const tipo = item.tipo || "";
    totalValue += valor * qtde;

    mensagem += `(${qtde}) ${nome} R$${valor.toFixed(2)}\n\n`;
  });

  if (observacoes) {
    mensagem += `${observacaoEmoji} Observações: ${observacoes}\n`;
  }

  mensagem += `${sacoDinheiroEmoji} Total: R$ ${totalValue.toFixed(2)}\n`;
  mensagem += `${caminhaoEmoji} Entrega\n`;

  console.log(mensagem);
  fetch(`${BASE_URL}/emp`)
    .then((response) => response.json())
    .then((data) => {
      // Use o número
      const whatsappNumber2 = data.empwhatsapp2 || "5561991494321"; // Use a default number if not found
      const whatsappUrl2 = `https://api.whatsapp.com/send?phone=${whatsappNumber2}&text=${encodeURIComponent(
        mensagem
      )}`;

      window.location.href = whatsappUrl2;

      /// Limpa o carrinho no localStorage e na tela
      localStorage.setItem("cart", JSON.stringify([]));
      renderCart(); // Isso vai limpar a tabela e zerar o total

      // Remove o parâmetro cart da URL
      const url = new URL(window.location);
      url.searchParams.delete("cart");
      window.history.replaceState(
        {},
        document.title,
        url.pathname + url.search
      );

      // Redireciona para o index após um pequeno delay
      setTimeout(() => {
        window.location.href = "index";
      }, 500);
      // atualizarIconeCarrinho(); // renderCart já deve ter chamado isso ou atualizado o necessário
    })
    .catch((error) => {
      console.error("Erro ao buscar número do WhatsApp:", error);
      const whatsappNumber2 = "5561991494321"; // Fallback caso a API falhe
      const whatsappUrl2 = `https://api.whatsapp.com/send?phone=${whatsappNumber2}&text=${encodeURIComponent(
        mensagem
      )}`;
      window.location.href = whatsappUrl2;

      /// Limpa o carrinho no localStorage e na tela
      localStorage.setItem("cart", JSON.stringify([]));
      renderCart(); // Isso vai limpar a tabela e zerar o total

      // Remove o parâmetro cart da URL
      const url = new URL(window.location);
      url.searchParams.delete("cart");
      window.history.replaceState(
        {},
        document.title,
        url.pathname + url.search
      );

      // Redireciona para o index após um pequeno delay
      setTimeout(() => {
        window.location.href = "index";
      }, 500);
      // atualizarIconeCarrinho(); // renderCart já deve ter chamado isso ou atualizado o necessário
    });
}

// função botão orçamento será enviado apenas a lista de itens sem valor
function enviarWhatsAppOrcamento() {
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const observacoes = document.getElementById("observacoes").value.trim();
  if (cart.length === 0) {
    alert("Seu carrinho está vazio!");
    return;
  }

  let mensagem = `${caixaEmoji} Orçamento de Peças:\n\n`;
  let totalValue = 0;

  cart.forEach((item) => {
    const nome = item.nome || "---";
    const qtde = item.qt || 0;
    const marca = item.marca || "";
    const tipo = item.tipo || "";
    const valor = parseFloat(item.preco) || 0;
    totalValue += valor * qtde;

    mensagem += `(${qtde}) ${nome} R$${valor.toFixed(2)}\n\n`;
  });

  // mensagem += `${listaEmoji} Resumo do Orçamento:\n`;
  mensagem += `${sacoDinheiroEmoji} Total: R$ ${totalValue.toFixed(2)}\n`;

  fetch(`${BASE_URL}/emp`)
    .then((response) => response.json())
    .then((data) => {
      // Use o número
      const whatsappNumber3 = ""; // Use a default number if not found
      const whatsappUrl3 = `https://api.whatsapp.com/send?phone=${whatsappNumber3}&text=${encodeURIComponent(
        mensagem
      )}`;
      window.location.href = whatsappUrl3;

      /// Limpa o carrinho no localStorage e na tela
      localStorage.setItem("cart", JSON.stringify([]));
      renderCart(); // Isso vai limpar a tabela e zerar o total

      // Remove o parâmetro cart da URL
      const url = new URL(window.location);
      url.searchParams.delete("cart");
      window.history.replaceState(
        {},
        document.title,
        url.pathname + url.search
      );
      // Redireciona para o index após um pequeno delay
      setTimeout(() => {
        window.location.href = "index";
      }, 500);
      // atualizarIconeCarrinho(); // renderCart já deve ter chamado isso ou atualizado o necessário
    })
    .catch((error) => {
      console.error("Erro ao buscar número do WhatsApp:", error);
      const whatsappNumber3 = "5561991494321"; // Fallback caso a API falhe
      const whatsappUrl3 = `https://api.whatsapp.com/send?phone=${whatsappNumber3}&text=${encodeURIComponent(
        mensagem
      )}`;
      window.location.href = whatsappUrl3;

      /// Limpa o carrinho no localStorage e na tela
      localStorage.setItem("cart", JSON.stringify([]));
      renderCart(); // Isso vai limpar a tabela e zerar o total

      // Remove o parâmetro cart da URL
      const url = new URL(window.location);
      url.searchParams.delete("cart");
      window.history.replaceState(
        {},
        document.title,
        url.pathname + url.search
      );

      // Redireciona para o index após um pequeno delay
      setTimeout(() => {
        window.location.href = "index";
      }, 500);
      // atualizarIconeCarrinho(); // renderCart já deve ter chamado isso ou atualizado o necessário
    });
}
