    document.getElementById("buttonSair").addEventListener("click", function (event) {
        event.preventDefault();
        fetch('/auth/sair', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        fetch('/login', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (response.ok) {
                window.location.href = '/index'; 
            } else {
                console.error('Erro ao sair');
            }
        })
        .catch(error => {
            console.error('Erro:', error);
        });
    });