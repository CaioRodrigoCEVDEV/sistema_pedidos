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

function limparCarrinho() {
  localStorage.removeItem("cart");
  renderCart(); // Atualiza a tabela para refletir o carrinho limpo
  atualizarIconeCarrinho(); // Atualiza o ícone do carrinho, se necessário
}

async function carregarUsuarioLogado() {
  const response = await fetch(`${BASE_URL}/me/usuario`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });
  if (response.ok) {
    const data = await response.json();
    return data.usunome;
  } else {
    return null;
  }
}

//função para verificar se esta logado e mostrar o botão orçamento
document.addEventListener("DOMContentLoaded", function () {
  fetch(`${BASE_URL}/emp`)
    .then((response) => response.json())
    .then(async (data) => {
      const empusapv = data.empusapv;

      const botaoOrcamento = document.getElementById("botao-orcamento");
      const botaoRegistrar = document.getElementById("botao-registrar-pedido");

      const usuarioLogado = await carregarUsuarioLogado();

      if (usuarioLogado && empusapv === "S") {
        botaoOrcamento.style.display = "inline";
        botaoRegistrar.style.display = "inline";
      } else if (usuarioLogado && empusapv === "N") {
        botaoOrcamento.style.display = "inline";
        botaoRegistrar.style.display = "inline";
      } else {
        botaoOrcamento.style.display = "none";
        botaoRegistrar.style.display = "none";
      }
    })
    .catch((error) => {
      console.error("Erro ao buscar configurações da empresa:", error);
    });

  // Remove usuarioLogado do localStorage ao fechar a página
  window.addEventListener("beforeunload", function () {
    localStorage.removeItem("usuarioLogado");
  });
});

async function buscarUsuario() {
  try {
    const response = await fetch(`${BASE_URL}/usuario/viuversao`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });
    if (response.ok) {
      const data = await response.json();
      return data.usucod;
    } else {
      console.error("Erro ao buscar usuário:", response.statusText);
      return null;
    }
  } catch (error) {
    console.error("Erro na requisição:", error);
    return null;
  }
}

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
    const corid = item.idCorSelecionada || " ";
    const qtde = item.qt || 0;
    const valor = parseFloat(item.preco) || 0;
    const itemTotal = valor * qtde;
    totalValue += itemTotal;

    const tr = document.createElement("div");
    tr.className = "cart-item";
    // Usar item.id se disponível e único, caso contrário, index é uma fallback.
    // Assumindo que item.id existe e é o procod.
    const itemId = item.id;

    // botão para limpar todos os i

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
  let cart = JSON.parse(localStorage.getItem("cart") || "[]");

  // Se quiser forçar limpar quando não houver nada:
  if (!Array.isArray(cart)) cart = [];

  renderCart(cart);
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
async function enviarWhatsApp() {
  const disabledDiv = document.getElementById("divFinalizar");
  try {
    disabledDiv.style.pointerEvents = "none";
    disabledDiv.style.opacity = "0.6";
    disabledDiv.status.userSelect = "none";
  } catch (error) {
    console.error("Failed", error);
  }

  const respSeq = await fetch("/pedidos/sequencia");
  const seqData = await respSeq.json();
  const pvcod = seqData.nextval;

  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const observacoes = document.getElementById("observacoes").value.trim();

  if (cart.length === 0) {
    showToast("Seu carrinho está vazio!", "warning");
    reabilitarBotoes();
    return;
  }

  let mensagem = `${caixaEmoji} Pedido de Peças:\n\n`;
  let totalValue = 0;
  // detalhamento dos itens do pedido
  cart.forEach((item) => {
    const nome = item.nome || "---";
    const qtde = item.qt || 0;
    const valor = parseFloat(item.preco) || 0;
    const marca = item.marca || "";
    const tipo = item.tipo || "";
    totalValue += valor * qtde;
    const cor = item.idCorSelecionada || "";

    mensagem += `(${qtde}) ${nome} R$${valor.toFixed(2)}\n\n`;
  });
  // fim detalhamento
  // Enviar pedido para o servidor
  try {
    const respPedido = await fetch(`${BASE_URL}/pedidos/enviar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pvcod,
        cart,
        total: totalValue,
        obs: observacoes,
        canal: "BALCAO",
        status: "A",
        confirmado: "N",
        codigoVendedor: (await buscarUsuario()) || null,
      }),
    });
    const data = await respPedido.json();

    // Verifica se houve erro (ex: estoque insuficiente)
    if (!respPedido.ok) {
      console.error("Erro ao criar pedido:", data);
      const mensagemErro =
        data.error || "Erro ao processar pedido. Tente novamente.";
      showToast(mensagemErro, "error");
      reabilitarBotoes();
      return;
    }

    console.log("Pedido salvo com sucesso:", data);

    if (observacoes) {
      mensagem += `${observacaoEmoji} Observações: ${observacoes}\n`;
    }
    mensagem += `${sacoDinheiroEmoji} Total: R$ ${totalValue.toFixed(2)}\n`;
    mensagem += `${lojaEmoji} Retirada: No balcão\n`;
    mensagem += `Pedido N°: ${pvcod}\n`;
    // mensagem += `${celularEmoji} Por favor, confirme o pedido. ${confirmeEmoji}`;

    fetch(`${BASE_URL}/emp`)
      .then((response) => response.json())
      .then((data) => {
        // Use o número
        const whatsappNumber1 = data.empwhatsapp1 || ""; // Use a default number if not found
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
        // Notifica o usuário que houve um problema ao buscar o número
        showToast(
          "Pedido criado com sucesso! Não foi possível obter o número do WhatsApp. Você será redirecionado para selecionar um contato.",
          "warning",
          5000
        );
        const whatsappNumber1 = ""; // Fallback caso a API falhe
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
  } catch (error) {
    console.error("Erro ao processar pedido:", error);
    showToast("Erro ao processar pedido. Tente novamente.", "error");
    reabilitarBotoes();
  }
}

// Função auxiliar para reabilitar os botões após erro
function reabilitarBotoes() {
  const disabledDiv = document.getElementById("divFinalizar");
  try {
    disabledDiv.style.pointerEvents = "auto";
    disabledDiv.style.opacity = "1";
    disabledDiv.style.userSelect = "auto";
  } catch (error) {
    console.error("Erro ao reabilitar botões:", error);
  }
}

// quando clicar lá no botão de entrega, abrir um popup com nome completo e endereço
async function enviarWhatsAppEntrega() {
  const disabledDiv = document.getElementById("divFinalizar");
  try {
    disabledDiv.style.pointerEvents = "none";
    disabledDiv.style.opacity = "0.6";
    disabledDiv.status.userSelect = "none";
  } catch (error) {
    console.error("Failed", error);
  }

  const respSeq = await fetch("/pedidos/sequencia");
  const seqData = await respSeq.json();
  const pvcod = seqData.nextval;

  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const observacoes = document.getElementById("observacoes").value.trim();
  if (cart.length === 0) {
    showToast("Seu carrinho está vazio!", "warning");
    reabilitarBotoes();
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
    const cor = item.corid || "";
    totalValue += valor * qtde;

    mensagem += `(${qtde}) ${nome} R$${valor.toFixed(2)}\n\n`;
  });

  try {
    const respPedido = await fetch(`${BASE_URL}/pedidos/enviar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pvcod,
        cart,
        total: totalValue,
        obs: observacoes,
        canal: "ENTREGA",
        status: "A",
        confirmado: "N",
        codigoVendedor: (await buscarUsuario()) || null,
      }),
    });
    const data = await respPedido.json();

    // Verifica se houve erro (ex: estoque insuficiente)
    if (!respPedido.ok) {
      console.error("Erro ao criar pedido:", data);
      const mensagemErro =
        data.error || "Erro ao processar pedido. Tente novamente.";
      showToast(mensagemErro, "error");
      reabilitarBotoes();
      return;
    }

    console.log("Pedido salvo com sucesso:", data);

    if (observacoes) {
      mensagem += `${observacaoEmoji} Observações: ${observacoes}\n`;
    }

    mensagem += `${sacoDinheiroEmoji} Total: R$ ${totalValue.toFixed(2)}\n`;
    mensagem += `${caminhaoEmoji} Entrega\n`;
    mensagem += `Pedido N°: ${pvcod}\n`;

    fetch(`${BASE_URL}/emp`)
      .then((response) => response.json())
      .then((data) => {
        // Use o número
        const whatsappNumber2 = data.empwhatsapp2 || ""; // Use a default number if not found
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
        // Notifica o usuário que houve um problema ao buscar o número
        showToast(
          "Pedido criado com sucesso! Não foi possível obter o número do WhatsApp. Você será redirecionado para selecionar um contato.",
          "warning",
          5000
        );
        const whatsappNumber2 = ""; // Fallback caso a API falhe
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
  } catch (error) {
    console.error("Erro ao processar pedido:", error);
    showToast("Erro ao processar pedido. Tente novamente.", "error");
    reabilitarBotoes();
  }
}

// função botão orçamento será enviado apenas a lista de itens sem valor
function copiarOrcamentoParaClipboard() {
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const observacoes = document.getElementById("observacoes").value.trim();
  const caixaEmoji = "📦";
  const observacaoEmoji = "📝";

  if (cart.length === 0) {
    showToast("Seu carrinho está vazio!", "warning");
    return;
  }

  let mensagem = `${caixaEmoji} Orçamento de Peças:\n\n`;

  cart.forEach((item) => {
    const nome = item.nome || "---";
    const qtde = item.qt || 0;
    const valor = parseFloat(item.preco) || 0;
    mensagem += `(${qtde}) ${nome} - R$${valor.toFixed(2)}\n`;
  });

  if (observacoes) {
    mensagem += `\n${observacaoEmoji} Observações: ${observacoes}\n`;
  }

  if (
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    navigator.clipboard
      .writeText(mensagem)
      .then(() => {})
      .catch((err) => {
        showToast("Erro ao copiar: " + err, "error");
      });
  } else {
    // Fallback usando textarea e execCommand
    const textarea = document.createElement("textarea");
    textarea.value = mensagem;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
    } catch (err) {
      showToast("Falha ao copiar o texto. Copie manualmente.", "error");
    }
    document.body.removeChild(textarea);
  }
}

// Abre um modal de confirmação no padrão do sistema e resolve true/false
function confirmarRegistroPedido() {
  return new Promise((resolve) => {
    const modalEl = document.getElementById("confirmarRegistroModal");
    const btnConfirmar = document.getElementById("confirmarRegistroBtn");

    // Fallback caso o modal ou o Bootstrap não estejam disponíveis
    if (!modalEl || !btnConfirmar || !window.bootstrap) {
      resolve(
        window.confirm(
          "Confirmar o registro deste pedido? O carrinho será finalizado."
        )
      );
      return;
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    let confirmou = false;

    const onConfirmar = () => {
      confirmou = true;
      modal.hide();
    };

    const onHidden = () => {
      btnConfirmar.removeEventListener("click", onConfirmar);
      modalEl.removeEventListener("hidden.bs.modal", onHidden);
      resolve(confirmou);
    };

    btnConfirmar.addEventListener("click", onConfirmar);
    modalEl.addEventListener("hidden.bs.modal", onHidden);
    modal.show();
  });
}

// função para registrar o pedido diretamente, sem envio por WhatsApp e sem copiar orçamento
async function registrarPedido() {
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");

  if (cart.length === 0) {
    showToast("Seu carrinho está vazio!", "warning");
    return;
  }

  if (!(await confirmarRegistroPedido())) {
    return;
  }

  const disabledDiv = document.getElementById("divFinalizar");
  try {
    disabledDiv.style.pointerEvents = "none";
    disabledDiv.style.opacity = "0.6";
    disabledDiv.style.userSelect = "none";
  } catch (error) {
    console.error("Failed", error);
  }

  const observacoes = document.getElementById("observacoes").value.trim();

  let totalValue = 0;
  cart.forEach((item) => {
    const valor = parseFloat(item.preco) || 0;
    const qtde = item.qt || 0;
    totalValue += valor * qtde;
  });

  try {
    const respSeq = await fetch("/pedidos/sequencia");
    const seqData = await respSeq.json();
    const pvcod = seqData.nextval;

    const respPedido = await fetch(`${BASE_URL}/pedidos/enviar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pvcod,
        cart,
        total: totalValue,
        obs: observacoes,
        canal: "VENDA",
        status: "A",
        confirmado: "N",
        codigoVendedor: (await buscarUsuario()) || null,
      }),
    });
    const data = await respPedido.json();

    if (!respPedido.ok) {
      console.error("Erro ao criar pedido:", data);
      const mensagemErro =
        data.error || "Erro ao processar pedido. Tente novamente.";
      showToast(mensagemErro, "error");
      reabilitarBotoes();
      return;
    }

    console.log("Pedido registrado com sucesso:", data);

    /// Limpa o carrinho no localStorage e na tela
    localStorage.setItem("cart", JSON.stringify([]));
    renderCart(); // Isso vai limpar a tabela e zerar o total

    // Remove o parâmetro cart da URL
    const url = new URL(window.location);
    url.searchParams.delete("cart");
    window.history.replaceState({}, document.title, url.pathname + url.search);

    showToast("Pedido registrado com sucesso!", "success");

    // Redireciona para o index após um pequeno delay
    setTimeout(() => {
      window.location.href = "index";
    }, 500);
  } catch (error) {
    console.error("Erro ao processar pedido:", error);
    showToast("Erro ao processar pedido. Tente novamente.", "error");
    reabilitarBotoes();
  }
}
