// table produtos com estoque
document.addEventListener("DOMContentLoaded", function () {
  fetch(`${BASE_URL}/proComEstoque`)
    .then((res) => res.json())
    .then((dados) => {
      const estoque = document.getElementById("tabela-estoque");
      estoque.innerHTML = ""; // limpa o conteúdo atual da tabela

      dados.forEach((dado) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${dado.marcasdes}</td>
          <td>${dado.moddes}</td>
          <td>${dado.tipodes}</td>
          <td>${dado.cordes}</td>
          <td>
          <div class="d-flex gap-2">
            <div class="row">
                <div class="col">
                    <input type="text" class="form-control" placeholder="Quantidade"
                        aria-label="Quantidade" aria-describedby="basic-addon1">
                </div>
                <div class="col">
                    <button class="btn btn-success"
                        onclick="adicionarEstoque(${dado.procod}, this.closest('.row').querySelector('input').value, ${dado.procorcorescod})">
                        Adicionar
                    </button>
                </div>
          </div>
          <td class="text-center">${dado.qtde}</td>
          </td>
        `;
        estoque.appendChild(tr);
      });
    })
    .catch((erro) => console.error("Erro ao carregar pedidos:", erro));
});

// table produtos sem estoque
document.addEventListener("DOMContentLoaded", function () {
  fetch(`${BASE_URL}/proSemEstoque`)
    .then((res) => res.json())
    .then((dados) => {
      const semEstoque = document.getElementById("tabela-sem-estoque");
      semEstoque.innerHTML = ""; // limpa o conteúdo atual da tabela

      dados.forEach((dado) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${dado.marcasdes}</td>
          <td>${dado.moddes}</td>
          <td>${dado.tipodes}</td>
          <td>${dado.cordes}</td>
          <td>
          <div class="d-flex gap-2">
            <div class="row">
                <div class="col">
                    <input type="text" class="form-control" placeholder="Quantidade"
                        aria-label="Quantidade" aria-describedby="basic-addon1">
                </div>
                <div class="col">
                    <button class="btn btn-success"
                        onclick="adicionarEstoque(${dado.procod}, this.closest('.row').querySelector('input').value, ${dado.procorcorescod})">
                        Adicionar
                    </button>
                </div>
          </div>
          <td class="text-center">${dado.qtde}</td>
          </td>
        `;
        semEstoque.appendChild(tr);
      });
    })
    .catch((erro) => console.error("Erro ao carregar pedidos:", erro));
});

async function adicionarEstoque(procod, quantidade, cor = null) {
  try {
    console.log("Adicionando estoque:", procod, quantidade, cor);
    const response = await fetch(`${BASE_URL}/pro/estoque/${procod}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ quantidade, cor }),
    });
    if (response.ok) {
      alert("Estoque atualizado com sucesso!");
      location.reload(); // Recarrega a página para atualizar a tabela
    } else {
      alert("Erro ao atualizar o estoque front-end.");
    }
  } catch (error) {
    console.error("Erro ao atualizar o estoque:", error);
    alert("Erro ao atualizar o estoque.");
  }
}
