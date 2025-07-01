
document.getElementById('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const usuemail = document.getElementById('email').value;
  const ususenha = document.getElementById('password').value;

  try {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ usuemail, ususenha }),
      credentials: 'include' 
    });

    const data = await response.json();

    if (response.ok) {
      window.location.href = `${BASE_URL}/painel`;
    } else {
        alertPersonalizado(data.mensagem || 'Email ou senha incorretos!', 2000);
    }
  } catch (error) {
    console.error('Erro na requisição:', error);
    alertPersonalizado('Erro ao tentar fazer login',2000);
  }
});

// alertPersonalizado personalizado Tom FORMAL

function alertPersonalizado(message,time) {
    let alertPersonalizado = document.getElementById("alertPersonalizado");
    
    if (!alertPersonalizado) {
        alertPersonalizado = document.createElement("div");
        alertPersonalizado.id = "alertPersonalizado";
        alertPersonalizado.style = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #333;
        color: #fff;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 0 10px rgba(0,0,0,0.3);
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s;
      `;
      document.body.appendChild(alertPersonalizado);
    }
  
    alertPersonalizado.textContent = message;
    alertPersonalizado.style.opacity = "1";
  
    setTimeout(() => {
        alertPersonalizado.style.opacity = "0";
        alertPersonalizado.remove(); 
    }, time);
  };
