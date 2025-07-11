document.addEventListener('DOMContentLoaded', function() {
    function formatPhoneNumber(number) {
        // Remove caracteres que não são dígitos
        number = number.replace(/\D/g, '');

        // Verifica se o número começa com o código do país '55'
        if (number.length === 13 && number.startsWith('55')) {
            // +55(61)98321-6765
            return `+${number.slice(0,2)}(${number.slice(2,4)})${number.slice(4,9)}-${number.slice(9,13)}`;
        }
        // Caso não corresponda ao formato, retorna o original
        return number;
    }

    if (typeof BASE_URL === 'undefined') {
        console.error('BASE_URL não está definida.');
        return;
    }
    fetch(`${BASE_URL}/emp`)
        .then((response) => response.json())
        .then((data) => {
            // Inspeciona o objeto data para encontrar os nomes corretos das propriedades
            console.log('WhatsApp:', data);

            // Usa os nomes corretos das propriedades com base na estrutura de 'data'
            const whatsappNumber1 = data.empwhatsapp1 || '';
            const whatsappNumber2 = data.empwhatsapp2 || '';

            // Formata os números
            const formattedWhats1 = formatPhoneNumber(whatsappNumber1);
            const formattedWhats2 = formatPhoneNumber(whatsappNumber2);

            console.log('Números WhatsApp:', formattedWhats1, formattedWhats2);

            const whats1Elem = document.getElementById('whats1');
            const whats2Elem = document.getElementById('whats2');
            if (whats1Elem) {
                whats1Elem.value = formattedWhats1;
            } else {
                console.warn("Elemento com id 'whats1' não encontrado.");
            }
            if (whats2Elem) {
                whats2Elem.value = formattedWhats2;
            } else {
                console.warn("Elemento com id 'whats2' não encontrado.");
            }
        })
        .catch((error) => {
            console.error('Erro ao buscar os números do WhatsApp:', error);
        });
});
