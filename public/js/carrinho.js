const params = new URLSearchParams(window.location.search);

const id = params.get('id');
const modelo = params.get('modelo');
const marcascod = params.get('marcascod');
const qtde = params.get('qtde'); // Pega a quantidade do parâmetro ou define como 1 se não estiver presente

document.addEventListener("DOMContentLoaded", function () {
    fetch(`http://127.0.0.1:3000/pro/carrinho/${id}`)
        .then((res) => res.json())
        .then((dados) => {
            const corpoTabela = document.getElementById("carrinhoCorpo");
            corpoTabela.innerHTML = ""; // Limpa o conteúdo atual da tabela

            dados.forEach((dado) => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                            <td>${dado.prodes}</td>
                            <td>${qtde}</td>
                            <td>${dado.provl}</td>
                            `;
                corpoTabela.appendChild(tr);
            });

            const total = document.getElementById("totalCarrinho");
            const totalValue = dados.reduce((acc, dado) => acc + (dado.provl * qtde), 0);
            total.innerHTML = ""; // Limpa o conteúdo atual do total
            total.innerHTML = totalValue.toFixed(2);
    
        })
        .catch((erro) => console.error(erro));
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
} 
