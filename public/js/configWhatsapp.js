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
            const razaoSocial = data.emprazao || '';

            // Formata os números
            const formattedWhats1 = formatPhoneNumber(whatsappNumber1);
            const formattedWhats2 = formatPhoneNumber(whatsappNumber2);

            console.log('Números WhatsApp:', formattedWhats1, formattedWhats2);

            const whats1Elem = document.getElementById('whats1');
            const whats2Elem = document.getElementById('whats2');
            const razaoSocialElem = document.getElementById('razaoSocial');
            razaoSocialElem.value = razaoSocial || '';
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

document.getElementById('saveWhats').addEventListener('click', function(event) {
    event.preventDefault();
    const whats1 = document.getElementById('whats1').value;
    const whats2 = document.getElementById('whats2').value;
    const emprazao = document.getElementById('razaoSocial').value;

    // Verifica se os números estão no formato correto
    if (!whats1.match(/^\+\d{2}\(\d{2}\)\d{5}-\d{4}$/) || !whats2.match(/^\+\d{2}\(\d{2}\)\d{5}-\d{4}$/)) {
        alert('Por favor, insira números de WhatsApp válidos.');
        return;
    }

    // Remove formatação para enviar apenas os dígitos
    const whats1Digits = whats1.replace(/\D/g, '');
    const whats2Digits = whats2.replace(/\D/g, '');

    fetch(`${BASE_URL}/emp`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            empwhatsapp1: whats1Digits,
            empwhatsapp2: whats2Digits,
            emprazao: emprazao
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Dados atualizados com sucesso:', data);
        alert('Números de WhatsApp atualizados com sucesso!');
    })
    .catch(error => {
        console.error('Erro ao atualizar os números de WhatsApp:', error);
        alert('Erro ao atualizar os números de WhatsApp. Por favor, tente novamente.');
    });
});