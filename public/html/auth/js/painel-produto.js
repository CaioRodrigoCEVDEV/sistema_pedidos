const produtoModalEl = document.getElementById("produtoModal");
const produtoModal = new bootstrap.Modal(produtoModalEl);
const btnProduto = document.getElementById("dropdownProduto");
// const btnExcluir = document.getElementById('btnDelete');
const produtoForm = document.getElementById("produtoForm");
const promarcascod = document.getElementById("popupMarcaModalProduto");

function parseIntegerParam(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = String(value).trim().toLowerCase();

  if (
    normalizedValue === "" ||
    normalizedValue === "null" ||
    normalizedValue === "undefined"
  ) {
    return null;
  }

  const parsed = Number(normalizedValue);

  return Number.isInteger(parsed) ? parsed : null;
}
// Novo produto
btnProduto.addEventListener("click", () => {
  async function fetchMarcas() {
    try {
      const response = await fetch(`${BASE_URL}/marcas`);
      if (!response.ok) {
        throw new Error("Erro ao buscar marcas");
      }
      const marcas = await response.json();
      promarcascod.innerHTML = '<option value="">Selecione</option>';
      marcas.forEach((marca) => {
        const option = document.createElement("option");
        option.value = marca.marcascod;
        option.textContent = marca.marcasdes;
        promarcascod.appendChild(option);
      });
    } catch (error) {
      console.error("Erro ao carregar marcas:", error);
    }
  }

  const fetchModelos = async (marcascod) => {
    const marcaId = parseIntegerParam(marcascod);
    const modelosHolder = document.getElementById("popupProdutoModalModelo");

    modelosHolder.innerHTML = '<option value="">Selecione</option>';

    if (marcaId === null) {
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/modelo/${marcaId}`);
      if (!response.ok) throw new Error("Erro ao buscar modelos");

      const modelos = await response.json();

      modelos.forEach((modelo) => {
        const option = document.createElement("option");
        option.value = modelo.modcod;
        option.textContent = modelo.moddes;
        modelosHolder.appendChild(option);
      });
    } catch (error) {
      console.error("Erro ao carregar modelos:", error);
    }
  };

  promarcascod.addEventListener("change", (e) => {
    const marcaId = parseIntegerParam(e.target.value);
    const modelosHolder = document.getElementById("popupProdutoModalModelo");
    if (marcaId !== null) {
      fetchModelos(marcaId);
    } else {
      modelosHolder.innerHTML = '<option value="">Selecione</option>';
    }
  });

  fetchTipos = async () => {
    try {
      const response = await fetch(`${BASE_URL}/tipos`);
      if (!response.ok) {
        throw new Error("Erro ao buscar tipos");
      }
      const tipos = await response.json();
      const protipocod = document.getElementById("popupProdutoModaltipo");
      protipocod.innerHTML = '<option value="">Selecione</option>';
      tipos.forEach((tipo) => {
        const option = document.createElement("option");
        option.value = tipo.tipocod;
        option.textContent = tipo.tipodes;
        protipocod.appendChild(option);
      });
    } catch (error) {
      console.error("Erro ao carregar tipos:", error);
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

  descricaoProduto.value = "";
  provl.value = "";
  // Limpar seleção de modelos
  const modelosHolder = document.getElementById("popupProdutoModalModelo");
  modelosHolder.innerHTML =
    '<div class="text-muted small">Selecione a marca primeiro</div>';
  produtoModal.show();
});

// salvar registro na api
produtoForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();

  const modeloSelecionado = document.getElementById(
    "popupProdutoModalModelo",
  ).value;
  const marcaId = parseIntegerParam(
    document.getElementById("popupMarcaModalProduto").value,
  );
  const modeloId = parseIntegerParam(modeloSelecionado);
  const tipoId = parseIntegerParam(
    document.getElementById("popupProdutoModaltipo").value,
  );

  if (marcaId === null) {
    alert("Marca inválida ou não informada.");
    return;
  }

  if (modeloId === null) {
    alert("Modelo inválido ou não informado.");
    return;
  }

  if (tipoId === null) {
    alert("Tipo de peça inválido ou não informado.");
    return;
  }

  const payload = {
    prodes: descricaoProduto.value.trim(),
    promarcascod: marcaId,
    provl: parseFloat(provl.value),
    promodcod: modeloId,
    protipocod: tipoId,
  };

  // Pega todos os checkboxes marcados de cor
  const corCheckboxes = document.querySelectorAll(
    '#selectPainelCor input[type="checkbox"]:checked',
  );
  const corIds = Array.from(corCheckboxes).map((cb) => cb.value);
  try {
    const url = `${BASE_URL}/pro`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.status === 403) {
      throw new Error("403");
    }

    const responseData = await response.json();
    let procod =
      responseData.procod ||
      (Array.isArray(responseData) && responseData[0]?.procod);
    if (!procod) {
      throw new Error("Resposta inválida ao criar produto");
    } else if (response.ok) {
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
          `${BASE_URL}/proCoresDisponiveis/${procod}?corescod=${corcod}&procorsemest=N`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }
    produtoModal.hide();
  } catch (error) {
    if (error.message === "403") {
      produtoModal.hide();
      alertPersonalizado("Sem permissão para criar peças.", 2000);
    } else {
      alert("Erro ao salvar os dados.");
    }
    console.error(error);
  }
});
