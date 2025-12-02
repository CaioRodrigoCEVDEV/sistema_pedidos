const params = new URLSearchParams(window.location.search);
const id = params.get("id");

document.addEventListener("DOMContentLoaded", () => {
  fetch(`${BASE_URL}/marcas/`)
    .then((res) => res.json())
    .then((dados) => {
      const holder = document.getElementById("marcaTitulo");
      if (!holder) return;
      holder.innerHTML = ""; // zera antes

      let html = '<div class="row">';
      dados.forEach((dado, i) => {
        html += `
        
          <div class="col-12 col-sm-6 col-md-4 mb-3 d-flex justify-content-center">
            <a href="dashboard/modelo?id=${dado.marcascod}&marcascod=${dado.marcascod}" class="w-100">
              <button class="btn btn-md btn-outline-dark w-100">${dado.marcasdes}</button>
            </a>
          </div>`;

      });
      html += "</div>";

      holder.innerHTML = html;
    })
    .catch(console.error);
});

//Função para criar marca
document
  .getElementById("cadastrarMarca")
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
        showToast("Dados salvos com sucesso!", "success");
        console.log(resposta);
        location.reload(); // Atualiza a página após gravar
      })
      .catch((erro) => {
        showToast("Erro ao salvar os dados.", "error");
        console.error(erro);
      });
  });
