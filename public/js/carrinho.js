const params = new URLSearchParams(window.location.search);

const id = params.get('id');
const modelo = params.get('modelo');
const marcascod = params.get('marcascod');
const qtde = params.get('qtde'); 

document.addEventListener("DOMContentLoaded", function () {
    const urlParams = new URLSearchParams(window.location.search);
    const cartParam = urlParams.get('cart');

    if (!cartParam) return;

    try {
        const jsonStr = decodeURIComponent(atob(decodeURIComponent(cartParam)));
        const dados = JSON.parse(jsonStr);

        const corpoTabela = document.getElementById("carrinhoCorpo");
        corpoTabela.innerHTML = "";

        let totalValue = 0;

        dados.forEach((dado) => {
            const nome = dado.nome || '---';
            const qtde = dado.qt || 0;
            const valor = parseFloat(dado.preco) || 0;

            totalValue += valor * qtde;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${nome}</td>
                <td>${qtde}</td>
                <td>${valor.toFixed(2)}</td>
            `;
            corpoTabela.appendChild(tr);
        });

        const total = document.getElementById("totalCarrinho");
        total.innerHTML = totalValue.toFixed(2);

    } catch (erro) {
        console.error("Erro ao processar carrinho:", erro);
    }
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


// função para retirar balcão pegar o id do produto e a quantidade e valor total gerar um formulario e abrir conversa no whatsapp
function enviarWhatsApp() {
    const corpoTabela = document.getElementById("carrinhoCorpo");
    const linhas = corpoTabela.querySelectorAll("tr");
    
    let mensagem = `${caixaEmoji} Pedido de Peças:\n\n${listaEmoji} Lista de peças\n\n`;

    linhas.forEach((linha) => {
        const colunas = linha.querySelectorAll("td");
        const descricao = colunas[0].textContent;
        const quantidade = colunas[1].textContent;
        const valor = colunas[2].textContent;

        mensagem += `${marcadorEmoji} Descrição: ${descricao}\n${marcadorEmoji} Quantidade: ${quantidade}\n${dinheiroEmoji} Valor: R$ ${valor}\n\n`;
    });

    const total = document.getElementById("totalCarrinho").textContent;
    mensagem += `${sacoDinheiroEmoji} Total: R$ ${total}\n\n`;
    mensagem += ` ${lojaEmoji}${maoEmoji} Retirar no balcão\n`;
    mensagem += `${celularEmoji} Por favor, confirme o pedido. ${confirmeEmoji}`;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=5561995194930&text=${encodeURIComponent(mensagem)}`;
    window.open(whatsappUrl, "_blank");

    // Limpa o carrinho
    corpoTabela.innerHTML = "";
    document.getElementById("totalCarrinho").textContent = "0.00";

    // Remove o parâmetro cart da URL
    const url = new URL(window.location);
    url.searchParams.delete('cart');
    window.history.replaceState({}, document.title, url.pathname);

    // Redireciona para o index após um pequeno delay
    setTimeout(() => {
        window.location.href = "index";
    }, 500);
}

// quando clicar lá no botão de entrega, abrir um popup com nome completo e endereço
function enviarWhatsAppEntrega() {
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
    popup.querySelectorAll("input").forEach(input => {
        input.addEventListener("focus", function() {
            this.style.borderColor = "#198754";
        });
        input.addEventListener("blur", function() {
            this.style.borderColor = "#bbb";
        });
    });

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    document.getElementById("popupCancelarBtn").onclick = function () {
        document.body.removeChild(overlay);
    };

    document.getElementById("popupEnviarBtn").onclick = function () {
        const nomeCompleto = document.getElementById("popupNomeCompleto").value.trim();
        const endereco = document.getElementById("popupEndereco").value.trim();

        if (!nomeCompleto || !endereco) {
            alert("Nome completo e endereço são obrigatórios.");
            return;
        }

        const corpoTabela = document.getElementById("carrinhoCorpo");
        const linhas = corpoTabela.querySelectorAll("tr");
        let mensagem = `${caixaEmoji} Pedido de Peças:\n\n${listaEmoji} Lista de peças\n`;

        linhas.forEach((linha) => {
            const colunas = linha.querySelectorAll("td");
            const descricao = colunas[0].textContent;
            const quantidade = colunas[1].textContent;
            const valor = colunas[2].textContent;

            mensagem += `${marcadorEmoji} Descrição: ${descricao}\n${marcadorEmoji} Quantidade: ${quantidade}\n${dinheiroEmoji} Valor: R$ ${valor}\n\n`;
        });

        const total = document.getElementById("totalCarrinho").textContent;
        mensagem += `${sacoDinheiroEmoji} Total: R$ ${total}\n\n`;
        mensagem += `${pessoaEmoji} Nome Completo: ${nomeCompleto}\n`;
        mensagem += `${caminhaoEmoji} Entrega\n\n`;
        mensagem += `${celularEmoji} Por favor, confirme o pedido. ${confirmeEmoji}`;

        const whatsappUrl = `https://api.whatsapp.com/send?phone=5561995194930&text=${encodeURIComponent(mensagem)}`;
        window.open(whatsappUrl, "_blank");

        // Limpa o carrinho
        corpoTabela.innerHTML = "";
        document.getElementById("totalCarrinho").textContent = "0.00";

        // Remove o parâmetro cart da URL
        const url = new URL(window.location);
        url.searchParams.delete('cart');
        window.history.replaceState({}, document.title, url.pathname);

        // Remove popup
        document.body.removeChild(overlay);

        // Redireciona para o index após um pequeno delay
        setTimeout(() => {
            window.location.href = "index";
        }, 500);
    };
}