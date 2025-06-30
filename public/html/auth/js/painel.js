const params = new URLSearchParams(window.location.search);
const id = params.get("id");
let marcascod = null;
let marcacodModelo = null;
let tipo = null;
let modelo = null;

document.addEventListener("DOMContentLoaded", () => {
  fetch(`${BASE_URL}/marcas/`)
    .then((res) => res.json())
    .then((dados) => {
      const holder = document.getElementById("painelMarca");
      if (!holder) return;
      holder.innerHTML = ""; // zera antes

      let html = '<option value="">Selecione uma marca</option>';
      dados.forEach((marca) => {
        html += `<option value="${marca.marcascod}"${
          id == marca.marcascod ? " selected" : ""
        }>${marca.marcasdes}</option>`;
      });
      const select = document.getElementById("painelMarca");
      if (select) {
        select.innerHTML = html;
      }

      holder.innerHTML = html;

      holder.addEventListener("change", (e) => {
        marcacodModelo = e.target.value;
      });
    })
    .catch(console.error);
});

document.addEventListener("DOMContentLoaded", () => {
  fetch(`${BASE_URL}/marcas/`)
    .then((res) => res.json())
    .then((dados) => {
      const holder = document.getElementById("selectPainelMarca");
      if (!holder) return;
      holder.innerHTML = ""; // zera antes

      let html = '<option value="">Selecione uma marca</option>';
      dados.forEach((marca) => {
        html += `<option value="${marca.marcascod}"${
          id == marca.marcascod ? " selected" : ""
        }>${marca.marcasdes}</option>`;
      });
      const select = document.getElementById("paineselectPainelMarcalMarca");
      if (select) {
        select.innerHTML = html;
      }

      holder.innerHTML = html;

      const tipoHolder = document.getElementById("selectPainelTipo");
      if (tipoHolder) {
        tipoHolder.addEventListener("change", (e) => {
          tipo = e.target.value; // Atualiza o código do tipo selecionado
          console.log("Tipo selecionado:", tipo);
        });
      }

      holder.addEventListener("change", (e) => {
        marcascod = e.target.value; // Atualiza o código da marca selecionada
        // Atualiza os modelos com base na marca selecionada
        fetch(`${BASE_URL}/modelo/${marcascod}`)
          .then((res) => res.json())
          .then((dados) => {
            const modeloHolder = document.getElementById("selectPainelModelo");
            if (!modeloHolder) return;
            modeloHolder.innerHTML =
              '<option value="">Selecione o Modelo</option>';
            dados.forEach((modelo) => {
              modeloHolder.innerHTML += `<option value="${modelo.modcod}">${modelo.moddes}</option>`;
            });
            console.log("Marca selecionada:", marcascod);

            modeloHolder.addEventListener("change", (e) => {
              modelo = e.target.value; // Atualiza o código do modelo selecionado
              console.log("Modelo selecionado:", modelo);
            });
          })
          .catch(console.error);
      });
    })
    .catch(console.error);
});

document.addEventListener("DOMContentLoaded", () => {
  fetch(`${BASE_URL}/tipos/`)
    .then((res) => res.json())
    .then((dados) => {
      const holder = document.getElementById("selectPainelTipo");
      if (!holder) return;
      holder.innerHTML = ""; // zera antes

      let html = '<option value="">Selecione o tipo</option>';
      dados.forEach((tipo) => {
        html += `<option value="${tipo.tipocod}"${
          id == tipo.tipocod ? " selected" : ""
        }>${tipo.tipodes}</option>`;
      });
      const select = document.getElementById("selectPainelTipo");
      if (select) {
        select.innerHTML = html;
      }

      holder.innerHTML = html;
    })
    .catch(console.error);
});

//Função para criar marca
document
  .getElementById("cadastrarPainelMarca")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    fetch(`${BASE_URL}/marcas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((resposta) => {
        alert("Dados salvos com sucesso!");
        console.log(resposta);
        location.reload(); // Atualiza a página após gravar
      })
      .catch((erro) => {
        alert("Erro ao salvar os dados.");
        console.error(erro);
      });
  });

//função para criar modelo
document
  .getElementById("cadastrarPainelModelo")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    data.modmarcascod = marcacodModelo;

    fetch(`${BASE_URL}/modelo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((resposta) => {
        alert("Dados salvos com sucesso!");
        console.log(resposta);
        location.reload(); // Atualiza a página após gravar
      })
      .catch((erro) => {
        alert("Erro ao salvar os dados.");
        console.error(erro);
      });
  });

//função para criar modelo
document
  .getElementById("cadastrarPainelTipo")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    fetch(`${BASE_URL}/tipo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((resposta) => {
        alert("Dados salvos com sucesso!");
        console.log(resposta);
        location.reload(); // Atualiza a página após gravar
      })
      .catch((erro) => {
        alert("Erro ao salvar os dados.");
        console.error(erro);
      });
  });

//função para criar modelo
document
  .getElementById("cadastrarPainelPeca")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    data.promarcascod = marcascod; // Adiciona o código da marca ao objeto data
    data.promodcod = modelo; // Adiciona o código do modelo ao objeto data
    data.protipocod = tipo; // Adiciona o código do tipo ao objeto data

    fetch(`${BASE_URL}/pro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((resposta) => {
        alert("Dados salvos com sucesso!");
        console.log(resposta);
        location.reload(); // Atualiza a página após gravar
      })
      .catch((erro) => {
        alert("Erro ao salvar os dados.");
        console.error(erro);
      });
  });

// Impede que o dropdown feche ao clicar em qualquer elemento dentro dele
document.querySelectorAll(".dropdown-menu").forEach(function (menu) {
  menu.addEventListener("click", function (e) {
    e.stopPropagation();
  });
});
