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



// função para retirar balcão pegar o id do produto e a quantidade e valor total gerar um formulario e abrir conversa no whatsapp
function enviarWhatsApp() {
    const corpoTabela = document.getElementById("carrinhoCorpo");
    const linhas = corpoTabela.querySelectorAll("tr");
    let mensagem = "Pedido de Peças:\n\n";

    linhas.forEach((linha) => {
        const colunas = linha.querySelectorAll("td");
        const descricao = colunas[0].textContent;
        const quantidade = colunas[1].textContent;
        const valor = colunas[2].textContent;

        mensagem += `Descrição: ${descricao}\nQuantidade: ${quantidade}\nValor: R$ ${valor}\n\n`;
    });

    const total = document.getElementById("totalCarrinho").textContent;
    mensagem += `Total: R$ ${total}\n\n`;
    mensagem += "Retirar no balcão\n";
    mensagem += "Por favor, confirme o pedido.";

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
