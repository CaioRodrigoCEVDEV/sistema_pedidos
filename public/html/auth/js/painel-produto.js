const produtoModalEl = document.getElementById('produtoModal');
const produtoModal = new bootstrap.Modal(produtoModalEl);
const btnProduto = document.getElementById('dropdownProduto');
// const btnExcluir = document.getElementById('btnDelete');
const produtoForm = document.getElementById('produtoForm');
const promarcascod = document.getElementById('popupMarcaModalProduto');
// Novo produto
btnProduto.addEventListener('click', () => {
  async function fetchMarcas() {
    try {
      const response = await fetch(`${BASE_URL}/marcas`);
      if (!response.ok) {
        throw new Error('Erro ao buscar marcas');
      }
      const marcas = await response.json();
      promarcascod.innerHTML = '<option value="">Selecione</option>';
      marcas.forEach(marca => {
        const option = document.createElement('option');
        option.value = marca.marcascod;
        option.textContent = marca.marcasdes;
        promarcascod.appendChild(option);
      });
    } catch (error) {
      console.error('Erro ao carregar marcas:', error);
    }
  } 
  
  const fetchModelos = async (marcascod) => {
    try {
      const response = await fetch(`${BASE_URL}/modelo/${marcascod}`);
      if (!response.ok) throw new Error('Erro ao buscar modelos');
      const modelos = await response.json();
      const modelosHolder = document.getElementById('popupProdutoModalModelo');
      modelosHolder.innerHTML = '';
      modelos.forEach(modelo => {
        const div = document.createElement('div');
        div.className = 'form-check';
        div.innerHTML = `
          <input class="form-check-input checkbox-modelo-cadastro" type="checkbox" 
                 value="${modelo.modcod}" id="cadastro_modelo_${modelo.modcod}">
          <label class="form-check-label" for="cadastro_modelo_${modelo.modcod}">
            ${modelo.moddes}
          </label>
        `;
        modelosHolder.appendChild(div);
      });
    } catch (error) {
      console.error('Erro ao carregar modelos:', error);
    }
  };

  promarcascod.addEventListener('change', (e) => {
    const marcascod = e.target.value;
    const modelosHolder = document.getElementById('popupProdutoModalModelo');
    if (marcascod) {
      fetchModelos(marcascod);
    } else {
      modelosHolder.innerHTML = '<div class="text-muted small">Selecione a marca primeiro</div>';
    }
  });

  fetchTipos = async () => {
  try {
    const response = await fetch(`${BASE_URL}/tipos`);
    if (!response.ok) {
      throw new Error('Erro ao buscar tipos');
    }
    const tipos = await response.json();
    const protipocod = document.getElementById('popupProdutoModaltipo');
    protipocod.innerHTML = '<option value="">Selecione</option>';
    tipos.forEach(tipo => {
      const option = document.createElement('option');
      option.value = tipo.tipocod;
      option.textContent = tipo.tipodes;
      protipocod.appendChild(option);
    });
  } catch (error) {
    console.error('Erro ao carregar tipos:', error);
  }
  };

   async function carregarCoresPainel() {
     fetch(`${BASE_URL}/procores/`)
       .then((res) => res.json())
       .then((dados) => {
         const holder = document.getElementById("selectPainelCor");
         if (!holder) return;
         holder.innerHTML = ""; // zera antes

         let html = "";
         dados.forEach((cor) => {
           html += `
             <div class="form-check">
               <input class="form-check-input" type="checkbox" name="procor" value="${cor.corcod}" id="cor_${cor.corcod}">
               <label class="form-check-label" for="cor_${cor.corcod}">${cor.cornome}</label>
             </div>
           `;
         });
         holder.innerHTML = html;
       })
       .catch(console.error);
   }

   // Carrega novamente ao abrir o popup
   if (btnProduto) {
     btnProduto.addEventListener("click", carregarCoresPainel);
   }
  carregarCoresPainel();
  fetchMarcas();
  fetchTipos();
  
  descricaoProduto.value = '';
  provl.value = '';
  // Limpar seleção de modelos
  const modelosHolder = document.getElementById('popupProdutoModalModelo');
  modelosHolder.innerHTML = '<div class="text-muted small">Selecione a marca primeiro</div>';
  produtoModal.show();
});


// salvar registro na api
produtoForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  
  // Obter todos os modelos selecionados (checkboxes)
  const modeloCheckboxes = document.querySelectorAll(
    '#popupProdutoModalModelo .checkbox-modelo-cadastro:checked'
  );
  const selectedModelos = Array.from(modeloCheckboxes).map(cb => parseInt(cb.value, 10));
  
  if (selectedModelos.length === 0) {
    alert('Por favor, selecione pelo menos um modelo.');
    return;
  }
  
  const payload = {
    prodes: descricaoProduto.value.trim(),
    promarcascod: parseInt(document.getElementById('popupMarcaModalProduto').value),
    provl: parseFloat(provl.value),
    promodcods: selectedModelos,
    protipocod: parseInt(document.getElementById('popupProdutoModaltipo').value)
  };

     // Pega todos os checkboxes marcados de cor
     const corCheckboxes = document.querySelectorAll(
       '#selectPainelCor input[type="checkbox"]:checked'
     );
     const corIds = Array.from(corCheckboxes).map((cb) => cb.value);
  try {
    const url = `${BASE_URL}/pro`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (response.status === 403) {
      throw new Error('403');
    }


        const responseData = await response.json();
       let procod = responseData.procod || (Array.isArray(responseData) && responseData[0]?.procod);
       if (!procod) {
         throw new Error("Resposta inválida ao criar produto");
       } 


    else if (response.ok) {
        const msg = document.createElement("div");
        msg.textContent = "Peça cadastrada com sucesso!";
        msg.style.position = "fixed";
        msg.style.top = "20px";
        msg.style.left = "50%";
        msg.style.transform = "translateX(-50%)";
        msg.style.background = "#28a745";
        msg.style.color = "#fff";
        msg.style.padding = "12px 24px";
        msg.style.borderRadius = "6px";
        msg.style.zIndex = "10000";
        msg.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
        document.body.appendChild(msg);
        setTimeout(() => {
          msg.remove();
        }, 2000);
        
      }
      // Grava as cores disponíveis se houver cores marcadas e procod válido
       if (procod && corIds.length > 0) {
         // Para cada cor marcada, faz um POST individual
         for (const corcod of corIds) {
           await fetch(
             `${BASE_URL}/proCoresDisponiveis/${procod}?corescod=${corcod}`,
             {
               method: "POST",
               headers: { "Content-Type": "application/json" },
             }
           );
         }
       }
    produtoModal.hide();
  } catch (error) {
    if (error.message === '403') {
        produtoModal.hide();
      alertPersonalizado('Sem permissão para criar peças.', 2000);
    } else {
      alert('Erro ao salvar os dados.');
    }
    console.error(error);
  }
});